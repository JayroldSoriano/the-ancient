import fs from "node:fs/promises";
import path from "node:path";
import { REPOS, WORKTREE_ROOT, type RepoKey } from "../config.js";
import { sh } from "./shell.js";

/**
 * Every task gets its own git worktree. Parallel agents editing one checkout
 * corrupt each other's work — this is the most important isolation boundary
 * in the system.
 */
export async function createWorktree(
  repo: RepoKey,
  branch: string,
  taskId: string,
): Promise<string> {
  const cfg = REPOS[repo];
  const dir = path.join(WORKTREE_ROOT, "worktrees", `${repo}-${taskId}`);
  await fs.mkdir(path.dirname(dir), { recursive: true });

  await sh(`git fetch origin ${cfg.baseBranch}`, cfg.dir);
  const existing = await sh(`git worktree list --porcelain`, cfg.dir);
  if (existing.stdout.includes(dir)) return dir;

  const res = await sh(
    `git worktree add -b ${branch} ${JSON.stringify(dir)} origin/${cfg.baseBranch}`,
    cfg.dir,
  );
  if (res.exitCode !== 0) {
    const retry = await sh(
      `git worktree add ${JSON.stringify(dir)} ${branch}`,
      cfg.dir,
    );
    if (retry.exitCode !== 0) {
      throw new Error(`worktree add failed: ${res.stderr}\n${retry.stderr}`);
    }
  }
  return dir;
}

export async function diffAgainstBase(repo: RepoKey, worktree: string) {
  const base = REPOS[repo].baseBranch;
  const stat = await sh(`git diff --stat origin/${base}...HEAD`, worktree);
  const patch = await sh(
    `git diff origin/${base}...HEAD -- . ':(exclude)*lock*'`,
    worktree,
  );
  return { stat: stat.stdout.trim(), patch: patch.stdout };
}

export async function removeWorktree(repo: RepoKey, worktree: string) {
  await sh(`git worktree remove --force ${JSON.stringify(worktree)}`, REPOS[repo].dir);
}
