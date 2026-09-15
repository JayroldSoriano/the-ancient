# The Ancient

A Dota 2–themed war-room for a LangGraph coding pipeline. You are the Ancient. Nothing is forged until you accept **The Draft**. Nothing reaches a remote until you call **The Push**.

Created by **[Jayrold Christian Soriano](https://github.com/JayroldSoriano)**.

## What you get

Three HUD tabs on port 3000, talking to a graph on port 2024:

| Tab | What it is |
|---|---|
| **Live console** | Issue a decree. Invoker plans. You accept or send back. |
| **The Field** | Open GitHub issues across the product repos. Oracle (Nerif) ranks them and nags leftover work. |
| **The Secret Shop** | Switch billing. Side shop is Claude Pro. Secret Shop is your Cursor plan. |

Slash commands in the console: `/clear` `/resume` `/field` `/shop` `/shop claude` `/shop cursor`.

## Roster

| Stage | Hero | Job |
|---|---|---|
| Draft | Invoker | Break the request into tasks |
| The Draft | **You** | Accept, edit, or ignore the plan |
| Forge | Tinker | Implement in a git worktree |
| Judge | Ancient Apparition | Review a diff he did not write |
| Replay | Clockwerk | Run checks. Exit codes only |
| Illuminate | Keeper of the Light | Report what passed and what did not |
| The Push | **You** | Allow relocate, or send it back |
| Relocate | Io | Push and open the PR |
| Counsel | Oracle | Rank issues. Does not forge |
| Secret Shop | Arc Warden | Pick which fountain pays |

Personas never soften the `RULES` block in `src/agents.ts`.

## Prerequisites

- Node 22 (22.13+ if you use The Secret Shop / Cursor SDK)
- `git`, `gh` (logged in)
- Product repos as git checkouts next to each other
- Claude Code login (`claude login`) **or** a Cursor ledger (HUD → The Secret Shop → Open the ledger)

Do not commit `.env`. Copy `.env.example` and fill paths only.

## Setup

```bash
git clone https://github.com/JayroldSoriano/the-ancient.git
cd the-ancient
npm install
cp .env.example .env
```

Edit `.env`:

- `ANCIENT_ROOT` — folder that contains the product repos
- `WORKTREE_ROOT` — where worktrees and replays live (keep this outside the product checkouts)
- `EVIDENCE_ROOT` — usually `$WORKTREE_ROOT/replays`
- `ANCIENT_API_DIR` / `ANCIENT_APP_DIR` / `ANCIENT_ADMIN_DIR` — folder names under that root (defaults: `api`, `app`, `admin`)
- `ANCIENT_API_GITHUB` / `ANCIENT_APP_GITHUB` / `ANCIENT_ADMIN_GITHUB` — `owner/name` for The Field

Then:

```bash
./scripts/bootstrap.sh
cd ui/apps/web
cp .env.example .env.local
cd ../../..
```

`ui/apps/web/.env.local` should be:

```
NEXT_PUBLIC_API_URL=http://localhost:2024
NEXT_PUBLIC_ASSISTANT_ID=ancient
```

`ancient` is the graph id in `langgraph.json`.

## Run

Two terminals.

**Graph** (from the repo root):

```bash
npx langgraphjs dev --port 2024 --no-browser
```

It often binds to `http://[::1]:2024`. Graph id: `ancient`.

**HUD:**

```bash
cd ui/apps/web
npm install
npm run dev -- --port 3000
```

Open [http://localhost:3000](http://localhost:3000).

If the HUD asks for a deployment URL, use `http://localhost:2024` and assistant `ancient`.

## How to play

1. **Live console** — type the work you want. Invoker writes a plan. Nothing is coded until you accept The Draft.
2. Edit the plan if the decomposition is wrong. Accept sends Tinker into a worktree. Kaldr judges. Rattletrap runs checks. Ezalor reports. Io waits.
3. **The Push** — relocate (PR), send back, or abandon. Io is the only node that `git push` / `gh pr create`.
4. **The Field** — consult Oracle, pick an issue, Issue as decree. Leftovers (open Drafts, dirty worktrees, empty env keys — names only) speak first.
5. **The Secret Shop** — Claude Code cannot bill Cursor. If Claude is out of mana, open the Cursor ledger and buy from that stall. Buyback, if enabled, walks there automatically on a session limit.

`/clear` stashes the current match. `/resume` restores the last one.

PRs open as drafts until you set `ANCIENT_PR_DRAFT=0`.

When a run goes sideways:

```bash
./scripts/clean.sh
```

Worktrees and `agent/*` branches are removed. Replays stay.

## Billing

| Stall | Who pays | How |
|---|---|---|
| Side shop | Claude Pro / Max | `claude login` (default) |
| Side shop (Console) | Anthropic API | `ANCIENT_USE_API_KEY=1` plus a Console key in `.env` |
| Secret Shop | Cursor plan | HUD → Open the ledger, or `CURSOR_API_KEY` in `.env` |

Set `ANCIENT_AGENT_PROVIDER=cursor` to start on the Secret Shop. `ANCIENT_BUYBACK=1` retries a Claude session-limit on Cursor.

## Layout

```
your-root/
  product-api/
  product-app/
  product-admin/
  the-ancient/          this repo
  .the-ancient/
    worktrees/
    replays/
    oracle/
```

Map product folders with `ANCIENT_*_DIR` and GitHub names with `ANCIENT_*_GITHUB` in `.env`. Checks live in `src/config.ts`. Bootstrap excludes `.agent/` from each product git so scratch files cannot be committed.

## Adjusting it

- Checks: `src/config.ts` → `REPOS[x].checks`. `required: true` blocks the PR on a non-zero exit.
- Prompts: `src/agents.ts`.
- `CLAUDE.md` in a worktree is picked up automatically.

## Credit

**Jayrold Christian Soriano** — design, roster, HUD, and pipeline.

- GitHub: [JayroldSoriano](https://github.com/JayroldSoriano)

Dota 2 hero names and Valve workshop portraits are used as labels and reference art. This is not an official Valve or Dota 2 product.
