import path from "node:path";

export type RepoKey = "api" | "app" | "admin";

export interface RepoConfig {
  key: RepoKey;
  dir: string;
  baseBranch: string;
  /** Deterministic verification commands. Exit code is the source of truth. */
  checks: { name: string; cmd: string; required: boolean }[];
}

function envOr(name: string, fallback: string): string {
  const v = process.env[name]?.trim();
  return v ? v : fallback;
}

const ROOT = envOr("ANCIENT_ROOT", path.resolve(process.cwd(), ".."));
const BASE = envOr("ANCIENT_BASE_BRANCH", "main");
const OWNER = envOr("ANCIENT_GH_OWNER", "your-org");

export const REPOS: Record<RepoKey, RepoConfig> = {
  api: {
    key: "api",
    dir: path.join(ROOT, envOr("ANCIENT_API_DIR", "api")),
    baseBranch: BASE,
    checks: [
      { name: "install", cmd: "bun install --frozen-lockfile", required: true },
      { name: "typecheck", cmd: "bun run tsc --noEmit", required: true },
      { name: "lint", cmd: "bun run lint", required: false },
      { name: "test", cmd: "bun test", required: true },
    ],
  },
  app: {
    key: "app",
    dir: path.join(ROOT, envOr("ANCIENT_APP_DIR", "app")),
    baseBranch: BASE,
    checks: [
      { name: "install", cmd: "npm ci", required: true },
      { name: "typecheck", cmd: "npx tsc --noEmit", required: true },
      { name: "build", cmd: "npm run build", required: true },
      { name: "test", cmd: "npm test -- --run", required: false },
      { name: "e2e", cmd: "npx playwright test --reporter=line", required: false },
    ],
  },
  admin: {
    key: "admin",
    dir: path.join(ROOT, envOr("ANCIENT_ADMIN_DIR", "admin")),
    baseBranch: BASE,
    checks: [
      { name: "install", cmd: "npm ci", required: true },
      { name: "typecheck", cmd: "npx tsc --noEmit", required: true },
      { name: "build", cmd: "npm run build", required: true },
    ],
  },
};

export const WORKTREE_ROOT =
  process.env.WORKTREE_ROOT ?? path.join(ROOT, ".the-ancient");
export const EVIDENCE_ROOT =
  process.env.EVIDENCE_ROOT ?? path.join(WORKTREE_ROOT, "replays");
export const ORACLE_DIR = path.join(WORKTREE_ROOT, "oracle");
export const SHOP_FILE = path.join(WORKTREE_ROOT, "shop.json");
export const CURSOR_STORE = path.join(WORKTREE_ROOT, "cursor-store");
export const MAX_REVIEW_ROUNDS = Number(process.env.MAX_REVIEW_ROUNDS ?? 3);

/** GitHub owner for the three product repos. Issues are listed, never mutated, from here. */
export const GH_OWNER = OWNER;

export const GH_REPOS: Record<RepoKey, string> = {
  api: envOr("ANCIENT_API_GITHUB", `${OWNER}/api`),
  app: envOr("ANCIENT_APP_GITHUB", `${OWNER}/app`),
  admin: envOr("ANCIENT_ADMIN_GITHUB", `${OWNER}/admin`),
};
