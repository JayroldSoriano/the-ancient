import { AIMessage } from "@langchain/core/messages";
import { REPOS } from "../config.js";
import { sh } from "../lib/shell.js";
import { utter, utterIsm } from "../lib/utter.js";
import { phraseTool } from "../lib/voice.js";
import type { GraphStateT } from "../state.js";

/**
 * The only node in the system that touches a remote, and it runs strictly
 * downstream of your approval. No agent has push or gh access.
 */
export async function prNode(state: GraphStateT) {
  const urls: string[] = [];
  utterIsm("pr");

  for (const result of state.results.filter((r) => r.status === "passed")) {
    const cfg = REPOS[result.repo];
    utter({
      hero: "pr",
      kind: "tool",
      line: phraseTool("pr", "Bash", `push ${result.branch}`),
    });
    const push = await sh(`git push -u origin ${result.branch}`, result.worktree);
    if (push.exitCode !== 0) {
      urls.push(`${result.repo}: push failed — ${push.stderr.trim()}`);
      continue;
    }

    const checkLines = result.checks
      .map((c) => `| ${c.name} | \`${c.cmd}\` | ${c.exitCode === 0 ? "pass" : `exit ${c.exitCode}`} |`)
      .join("\n");

    const body = [
      state.report,
      "",
      "## Verification",
      "| Check | Command | Result |",
      "|---|---|---|",
      checkLines,
      "",
      `Replay: \`${result.evidenceDir}\``,
      "",
      "_Forged by Boush, reviewed by Kaldr, verified by Rattletrap, relocated by Io._",
      "_Opened only after the Ancient called the push._",
    ].join("\n");

    // Draft by default. Flip BEENS_PR_DRAFT=0 once you trust the pipeline.
    const draft = process.env.BEENS_PR_DRAFT !== "0" ? "--draft " : "";
    utter({
      hero: "pr",
      kind: "status",
      line: phraseTool("pr", "Bash", "open the tether"),
    });
    const pr = await sh(
      `gh pr create ${draft}--base ${cfg.baseBranch} --head ${result.branch} ` +
        `--title ${JSON.stringify(`${result.taskId}: ${state.plan?.summary ?? ""}`.slice(0, 90))} ` +
        `--body ${JSON.stringify(body)}`,
      result.worktree,
    );
    urls.push(pr.exitCode === 0 ? pr.stdout.trim() : `${result.repo}: ${pr.stderr.trim()}`);
  }

  const blocked = state.results.filter((r) => r.status === "blocked");
  const note = blocked.length
    ? `\n\nNot opened (blocked): ${blocked.map((b) => b.taskId).join(", ")}`
    : "";

  return {
    prUrl: urls.join("\n"),
    messages: [new AIMessage(`Pull requests:\n${urls.join("\n")}${note}`)],
  };
}
