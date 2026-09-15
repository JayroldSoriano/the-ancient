import path from "node:path";
import fs from "node:fs/promises";
import { REPOS, EVIDENCE_ROOT } from "../config.js";
import { sh, tail } from "../lib/shell.js";
import { diffAgainstBase } from "../lib/worktree.js";
import { utter, utterIsm } from "../lib/utter.js";
import { phraseTool } from "../lib/voice.js";
import type { CheckResult, TaskStateT } from "../state.js";

/**
 * Rattletrap. Deliberately NOT an agent — there is no model anywhere in this
 * file, which is the whole point of the persona. Agents will tell you the
 * tests passed. Cogs only report what the exit code was, so "passed" is a
 * fact about the process table rather than a claim in a transcript.
 */
export async function evidenceNode(state: TaskStateT) {
  const { task, worktree, branch } = state;
  const cfg = REPOS[task.repo];
  const dir = path.join(EVIDENCE_ROOT, task.id);
  await fs.mkdir(dir, { recursive: true });

  const checks: CheckResult[] = [];
  utterIsm("evidence");
  for (const check of cfg.checks) {
    utter({
      hero: "evidence",
      kind: "tool",
      line: phraseTool("evidence", "Bash", check.name),
      detail: check.cmd,
    });
    const res = await sh(check.cmd, worktree, { timeoutMs: 20 * 60_000 });
    const logPath = path.join(dir, `${check.name}.log`);
    await fs.writeFile(
      logPath,
      `$ ${check.cmd}\nexit ${res.exitCode} in ${res.durationMs}ms\n\n${res.stdout}\n${res.stderr}`,
    );
    checks.push({
      name: check.name,
      cmd: check.cmd,
      exitCode: res.exitCode,
      durationMs: res.durationMs,
      logPath,
      tail: tail(res.stdout + res.stderr),
    });
    utter({
      hero: "evidence",
      kind: "status",
      line:
        res.exitCode === 0
          ? `Cog ${check.name} — exit 0`
          : `Cog ${check.name} — exit ${res.exitCode}`,
    });
    if (check.required && res.exitCode !== 0) break;
  }

  const { stat, patch } = await diffAgainstBase(task.repo, worktree);
  await fs.writeFile(path.join(dir, "changes.patch"), patch);
  await fs.writeFile(
    path.join(dir, "summary.json"),
    JSON.stringify({ task, branch, worktree, diffStat: stat, checks }, null, 2),
  );

  const requiredNames = new Set(cfg.checks.filter((c) => c.required).map((c) => c.name));
  const failed = checks.filter((c) => requiredNames.has(c.name) && c.exitCode !== 0);
  const missing = [...requiredNames].filter((n) => !checks.some((c) => c.name === n));
  const passed =
    failed.length === 0 && missing.length === 0 && state.review?.verdict === "approved";

  const outOfRounds = state.round >= Number(process.env.MAX_REVIEW_ROUNDS ?? 3);
  const terminal = passed || outOfRounds;

  const base = {
    checks,
    feedback: failed.length
      ? failed.map((f) => `Check "${f.name}" failed (exit ${f.exitCode}):\n${f.tail}`).join("\n\n")
      : state.feedback,
  };
  // Only record a result when this task is finished — otherwise the loop
  // would append one result per round.
  if (!terminal) return base;

  return {
    ...base,
    results: [
      {
        taskId: task.id,
        repo: task.repo,
        status: passed ? ("passed" as const) : ("blocked" as const),
        branch,
        worktree,
        diffStat: stat,
        rounds: state.round,
        review: state.review,
        checks,
        evidenceDir: dir,
        ...(passed
          ? {}
          : {
              blockedReason: failed.length
                ? `Required checks failed: ${failed.map((f) => f.name).join(", ")}`
                : missing.length
                  ? `Required checks did not run: ${missing.join(", ")}`
                  : "Reviewer did not approve within the round limit.",
            }),
      },
    ],
  };
}

export function afterEvidence(state: TaskStateT) {
  const result = state.results.at(-1);
  if (result?.status === "passed") return "__end__";
  if (state.round >= Number(process.env.MAX_REVIEW_ROUNDS ?? 3)) return "__end__";
  return "implement";
}
