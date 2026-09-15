import path from "node:path";
import fs from "node:fs/promises";
import { CODER_PROMPT } from "../agents.js";
import { runAgent } from "../lib/claude.js";
import { createWorktree } from "../lib/worktree.js";
import { sh } from "../lib/shell.js";
import type { TaskStateT } from "../state.js";

export async function implementNode(state: TaskStateT) {
  const { task } = state;
  const branch = state.branch || `agent/${task.repo}/${task.id}`;
  const worktree =
    state.worktree || (await createWorktree(task.repo, branch, task.id));

  const criteria = task.acceptanceCriteria.map((c) => `- ${c}`).join("\n");
  const rework = state.feedback
    ? `\n\nThis is round ${state.round + 1}. Previous round was sent back:\n${state.feedback}\n\nAddress every point. Do not re-litigate.`
    : "";

  await runAgent({
    prompt:
      `Task: ${task.title}\n\n${task.intent}\n\n` +
      `Acceptance criteria:\n${criteria}\n\n` +
      `Likely files: ${task.files.join(", ") || "discover them yourself"}` +
      rework,
    cwd: worktree,
    systemPrompt: CODER_PROMPT,
    // Hard boundary: the coder cannot reach a remote, whatever it decides.
    disallowedTools: ["WebFetch", "WebSearch"],
    model: "sonnet",
    maxTurns: 80,
    hero: "implement",
  });

  // .agent/ holds scratch files (plan.json, review.json, blocked.txt). It is
  // excluded per-repo by scripts/bootstrap.sh so `git add -A` cannot commit it.
  await sh(
    `git add -A && git diff --cached --quiet || git commit -m "feat(${task.id}): ${task.title.replace(/"/g, "")}"`,
    worktree,
  );

  const blocked = await fs
    .readFile(path.join(worktree, ".agent/blocked.txt"), "utf8")
    .catch(() => null);

  return {
    branch,
    worktree,
    round: state.round + 1,
    feedback: "",
    ...(blocked ? { review: { verdict: "changes_requested" as const, blocking: [], notes: [blocked] } } : {}),
  };
}
