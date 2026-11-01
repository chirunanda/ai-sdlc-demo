# AI in the SDLC: GitHub Actions + CodeBuild + CodeDeploy demo

A small catalog app, wired to a real pipeline, with AI added at each stage.

```
Browser ─► nginx :80 ─┬─► React static files
                      └─► /api ─► Node BFF :3000 ─► Java API :8080 (mock data)
```

```
PR ──► GitHub Actions ──► merge to main ──► GitHub Actions ──► CodeBuild ──► CodeDeploy ──► EC2
       CI + AI review       │                risk score          build+test    in-place,
       CodeQL + triage      │                (approval gate)     bundle → S3   auto-rollback
                            └─ Dependabot, weekly flaky-test check
```

## Where AI plays a role

| Stage | AI role | Where it lives | Manual work |
|---|---|---|---|
| Write code | Copilot / Amazon Q in your IDE, repo guidance for Copilot | `.github/copilot-instructions.md` | Install the IDE extension |
| Pull request | Claude reviews each PR: summary, bugs, security, suggested tests | `ai-pr-review.yml`, `scripts/ai/pr-review.mjs` | Add the `ANTHROPIC_API_KEY` secret |
| Pull request | Copilot code review (optional second reviewer) | repo setting | Enable in repo settings (see below) |
| CI | Run only affected suites (test selection) | `ci.yml` (`paths-filter`) | None |
| CI | Detect flaky tests by repeating suites | `flaky-check.yml`, `scripts/flaky-check.sh` | None |
| CI | Explain failed CI runs on the PR | `ai-failure-triage.yml`, `scripts/ai/triage.mjs` | None |
| Security | CodeQL scanning, Copilot Autofix, Dependabot | `codeql.yml`, `dependabot.yml` | Turn on code scanning and Autofix (see below) |
| Build | Explain failed CodeBuild builds from CloudWatch logs | `deploy.yml` (build job) | None |
| Release | AI + heuristic risk score; high risk needs human approval | `scripts/ai/risk-score.mjs`, `deploy.yml` | Create two GitHub environments |
| Deploy | Smoke tests, automatic rollback, explain failed deployments | `appspec.yml`, `scripts/deploy/validate.sh`, `deploy.yml` | None |
| Operate | Anomaly detection, incident log analysis | CloudWatch alarm in `infra/pipeline.yml`, `triage.mjs --kind incident` | Optional AWS features (see below) |

## Repo layout

```
api/            Java 21 + Spring Boot 3, mock products, /actuator/health
bff/            Node 20 + Express, reshapes API data, /health
frontend/       React 18 + Vite
buildspec.yml   CodeBuild: test all three, stage the deployment bundle
appspec.yml     CodeDeploy: file copy + lifecycle hooks
scripts/deploy/ CodeDeploy hooks (stop, install, start, validate)
config/         systemd units and nginx config installed on the host
infra/          CloudFormation: S3, CodeBuild, CodeDeploy, EC2, GitHub OIDC role
scripts/ai/     AI scripts (zero dependencies, Node 20+)
.github/        workflows, Dependabot, Copilot instructions
```

## Run it locally

```bash
cd api && mvn spring-boot:run          # http://127.0.0.1:8080/api/products
cd bff && npm install && npm start     # http://127.0.0.1:3000/api/products
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api to the BFF)
```

Tests: `mvn verify` in `api`, `npm test` in `bff` and `frontend`.

## One-time setup

You need an AWS account, the AWS CLI, the GitHub CLI (`gh`), and an Anthropic API key from console.anthropic.com.

### 1. Create the GitHub repository

```bash
git init -b main && git add -A && git commit -m "Initial commit"
gh repo create YOUR_ORG/YOUR_REPO --private --source . --push
```

The first push to `main` starts the Deploy workflow. It will fail until steps 2 and 3 are done. That is fine.

### 2. Create the AWS resources

Pick a public subnet (the default VPC subnets work).

```bash
aws cloudformation deploy \
  --template-file infra/pipeline.yml \
  --stack-name ai-sdlc-demo \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides GitHubRepo=YOUR_ORG/YOUR_REPO VpcId=vpc-xxxx SubnetId=subnet-xxxx

aws cloudformation describe-stacks --stack-name ai-sdlc-demo \
  --query "Stacks[0].Outputs" --output table
```

If your account already has the GitHub OIDC provider, add `CreateGitHubOidcProvider=false`.
Wait about 3 minutes after the stack finishes so the instance can install Java, Node, nginx and the CodeDeploy agent.

### 3. Configure GitHub

Copy the stack outputs into repository variables, and add the API key as a secret:

```bash
gh variable set AWS_REGION        --body "us-west-2"
gh variable set AWS_ROLE_ARN      --body "<GitHubActionsRoleArn>"
gh variable set ARTIFACT_BUCKET   --body "<ArtifactBucket>"
gh variable set CODEBUILD_PROJECT --body "<CodeBuildProject>"
gh variable set CODEDEPLOY_APP    --body "<CodeDeployApplication>"
gh variable set CODEDEPLOY_GROUP  --body "<CodeDeployGroup>"
gh secret set ANTHROPIC_API_KEY
```

Create two environments (Settings → Environments). **Do not skip the second one's reviewers.** GitHub silently creates an unprotected environment if the name does not exist, which would let high-risk releases deploy without approval.

