#!/usr/bin/env bash
# Prepares the three Beens repos to be driven by the agent graph.
# Idempotent — safe to re-run.
set -euo pipefail

[ -f .env ] || { echo "No .env — copy .env.example first."; exit 1; }
set -a; source .env; set +a

: "${BEENS_ROOT:?set BEENS_ROOT in .env}"
WORKTREE_ROOT="${WORKTREE_ROOT:-$BEENS_ROOT/.beens-agents}"

fail=0
check() { if eval "$2" >/dev/null 2>&1; then echo "  ok    $1"; else echo "  MISS  $1"; fail=1; fi; }

echo "Preflight"
check "git"                  "command -v git"
check "gh (GitHub CLI)"      "command -v gh"
check "gh authenticated"     "gh auth status"
check "bun"                  "command -v bun"
check "node >= 20"           "[ \"\$(node -v | cut -c2- | cut -d. -f1)\" -ge 20 ]"
check "ANTHROPIC_API_KEY"    "[ -n \"\${ANTHROPIC_API_KEY:-}\" ]"

echo
echo "Repos under $BEENS_ROOT"
for repo in beens-api beens-app-ionic-react beens-admin-panel; do
  dir="$BEENS_ROOT/$repo"
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
