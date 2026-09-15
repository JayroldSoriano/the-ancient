export type RepoKey = "api" | "app" | "admin";

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

export type Leftover = {
  id: string;
  kind: "env" | "thread" | "worktree" | "blocked" | "github" | "mana";
  title: string;
  detail: string;
  action: string;
  threadId?: string;
};

export type CounselPick = {
  repo: RepoKey;
  number: number;
  title: string;
  why: string;
};

export type Counsel = {
  at: number;
  fingerprint: string;
  speech: string;
  pick: CounselPick | null;
  ranked: CounselPick[];
  reminders: Leftover[];
  error?: string;
};

export type FieldSnapshot = {
  issues: FieldIssue[];
  leftovers: Leftover[];
  githubError: string | null;
  fingerprint: string;
  counsel: Counsel | null;
  oracleError?: string;
  reused?: boolean;
};

const FIELD_CACHE_KEY = "ancient:field:snapshot";

export function readFieldCache(): FieldSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FIELD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FieldSnapshot;
    if (!parsed || !Array.isArray(parsed.issues)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeFieldCache(snap: FieldSnapshot): FieldSnapshot {
  if (typeof window === "undefined") return snap;
  try {
    window.localStorage.setItem(FIELD_CACHE_KEY, JSON.stringify(snap));
  } catch {
    /* quota */
  }
  return snap;
}

/** Keep last Oracle speech when a cheap GET has no counsel. Never invent counsel. */
export function mergeFieldCache(snap: FieldSnapshot): FieldSnapshot {
  const prev = readFieldCache();
  return writeFieldCache({
    ...snap,
    counsel: snap.counsel ?? prev?.counsel ?? null,
  });
}

function graphUrl(apiUrl: string): string {
  return apiUrl.replace(/\/$/, "");
}

export async function fetchField(apiUrl: string): Promise<FieldSnapshot> {
  const res = await fetch(`${graphUrl(apiUrl)}/ancient/field`);
  if (!res.ok) {
    throw new Error(`Field ${res.status}`);
  }
  return (await res.json()) as FieldSnapshot;
}

export async function consultField(
  apiUrl: string,
  opts: { force?: boolean } = {},
): Promise<FieldSnapshot> {
  const qs = opts.force ? "?force=1" : "";
  const res = await fetch(`${graphUrl(apiUrl)}/ancient/field/counsel${qs}`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Counsel ${res.status}`);
  }
  return (await res.json()) as FieldSnapshot;
}

export function issueDecreeText(issue: FieldIssue): string {
  const body = issue.bodyPreview ? `\n\n${issue.bodyPreview}` : "";
  return (
    `GitHub ${issue.fullName}#${issue.number}: ${issue.title}\n` +
    `${issue.url}${body}\n\n` +
    `Implement this issue in the matching product repo (${issue.repo}). ` +
    `Do not expand scope past the issue.`
  );
}
