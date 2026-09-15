# beens-agents

A LangGraph orchestration layer over the Claude Agent SDK that runs
feature work across the three Beens repos, with you as the only thing
standing between an agent and a pull request.

## The roster

| Node | Hero | Role | Model |
|---|---|---|---|
| `plan` | Invoker — Kael, the Arsenal Magus | resolves a request into its exact components | Opus |
| `implement` | Tinker — Boush, the Artificer | builds, tests, rearms, builds again | Sonnet |
| `review` | Ancient Apparition — Kaldr, the Distant Cold | judges from outside, no stake in the code | Opus |
| `evidence` | Clockwerk — Rattletrap, the Cogwork Sentinel | no model at all; cogs and exit codes | — |
| `report` | Keeper of the Light — Ezalor | lights what was done and what was not | Opus |
| `pr` | Io — Wisp, the Fundamental | Relocate; the only path to a remote | — |
| counsel | Oracle — Nerif | ranks GitHub issues and leftover work; does not forge | Sonnet |
| shop | Arc Warden — Zet | Secret Shop; switches Claude Pro vs Cursor billing | — |
| gates | **the Ancient** (you) | nothing crosses without you | — |

Gate one is **the Draft**: Invoker has resolved the request, nothing is forged
until you accept. Gate two is **the Push**: Kaldr has passed it, Rattletrap has
the replay, and Io waits on your call. Verification artifacts live in
`replays/<task>/`.

Personas live in the first paragraph of each prompt in `src/agents.ts`,
above a `RULES` block that the flavour is explicitly not allowed to soften.
That separation is load-bearing — see the note at the top of the file.

## Shape of the system

```
plan  →  [YOU approve]  →  implement → review → evidence  →  report  →  [YOU approve]  →  PR
              ↑                  ↑_________________|                          |
              └──────────────────────────────────────────────────────────────┘
```

- **plan** — lead agent (Opus) decomposes the request into per-repo tasks
  with objectively checkable acceptance criteria. Writes files, not code.
- **implement** — coder agent (Sonnet) in its own git worktree. No remote access.
- **review** — a *separate* agent with a fresh context that sees the diff and
  the criteria, and can write only its verdict file.
- **evidence** — not an agent. Plain Node code that runs typecheck, lint,
  build, tests and records exit codes. This is what makes "it passed" a fact.
- **report** — synthesises the evidence against the criteria for you.
- **PR** — the only code with push and `gh` access, and it runs strictly
  after your approval.

## Design decisions worth knowing

**Worktrees, not branches.** Every task gets `git worktree add` into
`$WORKTREE_ROOT/worktrees/<repo>-<task>`. Parallel agents in one checkout
will silently clobber each other; this is the isolation boundary the whole
thing rests on.

**The reviewer never wrote the code.** Same model, different invocation,
empty context. A coder reviewing its own diff approves it every time.

**Evidence is measured, not reported.** The evidence node shells out and
records exit codes to `evidence/<task>/*.log`. If a required check did not
run, the report says so rather than inferring success.

**Authority is scoped at the tool layer.** `git push` and `gh` are
unreachable from every agent invocation. Only `nodes/pr.ts` can reach a
remote, and only downstream of `approve_work`.

**Loops are capped.** `MAX_REVIEW_ROUNDS` (default 3). On exhaustion the
task is marked `blocked` with a reason and surfaced to you rather than
spinning.

## Layout

```
~/code/
  beens-api/              your repos, untouched
  beens-app-ionic-react/
  beens-admin-panel/
  beens-agents/           this
  .beens-agents/
    worktrees/            one per task, created and destroyed per run
    replays/              verification artifacts, kept
    oracle/               Nerif's last counsel.json (not a worktree)
```

Nothing is written inside your three repos except commits on `agent/*`
branches in detached worktrees. Your working checkouts stay as you left them.

## Setup

```bash
cd beens-agents
npm install
cp .env.example .env        # set BEENS_ROOT
./scripts/bootstrap.sh      # preflight + per-repo .agent/ exclude
```

`langgraph dev` keeps its own local checkpoint store, so nothing else is
needed to get the gates working. `POSTGRES_URI` only matters if you later run
the graph standalone instead of under the dev server — at that point an
interrupt that does not survive a restart stops being a gate.

Two terminals:

```bash
# graph server
npx @langchain/langgraph-cli dev --port 2024

# chat UI
npx create-agent-chat-app@latest --project-name ui
cd ui && pnpm install && pnpm dev
# Deployment URL: http://localhost:2024   Graph ID: beens
```

`./scripts/clean.sh` removes every worktree and `agent/*` branch when a run
goes sideways. Replays are kept.

## First run

Point it at something you would be happy to throw away. PRs open as drafts
until you set `BEENS_PR_DRAFT=0`.

The gates emit the standard `HumanInterrupt` payload, so Agent Chat UI
renders accept / edit / respond / ignore controls with no custom code.
Editing the plan JSON at gate 1 changes what actually gets built.

The HUD at `ui/apps/web` (port 3000) has three tabs. **Live console** is the
pipeline. `/clear` stashes the current match and starts a blank one; `/resume`
restores the last cleared match. **The Field** lists every open GitHub issue
on the three Beens repos. Oracle (Nerif) ranks them and nags leftover work
(unpaid Drafts, blocked worktrees, missing env keys — names only). He does
not forge. "Issue as decree" sends the issue into a new console match.
**The Secret Shop** (Arc Warden) switches billing. Side shop is Claude Pro
(`claude login`). Secret Shop is Cursor (`@cursor/sdk` on your Cursor plan).
Claude Code cannot bill Cursor; these are two vendors. `/shop claude` and
`/shop cursor` switch from the console. Buyback walks to Cursor when Claude
hits a session limit.

## Billing

Default is Claude Pro/Max via `claude login`. Set `BEENS_USE_API_KEY=1` to
bill an Anthropic Console key instead.

Cursor's subscription does **not** pay the Claude Agent SDK. To spend Cursor
instead, open The Secret Shop, Open the ledger (browser login) or set
`CURSOR_API_KEY` in `.env` (do not commit it), then buy from that stall.
`BEENS_AGENT_PROVIDER=cursor` selects it at boot. `BEENS_BUYBACK=1` retries
a Claude session-limit on Cursor.

## Adjusting it

- Per-repo verification commands live in `src/config.ts` → `REPOS[x].checks`.
  `required: true` means a non-zero exit blocks the PR.
- Agent behaviour lives in `src/agents.ts`. These are the highest-leverage
  lines in the repo — the reviewer prompt in particular.
- Your existing `CLAUDE.md` files are picked up automatically, since each
  agent runs with `cwd` inside the worktree.

## Known rough edges

- A task retry re-enters `implement` in the same worktree, so the coder sees
  its own prior commits. That is usually what you want; if not, reset to base
  at the top of `implementNode`.
- Cross-repo tasks (API contract + client consumer) run in parallel and can
  disagree. `dependsOn` is captured in the plan but not yet enforced in the
  fan-out — add a topological pass in `fanOut` when you hit this.
- Playwright evidence is wired as a non-required check. Make it required and
  point it at a real spec before trusting UI claims.
