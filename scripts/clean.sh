#!/usr/bin/env bash
# Tears down every agent worktree and branch. Run when a session goes sideways.
set -euo pipefail
set -a; source .env; set +a
WORKTREE_ROOT="${WORKTREE_ROOT:-$BEENS_ROOT/.beens-agents}"

for repo in beens-api beens-app-ionic-react beens-admin-panel; do
  dir="$BEENS_ROOT/$repo"
  [ -d "$dir/.git" ] || continue
  git -C "$dir" worktree list --porcelain | awk '/^worktree /{print $2}' \
    | grep "$WORKTREE_ROOT" || true \
    | while read -r wt; do git -C "$dir" worktree remove --force "$wt" || true; done
  git -C "$dir" worktree prune
  git -C "$dir" branch --list 'agent/*' | sed 's/^[* ]*//' \
    | while read -r b; do git -C "$dir" branch -D "$b" || true; done
done
echo "Worktrees and agent/* branches removed. Replays kept in $WORKTREE_ROOT/replays."
