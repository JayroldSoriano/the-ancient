import fs from "node:fs/promises";
import path from "node:path";
import { REPOS, WORKTREE_ROOT, type RepoKey } from "../config.js";
import { sh } from "./shell.js";
import { formatResets, loadShopFile } from "./shop.js";

export type LeftoverKind = "env" | "thread" | "worktree" | "blocked" | "github" | "mana";

export type Leftover = {
  id: string;
  kind: LeftoverKind;
  title: string;
  detail: string;
  action: string;
  threadId?: string;
};

const SKIP_ENV_KEYS = new Set([
  "POSTGRES_URI",
  "TAVILY_API_KEY",
  "LANGSMITH_API_KEY",
  "LANGSMITH_TRACING_V2",
  "LANGSMITH_PROJECT",
]);

function parseEnvKeys(raw: string, opts: { uncommentedOnly: boolean }): string[] {
  const keys: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const uncommented = trimmed.startsWith("#")
      ? opts.uncommentedOnly
        ? null
        : trimmed.replace(/^#\s*/, "")
      : trimmed;
    if (!uncommented) continue;
    const m = uncommented.match(/^([A-Z][A-Z0-9_]+)\s*=/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

function envValueEmpty(raw: string, key: string): boolean {
  const re = new RegExp(`^${key}\\s*=\\s*(.*)$`, "m");
  const m = raw.match(re);
  if (!m) return true;
  const v = m[1].trim().replace(/^['"]|['"]$/g, "");
  return v.length === 0;
}

async function envLeftovers(agentsRoot: string): Promise<Leftover[]> {
  const examplePath = path.join(agentsRoot, ".env.example");
  const envPath = path.join(agentsRoot, ".env");
  let example = "";
  let env = "";
  try {
    example = await fs.readFile(examplePath, "utf8");
  } catch {
    return [];
  }
  try {
    env = await fs.readFile(envPath, "utf8");
  } catch {
    return [
      {
        id: "env:missing-file",
        kind: "env",
        title: ".env is missing",
        detail: "The Ancient has no .env. Copy .env.example and set ANCIENT_ROOT.",
        action: "Copy .env.example to .env and fill ANCIENT_ROOT.",
      },
    ];
  }

  const required = parseEnvKeys(example, { uncommentedOnly: true }).filter(
    (k) => !SKIP_ENV_KEYS.has(k),
  );
  const present = new Set(parseEnvKeys(env, { uncommentedOnly: true }));
  const out: Leftover[] = [];

  for (const key of required) {
    if (!present.has(key) || envValueEmpty(env, key)) {
      out.push({
        id: `env:${key}`,
        kind: "env",
        title: `${key} is not set`,
        detail: "Named only. The value was not read.",
        action: `Set ${key} in .env (or comment it out of .env.example if unused).`,
      });
    }
  }
  return out;
}

async function githubLeftovers(): Promise<Leftover[]> {
  const res = await sh("gh auth status", process.cwd(), { timeoutMs: 15_000 });
  if (res.exitCode === 0) return [];
  const usesToken = /GH_TOKEN/.test(res.stderr + res.stdout);
  return [
    {
      id: "github:auth",
      kind: "github",
      title: "GitHub login failed",
      detail: usesToken
        ? "GH_TOKEN in the environment was rejected. The keyring login is unused while that variable is set."
        : "gh is not authenticated.",
      action: usesToken
        ? "Comment GH_TOKEN out of .env and use `gh auth login`, or replace the token."
        : "Run `gh auth login` on this machine.",
    },
  ];
}

type StoredThread = {
  thread_id: string;
  status?: string;
  updated_at?: string;
  values?: {
    request?: string;
    plan?: { summary?: string; branch?: string } | null;
    results?: unknown[];
    prUrl?: string;
    decision?: string | null;
    messages?: { kwargs?: { content?: unknown } }[];
  };
};

function firstHumanText(thread: StoredThread): string {
  const request = thread.values?.request?.trim();
  if (request) return request.slice(0, 140);
  const messages = thread.values?.messages ?? [];
  for (const m of messages) {
    const c = m.kwargs?.content;
    if (typeof c === "string" && c.trim()) return c.trim().slice(0, 140);
  }
  return thread.thread_id;
}

async function threadLeftovers(agentsRoot: string): Promise<Leftover[]> {
  const opsPath = path.join(
    agentsRoot,
    ".langgraph_api",
    ".langgraphjs_ops.json",
  );
  let raw: string;
  try {
    raw = await fs.readFile(opsPath, "utf8");
  } catch {
    return [];
  }
  let parsed: { json?: { threads?: Record<string, StoredThread> } };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return [];
  }
  const threads = Object.values(parsed.json?.threads ?? {});
  const out: Leftover[] = [];
  for (const t of threads) {
    const values = t.values ?? {};
    const openPlan = Boolean(values.plan) && !values.prUrl && values.decision !== "reject";
    const hot = ["error", "interrupted", "busy"].includes(t.status ?? "");
    if (!openPlan && !hot) continue;
    const title = firstHumanText(t);
    const waitingDraft = openPlan && !(values.results && values.results.length);
    out.push({
      id: `thread:${t.thread_id}`,
      kind: "thread",
      title: waitingDraft ? "A Draft is still on the table" : `Match ${t.status ?? "open"}`,
      detail: title,
      action: waitingDraft
        ? "Open Live Console, /resume that match, and Accept, edit, or ignore The Draft."
        : "Open Replays and finish or /clear that match.",
      threadId: t.thread_id,
    });
  }
  return out;
}

async function worktreeLeftovers(): Promise<Leftover[]> {
  const root = path.join(WORKTREE_ROOT, "worktrees");
  let names: string[] = [];
  try {
    names = await fs.readdir(root);
  } catch {
    return [];
  }
  const out: Leftover[] = [];
  for (const name of names) {
    const dir = path.join(root, name);
    const repo = name.split("-")[0] as RepoKey;
    if (!REPOS[repo]) continue;
    let blocked = "";
    try {
      blocked = (await fs.readFile(path.join(dir, ".agent/blocked.txt"), "utf8")).trim();
    } catch {
      blocked = "";
    }
    if (blocked) {
      out.push({
        id: `blocked:${name}`,
        kind: "blocked",
        title: `${name} is blocked`,
        detail: blocked.slice(0, 240),
        action: "Read .agent/blocked.txt in that worktree, then re-issue the decree or clean the worktree.",
      });
      continue;
    }
    const status = await sh("git status --porcelain", dir, { timeoutMs: 10_000 });
    if (status.exitCode === 0 && status.stdout.trim()) {
      out.push({
        id: `worktree:${name}`,
        kind: "worktree",
        title: `${name} has uncommitted work`,
        detail: status.stdout.trim().split("\n").slice(0, 6).join(" · "),
        action: "Inspect the worktree, commit, or run scripts/clean.sh if the run was abandoned.",
      });
    }
  }
  return out;
}

async function manaLeftovers(): Promise<Leftover[]> {
  const shop = await loadShopFile();
  if (shop.claude.status !== "empty") return [];
  const when = formatResets(shop.claude.resetsAt ?? null);
  return [
    {
      id: "mana:claude",
      kind: "mana",
      title: "Side shop is out of mana",
      detail:
        shop.claude.detail?.trim() ||
        (when
          ? `Claude Pro session limit. Fountain at ${when} (Asia/Manila).`
          : "Claude Pro session limit. The side shop is dry."),
      action:
        "Open The Secret Shop and buy from Cursor, or wait for the fountain.",
    },
  ];
}

export async function collectLeftovers(agentsRoot: string): Promise<Leftover[]> {
  const [env, github, threads, worktrees, mana] = await Promise.all([
    envLeftovers(agentsRoot),
    githubLeftovers(),
    threadLeftovers(agentsRoot),
    worktreeLeftovers(),
    manaLeftovers(),
  ]);
  return [...mana, ...env, ...github, ...threads, ...worktrees];
}
