import path from "node:path";

export type RepoKey = "api" | "app" | "admin";

export interface RepoConfig {
  key: RepoKey;
  dir: string;
  baseBranch: string;
  /** Deterministic verification commands. Exit code is the source of truth. */
  checks: { name: string; cmd: string; required: boolean }[];
}

const ROOT = process.env.BEENS_ROOT ?? path.resolve(process.cwd(), "..");

export const REPOS: Record<RepoKey, RepoConfig> = {
  api: {
    key: "api",
    dir: path.join(ROOT, "beens-api"),
    baseBranch: "uat",
    checks: [
      { name: "install", cmd: "bun install --frozen-lockfile", required: true },
      { name: "typecheck", cmd: "bun run tsc --noEmit", required: true },
      { name: "lint", cmd: "bun run lint", required: false },
      { name: "test", cmd: "bun test", required: true },
    ],
  },
  app: {
    key: "app",
    dir: path.join(ROOT, "beens-app-ionic-react"),
    baseBranch: "uat",
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
    dir: path.join(ROOT, "beens-admin-panel"),
    baseBranch: "uat",
    checks: [
      { name: "install", cmd: "npm ci", required: true },
      { name: "typecheck", cmd: "npx tsc --noEmit", required: true },
      { name: "build", cmd: "npm run build", required: true },
    ],
  },
};

export const WORKTREE_ROOT =
  process.env.WORKTREE_ROOT ?? path.join(ROOT, ".beens-agents");
export const EVIDENCE_ROOT =
  process.env.EVIDENCE_ROOT ?? path.join(WORKTREE_ROOT, "replays");
export const ORACLE_DIR = path.join(WORKTREE_ROOT, "oracle");
export const SHOP_FILE = path.join(WORKTREE_ROOT, "shop.json");
export const CURSOR_STORE = path.join(WORKTREE_ROOT, "cursor-store");
export const MAX_REVIEW_ROUNDS = Number(process.env.MAX_REVIEW_ROUNDS ?? 3);

/** GitHub owner for the three product repos. Issues are listed, never mutated, from here. */
export const GH_OWNER = process.env.BEENS_GH_OWNER ?? "Beens-App";

export const GH_REPOS: Record<RepoKey, string> = {
  api: `${GH_OWNER}/beens-api`,
  app: `${GH_OWNER}/beens-app-ionic-react`,
  admin: `${GH_OWNER}/beens-admin-panel`,
};
