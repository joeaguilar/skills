---
name: dual-blitz
description: Plan and run a two-sided Codex blitz by splitting backlog work into two isolated lane artifacts, one for each main agent, so each agent can run its own inner blitz without communicating or editing the same files. Use when the user invokes /dual-blitz, /dual blitz, "dual blitz agent 1", "dual blitz agent 2", asks to split a sprint or backlog between two simultaneous agents, or wants clustered blitz execution with stricter file-ownership boundaries than /blitz. Do not use for ordinary single-agent backlog execution; use /blitz instead. Do not use for planning-only sprint grooming; use /sprint instead.
---

# /dual-blitz - two isolated blitz lanes

Split a sprint or backlog into two standalone execution lanes. Each lane is handed to a different main Codex session, and each main session may run its own inner `/blitz` waves. The outer split is stricter than `/blitz`: two main agents cannot coordinate, so a task may enter a lane only when its required writes are isolated from the other lane.

Borrow the backlog grooming and file-ownership discipline from `/sprint` and `/blitz`, the closeout handoff from `/sprint-review`, and the compact status/artifact style from `/proof-campaign`.

## Invocation

```text
/dual-blitz [plan] [input] [--agent-1 "area"] [--agent-2 "area"] [--concurrency-per-agent N] [--verify "..."] [--dry-run]
/dual-blitz agent 1 [path/to/agent-1.md]
/dual-blitz agent 2 [path/to/agent-2.md]
/dual blitz agent 1
/dual blitz agent 2
```

Modes:

- **Plan mode** is the default. It creates two lane artifacts.
- **Agent mode** reads one lane artifact and executes only that lane.

If the artifact path is omitted in agent mode, read `dual-blitz/CURRENT`, then open `agent-1.md` or `agent-2.md` inside that folder.

## Core Rule

File isolation outranks balance, speed, and story count.

Never put work in different lanes when the tasks may need to edit the same file, lockfile, generated output, migration chain, shared config, shared schema, or API contract. Put conflicting work in one lane, serialize it inside that lane, or park it. A lopsided but safe split is correct; a balanced unsafe split is a failed plan.

## Compact Output

Use short status blocks and put detail in artifacts:

```text
dual-blitz D4 plan
  source: sprint-3  runnable: 11  parked: 4
  A1: 6 tasks, 41 files, area=<area>
  A2: 5 tasks, 33 files, area=<area>
  conflicts: 7 resolved, 2 parked
  verify: <command>
  next: write artifacts -> launch agents
```

During agent mode:

```text
dual-blitz D4 A1 W2
  done: 3  active: 2  queued: 1  q: 0
  gate: green
  next: W3
```

Use fuller prose only for blocked scope, unsafe file overlap, destructive actions, credentials/security ambiguity, or a user-requested explanation.

## Phase 0 - Preflight

Resolve the work source in this order:

1. Explicit path or inline brief.
2. `sprint/CURRENT` and its `sprint/{folder}/plan.md`.
3. Open `itr` sprint backlog, if a sprint tag is obvious.
4. Open `itr` product backlog.
5. Recent conversation.

Then:

- Run `itr stats` and `itr agent-info` when `itr` is the tracker.
- Detect `kgr`; use it for file inference when present, otherwise use `rg`.
- Detect the verify gate like `/blitz` unless `--verify` is supplied.
- Inspect the dirty worktree before planning. Existing unrelated changes are not lane-owned unless the plan explicitly assigns them.
- Set `concurrency-per-agent` to 3 by default. Lower it when shell/session pressure is obvious.

Print one compact preflight:

```text
dual-blitz preflight
  source: <sprint folder | itr query | path | conversation>
  tracker: itr | artifact-only | other
  graph: kgr | rg
  verify: <command>
  concurrency: <N> per main agent
  artifacts: dual-blitz/dual-blitz-<N>-<date>-<slug>/{agent-1.md,agent-2.md}
```

Proceed without a confirmation here unless source or verify gate is ambiguous.

## Phase 1 - Build the Candidate Backlog

Create a candidate record for every task:

```text
id, title, source, priority, risk, acceptance, owned_files, deps, notes
```

Rules:

- Preserve `/sprint` story IDs, acceptance criteria, risk tags, dependencies, and declared `--files`.
- For missing files, run one batched planner pass, not one subagent per task.
- Keep file lists minimal. Include only files the task is expected to edit.
- Mark low-confidence file sets as `parked:file-uncertain` unless the task can be safely bounded by a whole directory or subsystem that no other lane will touch.
- Keep dependencies in the same lane when possible. If a dependency must cross lanes, put the dependent task in `parked:cross-lane-dependency`; do not rely on the two agents to coordinate.

## Phase 2 - Split Into Two Lanes

Build a conflict map before assigning lanes.

Hard conflicts, which cannot cross lanes:

- Exact file overlap.
- Same lockfile, generated file, migration sequence, schema, API contract, route table, build config, or package manifest.
- Write-mode formatter or codegen output that would touch both lanes.
- One task changes a public contract that the other task must consume.
- Either task has low-confidence file ownership.

Soft neighbors, which may cross lanes only with warnings:

- Shared symbols with read-only use.
- Same feature area but no shared writes.
- Tests in adjacent files that read the same fixture.

Choose lane areas by subsystem, not by count. Examples:

- `agent-1 = registry + installer CLI`; `agent-2 = explorer UI + markdown rendering`
- `agent-1 = backend API + database`; `agent-2 = frontend surface + e2e`
- `agent-1 = docs + reporting`; `agent-2 = test harness + CI`

Assignment rules:

