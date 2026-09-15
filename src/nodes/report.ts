import { AIMessage } from "@langchain/core/messages";
import { REPOS } from "../config.js";
import { REPORTER_PROMPT } from "../agents.js";
import { runAgent } from "../lib/claude.js";
import type { GraphStateT } from "../state.js";

export async function reportNode(state: GraphStateT) {
  const evidence = state.results
    .map((r) => {
      const checks = r.checks
        .map((c) => `    ${c.name}: exit ${c.exitCode} (${c.durationMs}ms)`)
        .join("\n");
      return [
        `## ${r.taskId} [${r.repo}] — ${r.status}`,
        r.blockedReason ? `  blocked: ${r.blockedReason}` : "",
        `  review: ${r.review?.verdict ?? "none"} after ${r.rounds} round(s)`,
        r.review?.blocking.length
          ? `  open issues:\n${r.review.blocking.map((b) => `    - ${b.file}: ${b.issue}`).join("\n")}`
          : "",
        `  diff:\n${r.diffStat}`,
        `  checks:\n${checks}`,
        `  artifacts: ${r.evidenceDir}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const report = await runAgent({
    prompt:
      `Original request:\n${state.request}\n\n` +
      `Plan summary:\n${state.plan?.summary}\n\n` +
      `Acceptance criteria by task:\n${state.plan?.tasks
        .map((t) => `${t.id}: ${t.acceptanceCriteria.join("; ")}`)
        .join("\n")}\n\n` +
      `Verification evidence:\n${evidence}`,
    cwd: REPOS.api.dir,
    systemPrompt: REPORTER_PROMPT,
    allowedTools: ["Read"],
    model: "opus",
    maxTurns: 8,
    hero: "report",
  });

  return { report, messages: [new AIMessage(report)] };
}
