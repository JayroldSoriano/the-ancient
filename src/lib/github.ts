import { GH_REPOS, type RepoKey } from "../config.js";
import { sh } from "./shell.js";

export type FieldIssue = {
  repo: RepoKey;
  fullName: string;
  number: number;
  title: string;
  url: string;
  state: string;
  updatedAt: string;
  labels: string[];
  assignees: string[];
  commentsCount: number;
  bodyPreview: string;
};

type GhIssue = {
  number: number;
  title: string;
  url: string;
  state: string;
  updatedAt: string;
  body?: string;
  comments?: number | { id?: string }[];
  commentsCount?: number;
  labels?: { name: string }[];
  assignees?: { login: string }[];
};

function preview(body: string | undefined): string {
  return (body ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
}

export async function listRepoIssues(repo: RepoKey): Promise<FieldIssue[]> {
  const fullName = GH_REPOS[repo];
  const res = await sh(
    `gh issue list --repo ${fullName} --state open --limit 100 ` +
      `--json number,title,url,state,updatedAt,body,labels,assignees`,
    process.cwd(),
    { timeoutMs: 30_000 },
  );
  if (res.exitCode !== 0) {
    throw new Error(`${fullName}: ${res.stderr.trim() || "gh issue list failed"}`);
  }
  const rows = JSON.parse(res.stdout || "[]") as GhIssue[];
  return rows.map((row) => ({
    repo,
    fullName,
    number: row.number,
    title: row.title,
    url: row.url,
    state: row.state,
    updatedAt: row.updatedAt,
    labels: (row.labels ?? []).map((l) => l.name),
    assignees: (row.assignees ?? []).map((a) => a.login),
    commentsCount:
      typeof row.commentsCount === "number"
        ? row.commentsCount
        : Array.isArray(row.comments)
          ? row.comments.length
          : typeof row.comments === "number"
            ? row.comments
            : 0,
    bodyPreview: preview(row.body),
  }));
}

export async function listAllIssues(): Promise<{
  issues: FieldIssue[];
  error: string | null;
}> {
  const keys = Object.keys(GH_REPOS) as RepoKey[];
  const settled = await Promise.allSettled(keys.map((k) => listRepoIssues(k)));
  const issues: FieldIssue[] = [];
  const errors: string[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") issues.push(...result.value);
    else errors.push(`${keys[i]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
  });
  issues.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { issues, error: errors.length ? errors.join(" · ") : null };
}
