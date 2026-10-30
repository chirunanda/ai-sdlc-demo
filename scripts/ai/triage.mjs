// Explains a failure from a log file and suggests a fix.
// Usage: node scripts/ai/triage.mjs --file build.log --kind ci|build|deploy|incident [--title "..."]
// If PR_NUMBER is set the result is posted on the PR, otherwise it goes to the job summary.
import fs from "node:fs";
import { askClaude, truncate, upsertPrComment, writeSummary, UNTRUSTED_NOTE } from "./lib.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), all[i + 1]]);
    return acc;
  }, [])
);
const kind = args.kind || "ci";
const title = args.title || `${kind} failure`;
const log = fs.readFileSync(args.file, "utf8");

const focus = {
  ci: "a GitHub Actions CI job (npm, Vitest, Maven, JUnit)",
  build: "an AWS CodeBuild build running the buildspec (Maven, npm, packaging)",
  deploy: "an AWS CodeDeploy deployment (appspec hooks, systemd, nginx, health checks)",
  incident: "a production incident on an EC2 host running nginx, a Node.js BFF and a Java API",
}[kind];

const system = `You are a site reliability engineer diagnosing ${focus}.
${UNTRUSTED_NOTE}
Reply in Markdown with these sections, kept brief:
### Most likely cause
One or two sentences. Quote at most one short log line as evidence.
### How to fix
Numbered steps with exact commands or file changes where possible.
### Confidence
Low, medium or high, plus what would confirm it.
If the log does not contain enough information, say what extra information is needed instead of guessing.`;

try {
  const answer = await askClaude({ system, user: truncate(log, 40000), maxTokens: 1200 });
  const body = `## AI triage: ${title}\n\n${answer}\n\n<sub>Automated analysis, verify before acting.</sub>`;
  if (process.env.PR_NUMBER) {
    await upsertPrComment({
      repo: process.env.GITHUB_REPOSITORY,
      prNumber: process.env.PR_NUMBER,
      marker: `<!-- ai-triage-${kind} -->`,
      body,
    });
  }
  writeSummary(body);
} catch (err) {
  console.warn(`AI triage skipped: ${err.message}`);
}