| Environment | Setting |
|---|---|
| `production` | No protection rules |
| `production-high-risk` | Required reviewers: you or your team |

Add a branch ruleset for `main` (Settings → Rules): require a pull request, and require the status checks `api`, `bff` and `frontend`. Checks skipped by test selection count as passing.

### 4. Deploy

Re-run the failed Deploy workflow, or push a commit. When it finishes, open the `SiteUrl` stack output. You should see the product list.

If a deployment fails, the workflow posts an AI explanation in the run summary, and CodeDeploy rolls back to the last good version on its own. On the very first deployment there is nothing to roll back to, so check `journalctl -u catalog-api -u catalog-bff` through SSM (below).

## Screenshots
<img src="docs/images/awsoutput.png" alt="Product list" width="600">

## Manual-only steps

These cannot be done from files in the repo. Menu names change over time, so look for the feature by name.

**GitHub Copilot code review.** Requires a Copilot plan. Create a ruleset for `main` and enable automatic Copilot code review on pull requests. It reads `.github/copilot-instructions.md`. Claude's review comment and Copilot's review then appear side by side.

**Code scanning and Copilot Autofix.** Free for public repositories; private repositories need GitHub Code Security. Enable code scanning and Dependabot alerts in Settings → Advanced Security (or Code security). `codeql.yml` produces the alerts, and Autofix attaches suggested fixes when it is available on your plan.

**IDE assistants.** Install GitHub Copilot or Amazon Q Developer in your IDE. Both can generate tests, `appspec.yml` and CloudFormation.

**Operate stage (optional, AWS console).**
- CloudWatch → Alarms → edit `ai-sdlc-demo-host-unhealthy` → use an anomaly detection band for metrics that vary, such as request latency once you add a load balancer.
- Amazon DevOps Guru finds anomalies in resources automatically (it charges per resource hour).
- Amazon Q Developer in chat applications can post CloudWatch and CodeDeploy notifications to Slack or Teams.

**Incident analysis with the triage script.**

```bash
aws ssm start-session --target <InstanceId>
sudo journalctl -u catalog-api -u catalog-bff -n 300 --no-pager > /tmp/incident.log
# copy the file to your machine, then:
ANTHROPIC_API_KEY=... node scripts/ai/triage.mjs --file incident.log --kind incident
```

## Try each AI piece

1. **PR review.** Open a PR that changes `bff/src/app.js` without touching tests. Within a minute Claude comments with a summary, risks and suggested tests.
2. **CI triage.** Make a BFF test fail on a PR. After CI fails, an "AI triage" comment explains the cause.
3. **Test selection.** Change only `frontend/src/styles.css`. The `api` and `bff` jobs are skipped.
4. **Risk gate.** Merge a change to `scripts/deploy/` or `appspec.yml`. The run summary shows HIGH, and the deploy job waits for approval in `production-high-risk`. A copy change merges and deploys without a pause.
5. **Rollback.** On a branch, set `server.port=9999` in `api/src/main/resources/application.properties` and merge. `validate.sh` fails, CodeDeploy rolls back, and the run summary explains what happened. The site keeps serving the old version.
6. **Flaky tests.** Run the "Flaky test check" workflow manually. Add `Math.random() > 0.5` to a test to see it reported as FLAKY.

## How the AI steps are built (and limited)

- Each script calls the Anthropic Messages API with plain `fetch`. The default model is `claude-sonnet-5-5`; change `MODEL` in `scripts/ai/lib.mjs` or set `ANTHROPIC_MODEL`.
- AI steps never block a pipeline on their own error: PR review and triage log a warning and continue. The risk score falls back to heuristics without an API key.
- AI output is advice. Merging needs a human approval, and high-risk deployment needs a human approval. Rollback is decided by health checks, not by a model.
- Diffs and logs are untrusted input. Prompts tell the model to ignore instructions inside them, and these jobs have narrow permissions (read code, write one comment) so a manipulated reply cannot do harm.
- Fork PRs get no AI review because GitHub withholds secrets from them.
- Your diffs and logs are sent to the Anthropic API. Check that this is allowed for your codebase, and look at Anthropic's data retention terms for your plan.
- Cloud access uses GitHub OIDC with a role limited to this repo, branch and environments. No AWS keys are stored.

## Known limits of this demo

- One EC2 instance with in-place deploys means a few seconds of downtime per release. For zero downtime, add an Application Load Balancer and an Auto Scaling group, and use blue/green or canary deployment configs.
- The site is HTTP only. Add an ALB with an ACM certificate for HTTPS.
- The host-health alarm is a placeholder. Alarm on real user-facing signals (5xx rate, latency) once you have a load balancer.
- GitHub Actions pins use major version tags for readability. For production, pin to commit SHAs.
- The Java module was not compiled when this repo was generated (no Maven Central access in that environment). The Node and React parts were tested and the pipeline files were linted with `cfn-lint` and `actionlint`. Your first CI run is the real check of the Java build; if it fails, the AI triage comment is a good first test of the setup.

## Clean up

```bash
aws s3 rm s3://<ArtifactBucket> --recursive
aws s3api delete-objects --bucket <ArtifactBucket> --delete "$(aws s3api list-object-versions --bucket <ArtifactBucket> --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' --output json)" 2>/dev/null || true
aws cloudformation delete-stack --stack-name ai-sdlc-demo
```

The bucket is versioned, so delete old versions too (the second command), or empty it from the S3 console before deleting the stack.
