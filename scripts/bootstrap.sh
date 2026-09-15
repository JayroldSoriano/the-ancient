#!/usr/bin/env bash
# Prepares the three product repos to be driven by the agent graph.
# Idempotent — safe to re-run.
set -euo pipefail

[ -f .env ] || { echo "No .env — copy .env.example first."; exit 1; }
set -a; source .env; set +a

: "${ANCIENT_ROOT:?set ANCIENT_ROOT in .env}"
WORKTREE_ROOT="${WORKTREE_ROOT:-$ANCIENT_ROOT/.the-ancient}"
API_DIR="${ANCIENT_API_DIR:-api}"
APP_DIR="${ANCIENT_APP_DIR:-app}"
ADMIN_DIR="${ANCIENT_ADMIN_DIR:-admin}"

fail=0
check() { if eval "$2" >/dev/null 2>&1; then echo "  ok    $1"; else echo "  MISS  $1"; fail=1; fi; }

echo "Preflight"
check "git"                  "command -v git"
check "gh (GitHub CLI)"      "command -v gh"
check "gh authenticated"     "gh auth status"
check "bun"                  "command -v bun"
check "node >= 20"           "[ \"\$(node -v | cut -c2- | cut -d. -f1)\" -ge 20 ]"

echo
echo "Repos under $ANCIENT_ROOT"
for repo in "$API_DIR" "$APP_DIR" "$ADMIN_DIR"; do
  dir="$ANCIENT_ROOT/$repo"
  if [ ! -d "$dir/.git" ]; then echo "  MISS  $repo"; fail=1; continue; fi

  # Agent scratch files must never reach a commit. Local exclude, so this
  # never shows up in the repo's own .gitignore diff.
  ex="$dir/.git/info/exclude"
  grep -qxF '.agent/' "$ex" 2>/dev/null || echo '.agent/' >> "$ex"

  dirty=$(git -C "$dir" status --porcelain | wc -l | tr -d ' ')
  echo "  ok    $repo  (base=$(git -C "$dir" symbolic-ref --short HEAD), uncommitted=$dirty)"
  [ "$dirty" != "0" ] && echo "        note: uncommitted changes stay in your checkout, not the worktrees"
done

mkdir -p "$WORKTREE_ROOT/worktrees" "$WORKTREE_ROOT/replays"
echo
echo "Workspace: $WORKTREE_ROOT"
[ "$fail" = "0" ] && echo "Ready." || { echo "Fix the MISS lines above."; exit 1; }
