#!/usr/bin/env bash
# Tears down every agent worktree and branch. Run when a session goes sideways.
set -euo pipefail
set -a; source .env; set +a
: "${ANCIENT_ROOT:?set ANCIENT_ROOT in .env}"
WORKTREE_ROOT="${WORKTREE_ROOT:-$ANCIENT_ROOT/.the-ancient}"
API_DIR="${ANCIENT_API_DIR:-api}"
APP_DIR="${ANCIENT_APP_DIR:-app}"
ADMIN_DIR="${ANCIENT_ADMIN_DIR:-admin}"

for repo in "$API_DIR" "$APP_DIR" "$ADMIN_DIR"; do
  dir="$ANCIENT_ROOT/$repo"
  [ -d "$dir/.git" ] || continue
  git -C "$dir" worktree list --porcelain | awk '/^worktree /{print $2}' \
    | grep "$WORKTREE_ROOT" || true \
    | while read -r wt; do git -C "$dir" worktree remove --force "$wt" || true; done
  git -C "$dir" worktree prune
  git -C "$dir" branch --list 'agent/*' | sed 's/^[* ]*//' \
    | while read -r b; do git -C "$dir" branch -D "$b" || true; done
done
echo "Worktrees and agent/* branches removed. Replays kept in $WORKTREE_ROOT/replays."
