// AI pull request review: summary, risks, bugs, security, and suggested tests.
// Inputs: pr.diff (file), env PR_NUMBER, GITHUB_REPOSITORY, GITHUB_TOKEN, ANTHROPIC_API_KEY
import fs from "node:fs";
import { askClaude, truncate, upsertPrComment, UNTRUSTED_NOTE } from "./lib.mjs";

const MARKER = "<!-- ai-pr-review -->";
const diff = fs.readFileSync(process.env.DIFF_FILE || "pr.diff", "utf8");

if (!diff.trim()) {
  console.log("Empty diff, nothing to review.");
  process.exit(0);
}

const system = `You are a senior engineer reviewing a pull request for a small system:
a React frontend, a Node.js backend-for-frontend (Express), and a Java Spring Boot API, deployed with AWS CodeDeploy.
${UNTRUSTED_NOTE}

Reply in GitHub-flavoured Markdown with exactly these sections, each short:
### Summary
2-4 sentences on what changed and why it likely changed.
### Risks and bugs
Concrete problems with file names. Say "None found" if there are none. Do not invent issues.
### Security
Only real concerns (injection, secrets, auth, unsafe deserialization, dependency risk). "None found" if none.
### Suggested tests
Up to 3 test cases worth adding, as short bullet points naming the file and behaviour to test.
Be specific and brief. Do not praise.`;

try {
  const review = await askClaude({ system, user: truncate(diff), maxTokens: 1500 });
  const body = `## AI review\n\n${review}\n\n<sub>Automated suggestion. A human reviewer still approves this PR.</sub>`;
  await upsertPrComment({
    repo: process.env.GITHUB_REPOSITORY,
    prNumber: process.env.PR_NUMBER,
    marker: MARKER,
    body,
  });
  console.log("Posted AI review.");
} catch (err) {
  // Never block a PR because the AI step failed.
  console.warn(`AI review skipped: ${err.message}`);
}
