import path from "node:path";
import fs from "node:fs/promises";
import { REVIEWER_PROMPT } from "../agents.js";
import { runAgent, readAgentJson } from "../lib/claude.js";
import { diffAgainstBase } from "../lib/worktree.js";
import type { ReviewVerdict, TaskStateT } from "../state.js";

const MAX_PATCH_CHARS = 120_000;

export async function reviewNode(state: TaskStateT) {
  const { task, worktree } = state;
  const { stat, patch } = await diffAgainstBase(task.repo, worktree);

  if (!patch.trim()) {
    return {
      review: {
        verdict: "changes_requested" as const,
        blocking: [],
        notes: ["The coder produced no diff against the base branch."],
      },
    };
  }

  const criteria = task.acceptanceCriteria.map((c) => `- ${c}`).join("\n");
  const body =
    patch.length > MAX_PATCH_CHARS
      ? `${patch.slice(0, MAX_PATCH_CHARS)}\n\n[diff truncated — read the files directly]`
      : patch;

  await runAgent({
    prompt:
      `Task: ${task.title}\n\n${task.intent}\n\n` +
      `Acceptance criteria:\n${criteria}\n\n` +
      `Diffstat:\n${stat}\n\nDiff:\n${body}\n\n` +
      `Write your verdict to .agent/review.json.`,
    cwd: worktree,
    systemPrompt: REVIEWER_PROMPT,
    // Read and write the verdict file only. A reviewer that can edit the code
    // stops being a reviewer.
    allowedTools: ["Read", "Glob", "Grep", "Write"],
    model: "opus",
    hero: "review",
  });

  const review = await readAgentJson<ReviewVerdict>(
    path.join(worktree, ".agent/review.json"),
  );
  await fs.rm(path.join(worktree, ".agent/review.json")).catch(() => {});

  const verdict: ReviewVerdict = review ?? {
    verdict: "changes_requested",
    blocking: [],
    notes: ["Reviewer did not produce a parseable verdict."],
  };

  const feedback =
    verdict.verdict === "changes_requested"
      ? [
          ...verdict.blocking.map(
            (b) => `${b.file}${b.line ? `:${b.line}` : ""} — ${b.issue}\n  Fix: ${b.fix}`,
          ),
          ...verdict.notes,
        ].join("\n")
      : "";

  return { review: verdict, feedback };
}

export function afterReview(state: TaskStateT) {
  if (state.review?.verdict === "approved") return "evidence";
  if (state.round >= Number(process.env.MAX_REVIEW_ROUNDS ?? 3)) return "evidence";
  return "implement";
}