- Prefer two coherent areas with disjoint owned file sets.
- Put all hard-conflicting tasks in one lane or park the later task.
- Forbid each lane from touching the other lane's owned files and parked conflict files.
- If a task needs both lanes' files, split it into two tasks only when the split has a clear contract and one side can finish without live coordination. Otherwise park it.
- If no safe two-lane split exists, write one executable lane and one artifact that says `no safe work assigned`; do not force unsafe parallelism.

## Phase 3 - Approval Gate

Print the complete lane plan once:

```text
dual-blitz plan
  run: dual-blitz-<N>-<date>-<slug>
  source: <source>
  verify: <command>

Agent 1 lane: <area>
  tasks: <ids/titles>
  owned: <top files/roots>
  forbidden: <top files/roots from agent 2>

Agent 2 lane: <area>
  tasks: <ids/titles>
  owned: <top files/roots>
  forbidden: <top files/roots from agent 1>

Parked:
  <id/title> - <reason>

Will write:
  dual-blitz/<run>/agent-1.md
  dual-blitz/<run>/agent-2.md
  dual-blitz/CURRENT

Approve, amend, or abort?
```

Wait for explicit approval. If `--dry-run`, stop after printing this block.

## Phase 4 - Write Lane Artifacts

Create exactly two agent-facing artifacts:

```text
dual-blitz/
  CURRENT
  dual-blitz-<N>-YYYY-MM-DD-<slug>/
    agent-1.md
    agent-2.md
```

`dual-blitz/CURRENT` contains only the run folder name. It is written before agents launch and is not edited by lane agents.

Each lane agent owns only its own artifact. Agent 1 may append outcomes to `agent-1.md`; Agent 2 may append outcomes to `agent-2.md`. Neither agent edits the sibling artifact or any shared run-state file.

Use this artifact shape:

```markdown
# Dual Blitz <run> - Agent <1|2>

**Mode:** execute-lane
**Source:** <sprint/itr/path>
**Lane goal:** <one sentence>
**Verify gate:** <command>
**Concurrency:** <N inner blitz workers max>
**Artifact owner:** agent-<N> only

## Safety Contract
- Execute only the Lane Backlog below.
- Edit only files listed in Owned Files, unless a task discovers a required extra file that is not forbidden; record it before editing.
- Never edit Forbidden Files.
- Never run write-mode formatters or code generators that can touch files outside Owned Files.
- If required work crosses into Forbidden Files, quarantine the task and continue with unrelated work.
- Do not commit, push, or rewrite history.

## Owned Files
- <file or root>

## Forbidden Files
- <file or root owned by the other lane>
- <parked conflict files>

## Neighbor Warnings
- <semantic warning or "none">

## Lane Backlog
| ID | Title | Risk | Files | Dependencies | Acceptance |
|----|-------|------|-------|--------------|------------|
| ... |

## Parked For This Lane
- <id/title> - <reason>

## Execution Instructions
Run a lane-contained `/blitz`:
1. Treat `Lane Backlog` as the complete tracker. Do not list or execute global backlog items.
2. Build inner waves exactly like `/blitz`: no two inner workers in the same wave may own the same file.
3. Pass each inner worker the Safety Contract, Owned Files, Forbidden Files, Neighbor Warnings, task body, and verify gate.
4. Run the full verify gate between inner waves.
5. Quarantine, do not improvise, when a task needs forbidden files or cross-lane coordination.
6. Append outcomes to this artifact only.

## Outcomes
<!-- Agent <N> appends compact wave outcomes here. -->
```

If `itr` supports safe tag updates according to `itr agent-info`, optionally tag lane tasks after approval with `dual-blitz-<N>` and `dual-agent-1` or `dual-agent-2`. The artifacts remain the source of truth; do not depend on tracker filters for safety.

## Agent Mode

When invoked as `/dual-blitz agent 1` or `/dual-blitz agent 2`:

1. Resolve and read the lane artifact.
2. Re-state the Safety Contract in the first status block.
3. Refuse to execute if:
   - the artifact is missing,
   - the lane number does not match the invocation,
   - `Owned Files` and `Forbidden Files` overlap,
   - no verify gate is declared,
   - the worktree already has uncommitted changes in forbidden files.
4. Run the lane-contained `/blitz` from the artifact's `Execution Instructions`.
5. Keep all status compact. Append detailed outcomes to the lane artifact.
6. End only after every inner worker is terminal and no background session needed for this lane is still running.

## Closeout

When both lane agents finish:

- For a sprint-backed run, use `/sprint-review` to review the sprint. The lane artifacts provide the blitz-log evidence and friction notes.
- For a non-sprint run, print a compact aggregate from both `Outcomes` sections and leave follow-up filing to `itr`.
- Do not merge the two artifacts into a shared report while lane agents are still running.

## Principles

- Two main agents do not communicate; the artifacts must contain everything they need.
- File ownership is the outer split. Inner `/blitz` waves still use file ownership inside each lane.
- Parked work is a successful safety outcome when the alternative is cross-lane collision.
- One approval starts the run; after that, lane agents work from artifacts.
- Verification, not optimism, is the done gate.

## Don't

- Don't let both lanes touch the same file, even for a "small" edit.
- Don't put one task in both artifacts.
- Don't use a shared mutable JSON/state file after launch.
- Don't ask the two agents to coordinate by chat.
- Don't run write-mode formatters, codegen, migrations, or package-manager mutations unless their outputs are wholly inside one lane's Owned Files.
- Don't have lane agents edit `dual-blitz/CURRENT` or the sibling lane artifact.
- Don't run `/sprint-review` until both lanes have ended.
