// Scores the risk of a release from the diff since the last deployed commit.
// Output "level" = low | medium | high. High-risk releases wait for a human approval
// (the "production-high-risk" GitHub environment).
// Env: BEFORE_SHA (previous commit, optional), ANTHROPIC_API_KEY (optional; heuristics only without it)
import { execSync } from "node:child_process";
import { askClaude, truncate, setOutput, writeSummary, UNTRUSTED_NOTE } from "./lib.mjs";

const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
const ZEROS = /^0+$/;

function baseRef() {
  const before = process.env.BEFORE_SHA;
  if (before && !ZEROS.test(before)) {
    try { sh(`git cat-file -e ${before}^{commit}`); return before; } catch { /* fall through */ }
  }
  try { sh("git rev-parse HEAD~1"); return "HEAD~1"; } catch { return sh("git hash-object -t tree /dev/null").trim(); } // empty tree (first commit)
}

const base = baseRef();
const numstat = sh(`git diff --numstat ${base} HEAD`).trim().split("\n").filter(Boolean)
  .map((l) => { const [a, d, file] = l.split("\t"); return { added: Number(a) || 0, deleted: Number(d) || 0, file }; });

const changedLines = numstat.reduce((n, f) => n + f.added + f.deleted, 0);
const files = numstat.map((f) => f.file);

// --- Heuristic score (0-100) -------------------------------------------------
let score = 0;
const reasons = [];
const bump = (n, why) => { score += n; reasons.push(why); };

if (changedLines > 400) bump(30, `Large change (${changedLines} lines)`);
else if (changedLines > 120) bump(15, `Medium-sized change (${changedLines} lines)`);
if (files.length > 15) bump(10, `${files.length} files touched`);
if (files.some((f) => /^(infra|scripts)\//.test(f) || f === "appspec.yml" || f === "buildspec.yml"))
  bump(30, "Deployment, infrastructure or hook scripts changed");
if (files.some((f) => /^\.github\/workflows\//.test(f))) bump(15, "CI/CD workflow changed");
if (files.some((f) => /(pom\.xml|package(-lock)?\.json)$/.test(f))) bump(10, "Dependencies changed");
const touchesSrc = files.some((f) => /\/src\/(?!test)/.test(f) && !/\.test\./.test(f));
const touchesTests = files.some((f) => /(\/test\/|\.test\.|Test\.java)/.test(f));
if (touchesSrc && !touchesTests) bump(15, "Source changed without any test changes");

let level = score >= 50 ? "high" : score >= 20 ? "medium" : "low";
const rank = { low: 0, medium: 1, high: 2 };

// --- AI assessment -----------------------------------------------------------
let aiNote = "AI assessment not run (no API key or API error). Heuristic score only.";
if (process.env.ANTHROPIC_API_KEY && files.length > 0) {
  try {
    const diff = sh(`git diff ${base} HEAD -- . ':(exclude)*package-lock.json'`);
    const system = `You assess production deployment risk for a small system (React, Node BFF, Java API) deployed in place with AWS CodeDeploy.
${UNTRUSTED_NOTE}
Respond with ONLY compact JSON: {"level":"low|medium|high","reasons":["...","..."]}.
high = likely user-visible breakage, data or security impact, or deployment/infrastructure changes that could prevent startup.
medium = behaviour changes in core paths, or new dependencies. low = docs, tests, copy, styling, small isolated fixes.
Give at most 3 short reasons.`;
    const raw = await askClaude({ system, user: truncate(diff, 50000), maxTokens: 400 });
    const parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/gm, "").trim());
    if (rank[parsed.level] !== undefined) {
      if (rank[parsed.level] > rank[level]) level = parsed.level; // take the more cautious of the two
      aiNote = `AI assessment: **${parsed.level}**. ${(parsed.reasons || []).join("; ")}`;
    }
  } catch (err) {
    aiNote = `AI assessment failed (${err.message.slice(0, 120)}). Heuristic score only.`;
  }
}

setOutput("level", level);
writeSummary(
  `## Release risk: ${level.toUpperCase()}\n\n` +
  `Compared \`${base.slice(0, 8)}\`..\`HEAD\`: ${files.length} files, ${changedLines} changed lines. Heuristic score ${score}/100.\n\n` +
  (reasons.length ? reasons.map((r) => `- ${r}`).join("\n") + "\n\n" : "") +
  `${aiNote}\n\n` +
  (level === "high" ? "This release needs approval in the **production-high-risk** environment.\n" : "")
);
