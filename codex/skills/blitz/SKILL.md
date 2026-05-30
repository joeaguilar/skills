---
name: blitz
description: >-
  Use this skill to orchestrate a parallel Codex subagent blitz that clears a
  task backlog by spawning conflict-free waves of subagents. Trigger when the
  user types `/blitz`, asks to "blitz the backlog", "execute a parallel agent
  blitz", "fan out the queue", "clear the open issues in parallel", "groom and
  sprint through the backlog", or similar phrasing. Language-agnostic: auto-detect
  the verify gate (Cargo, npm, pytest, Go, Make) and use the configured tracker
  (default `itr`). Do not trigger for serial single-task work or when the user
  only wants a plan without execution.
metadata:
  short-description: Run parallel subagent backlog blitzes
---

# blitz — parallel Codex subagent backlog clearance

Orchestrate a multi-wave parallel agent blitz against an open task backlog. Mirrors sprint planning + grooming + iterated sprint execution: Phases 0–3 are grooming and planning (refine, size, find conflicts, lock the wave plan); Phases 4–8 execute each wave as a mini-sprint with a hard gate between waves.

The unit of parallelism is **file ownership**, not the task. Codex subagents within a wave never own the same file. Self-healing happens at the verify gate: each subagent runs the full-repo gate before closing its task, so the wave converges even when subagents leave temporary breakage in shared dependencies.

## Slash invocation

```
/blitz [tracker=...] [verify=...] [concurrency=N] [max_waves=N] [time_budget=...] [repos=path1,path2]
```

All args optional. Anything not supplied is auto-detected in Phase 0.

| Arg | Default | Meaning |
|---|---|---|
| `tracker` | `itr` | Backlog source. Override with any shell command that lists open tasks (e.g. `gh issue list --state open --json number,title,body`). |
| `verify` | auto-detect | Verify-gate command. See detection table in Phase 0. |
| `concurrency` | `5` | Max parallel Codex subagents per wave. |
| `max_waves` | unset | Hard cap on waves. |
| `time_budget` | unset | e.g. `2h`, `45m`. Stop launching new waves once elapsed; in-flight wave finishes. |
| `repos` | `.` | Comma-separated repo paths in scope. |

---

## Phase 0 — Preflight & confirm (BLOCKING)

Resolve config from args + auto-detection, then present a single confirmation block. **No Codex subagent is spawned until the user approves.**

### Detect the tracker
- If `tracker=` was passed, use it verbatim.
- Otherwise default to `itr` (use it per the existing `itr` skill). Verify by running `itr stats` — if the binary is missing, or no `.itr.db` exists in the repo, **stop and ask the user** for a replacement: e.g. `gh issue list ...`, `linear-cli list ...`, or a path to a TODO file. Capture both a list-open command and a record-epic command.

### Detect the dep-graph tool
- If `kgr` is on PATH, use it per the existing `kgr` skill (`kgr check --format json --no-progress . || true` per repo).
- If absent, skip dep-graph audit. Note the absence in the confirm block — don't silently downgrade.

### Detect the verify gate
If `verify=` was passed, use it. Otherwise auto-detect from each repo root in this priority order:

| File present | Default verify gate |
|---|---|
| `Cargo.toml` | `cargo test && cargo clippy -- -D warnings && cargo fmt --check` |
| `package.json` | Read `scripts`. Compose the union of `test`, `lint`, `typecheck`, `format:check` that exist (e.g. `npm test && npm run lint && npm run typecheck`). If only `test` exists, just run that. |
| `pyproject.toml` | `pytest && ruff check . && ruff format --check .` (override if the project's tool config disagrees) |
| `go.mod` | `go test ./... && go vet ./... && test -z "$(gofmt -l .)"` |
| `Makefile` with `test` target | `make test` plus any of `lint`, `check`, `verify` that exist |
| nothing matched | **stop and ask the user** for the gate command |

For multi-repo runs, detect per repo and run each repo's gate from that repo's root.

### Confirmation block

Print exactly this shape and **wait** for explicit user approval ("yes" / "go" / "proceed"):

```
Blitz preflight
  Tracker:      <list cmd> / <record cmd>
  Dep graph:    kgr present | kgr absent — skipping
  Verify gate:  <cmd>   (per repo if multi)
  Concurrency:  <N>
  Repos:        <paths>
  Stop when:    backlog empty | 2 no-progress waves | max_waves=<N> | time_budget=<T>

Will execute:
  1. Audit — list open tasks; kgr check per repo (if present); read shared files
  2. Resolve file ownership — read declared file sets; one batched planner subagent for any undeclared
  3. Build wave plan — file conflicts and semantic neighbors; persist to sprint/{folder}/blitz/wave-{N}.md (or sprint/_unscoped/blitz-{ts}.md if no in-flight sprint) and tracker epic
  4. Show wave plan and ask AGAIN before spawning Wave 1
  5. Run waves with full-repo verify gate between each; auto-retry then quarantine on failure

Proceed? (or amend any of the above)
```

If the user amends ("use concurrency=3", "swap tracker"), apply and reprint. If they decline, stop.

---

## Phase 1 — Audit

After Phase 0 is approved, run in parallel:

1. List open tasks via the tracker's list command. Capture full body text — title, description, declared files, declared blockers/parents, priority.
2. For each repo in scope, `kgr check --format json --no-progress . || true` (skip if kgr absent). Note orphans, cycles, rule violations.
3. Read shared files that multiple tasks reference, so the planner has context for conflict reasoning.

---

## Phase 2 — Plan (grooming)

### Resolve file ownership

For each task, look in its body for an explicit file list — itr's `--files` field, a `Files:` line in the description, or YAML frontmatter. Tasks with declared files are ready.

For tasks **without** declared files, dispatch a **single synchronous planner subagent** with this prompt — verbatim:

> The following tasks lack declared file sets. For each task, read its body, search the codebase, and return a single JSON array `[{"task_id": ..., "files": [...], "confidence": "high"|"medium"|"low", "reasoning": "..."}]`. Use `kgr` if available (e.g. `kgr refs <symbol>`, `kgr query --who-imports <file>`), otherwise grep. Keep file lists minimal — only files the task definitely needs to edit. Do NOT modify any files. Report under 500 words plus the JSON.
>
> Tasks:
> {tasks-as-json}

Merge the planner's output back into the task list. Tasks the planner returned with `confidence: low` should be flagged in the wave plan for the user's attention.

### Build the conflict map

- Group tasks by every file they own.
- Any file owned by ≥2 tasks is a **file conflict** — those tasks cannot share a wave.
- Cross-reference task bodies for **semantic conflicts** — shared symbol names, API shapes, one task explicitly removing what another depends on. For each affected task, record a `neighbors:` note (e.g. "task #58 is removing `tokenize`, do not call it").
- Honor declared dependencies (`blocked-by`, `parent`): a blocked task lands in a strictly later wave than its blocker.

### Construct waves

Greedy bin-pack tasks into waves such that:

- Within a wave, no two tasks share a file.
- Wave size ≤ `concurrency`.
- Tasks with `blocked-by` land after the blocker's wave.
- File-conflicting tasks split into consecutive waves.

---

## Phase 3 — Persist plan & confirm waves (BLOCKING)

Always write a wave log file. Resolve the path in this order:

1. **If `sprint/CURRENT` exists** and names a valid folder under `sprint/`: write to `sprint/{folder-from-CURRENT}/blitz/wave-{N}.md` where N is the next available wave number (max of existing `wave-*.md` filenames + 1, or 1 if none). Create `sprint/{folder}/blitz/` if missing.
2. **Else** (no in-flight sprint): write to `sprint/_unscoped/blitz-{ISO-timestamp}.md`. Create `sprint/_unscoped/` if missing. The `_unscoped` prefix sorts to the end and signals these aren't part of any sprint.

Sections: `Config`, `Waves`, `File conflicts`, `Semantic warnings`, `Interventions` (empty), `Outcomes` (empty). This is the running blitz log — the orchestrator appends to it through Phases 4–8.

If the tracker supports it, also record a high-priority epic linking to the plan file with a wave-structure summary (e.g. `itr add -k epic -p high ...`).

Print the wave plan to the user — wave-by-wave list of tasks, file ownership, conflicts and how they're resolved, semantic warnings — and **ask once more** before spawning Wave 1. Accept edits ("move task 42 to wave 2", "drop task 58") and reprint.

---

## Phase 4 — Execute wave

For every task in the current wave, launch one Codex subagent in parallel. Use the active Codex subagent/background-session mechanism available in the environment. Each launch must include:

- Background execution, so all subagents in the wave can run concurrently.
- A short label, e.g. `Blitz task #42`.
- The task's repo path as the working directory.
- The per-subagent prompt template below.

If no parallel subagent mechanism is available, stop before editing and tell the user the blitz cannot execute in parallel in the current environment.

### Per-subagent prompt template

```
You are a wave subagent for blitz task {id}: {title}.

Task body:
{full body verbatim}

Files you OWN (only edit these):
{owned file list}

Files you must NOT touch (owned by neighbor subagents in this wave):
{neighbor file list}

Neighbor warnings (semantic conflicts to avoid):
{neighbor notes — e.g. "task #58 is removing util/parse.rs::tokenize, do not call it"}

Working directory: {repo path}

Prohibited commands — DO NOT run any of these under any circumstances:

  - DO NOT run `cargo fmt` — it operates crate-wide regardless of file args.
    Even `cargo fmt -- path/to/owned_file.rs` reformats the ENTIRE crate, wiping
    neighbor subagents' in-flight edits. Wiped neighbor edits in sprint-1
    W1.intervention-2 (~20min recovery via `git fsck --unreachable` blobs).
  - DO NOT run any other write-mode formatter, regardless of file args — same
    project-wide footgun pattern as `cargo fmt`:
      * `npm run format`, `npm run fmt`, `prettier --write`, `prettier -w`
      * `ruff format` (without `--check`), `black .`, `black <file>`
      * `gofmt -w`, `goimports -w`
      * Any wrapper script that shells out to the above

  READ-ONLY check variants ARE SAFE — they inspect without modifying and are
  expected as part of the verify gate:
      * `cargo fmt --check`            — safe (read-only)
      * `prettier --check`, `npm run format:check` — safe (read-only)
      * `ruff format --check`          — safe (read-only)
      * `gofmt -l` (lists drift, no write) — safe (read-only)

  If the verify gate's read-only check reports formatting drift OUTSIDE your
  owned files, do NOT auto-fix it with a write-mode formatter — surface the
  drift in your final report and let the orchestrator triage. Inside your
  owned files, hand-edit the offending lines instead of reaching for a
  write-mode formatter.

When you finish editing, run the full-repo verify gate from the repo root:
  {verify command}

Run it in the foreground and wait for it to finish in this same turn. Do not launch it as a background task and then end your turn, and do not defer the close to a later turn. The gate result and the close command below must both happen before you yield. A subagent that backgrounds the gate and stops leaves its task stranded: the orchestrator then has to inspect the work and close it.

It MUST exit zero. The full-repo gate is intentional — if another wave subagent left a temporary error in code outside your owned files, attempt to fix it; your verify run is also their safety net. If after best effort the gate is still red on something clearly outside your scope, stop and report.

Only after the gate is fully green:
  - Close this task in the tracker: {close command}
  - Report a one-paragraph summary of what you changed and the verify-gate output (last 10 lines).

Do NOT commit, push, or branch. The user reviews and commits at the end.
```

---

## Phase 5 — Monitor & unblock (during a wave)

Event-driven only — no polling. React to Codex background subagent completion notifications and any mid-run reports.

- **Mid-edit LSP diagnostics** are noise. Ignore until the subagent reports.
- **Permission failure** (denied tool, file outside its set, missing dep): read the report, apply the fix yourself (edit `Cargo.toml`/`package.json`/etc., grant the file path, install the missing tool), append to `Interventions` in the plan, then resume the subagent with a one-line note about what changed. If the current harness cannot resume a terminated background subagent, launch a fresh background Codex subagent with the same prompt plus the fix note instead.
- **Subagent finished its work but left the task open** (it backgrounded the gate and yielded before closing, or its gate went red only on a neighbor's in-flight code): don't re-run the work — it's already on disk. Each subagent owns a disjoint file set, so `git diff -- <its files>` isolates its changes unambiguously. Inspect them, run the wave gate yourself, and if green **close the task yourself** as an intervention (log it). When resume is unavailable, inspect-and-close is the fallback — not a re-spawn of completed work. *(sprint-4: 2 tasks closed this way — a background-yield, and a Wave-2 follower blocked on a sibling's transient red gate.)*
- **Verify-gate failure on completion**: auto-retry once. Launch a fresh background Codex subagent with the same prompt plus a `Previous attempt failed with:\n{tail of output}` block. Don't block the wave on this — other subagents keep running. Log the retry in `Interventions`.
- **Retry succeeds**: task closed, normal flow.
- **Retry fails**: mark the task as **quarantined** in `Outcomes` and defer to Phase 7. The wave continues.

---

## Phase 6 — Wave gate (between waves)

Once every wave subagent (including retries) has reached a terminal state — closed, quarantined, or stopped:

1. Run the full verify gate yourself in every repo in scope.
2. **Green**: proceed to Phase 7 (quarantine triage), then to the next wave.
3. **Red** on a slice no subagent owned: diagnose. If the fix is small and obvious, apply it yourself and log under `Interventions`. Otherwise stop and surface to the user. Do not launch the next wave on a red gate.

---

## Phase 7 — Quarantine triage (BLOCKING — must complete before next wave)

For each quarantined task:

1. **Stop and ask the user** for unblock context — what's missing, what assumption was wrong, what the subagent didn't see. Append the response to `Quarantine triage notes` in the plan.
2. **Try again** with the user's context spliced into the subagent prompt.
3. If it succeeds, proceed.
4. If it still fails, **classify with the user**:
   - **Foundational** (other tasks depend on it, or it's load-bearing): **block the blitz**. Stop, surface a diagnostic, and resume only after the user fixes the underlying issue.
   - **Trivial / nice-to-have**: ask "skip this and continue?" If yes, mark `failed-skipped` in `Outcomes` and proceed. If no, block.

Every quarantined task must reach a terminal state — `closed`, `failed-skipped`, or `blitz-blocked` — before the next wave launches.

---

## Phase 8 — Stop conditions & final report

Stop launching new waves when **any** fire:

- Backlog is empty.
- Two consecutive waves closed zero tasks (poisoned backlog — surface and stop).
- `max_waves` reached.
- `time_budget` elapsed (in-flight wave finishes).
- A foundational quarantine blocks progress.

Then print a final report:

- **Outcomes** — per task: `closed` / `failed-skipped` / `blitz-blocked` / `pending`. Group by wave.
- **Files touched per task** — audit trail from declared/inferred file sets.
- **Wave timeline** — start/end timestamps, subagents per wave.
- **Interventions log** — every orchestrator unblock and its resolution.
- **Quarantine triage notes** — context the user supplied during triage. (High value for tuning future blitzes.)
- **Diff summary** — `git diff --stat` against the starting commit.
- **Next steps** — pending tasks (if any) plus a reminder to review and commit.

Do **not** commit. Do **not** push. Do **not** open PRs unless the user asks.

---

## Principles

- **File ownership is the unit of parallelism, not the task.** Two tasks editing the same file must be serialized.
- **Warn subagents about neighbors.** Each subagent's prompt names every other subagent's files in its wave plus any semantic-conflict notes.
- **Self-healing is a feature.** When a subagent runs the full-repo verify gate, it often fixes another subagent's leftover errors. Don't try to prevent this — the gate is the convergence point.
- **Unblock immediately.** If you can resolve a permission failure or missing dep yourself in seconds, do it and resume. Surface only what genuinely needs the user.
- **Confirm twice, run once.** Phase 0 confirms config; Phase 3 confirms the wave plan. After that the orchestrator runs autonomously through Phases 4–8 unless a quarantine triage or red gate intervenes.

## Don't

- Don't proceed past Phase 0 or Phase 3 without explicit user approval.
- Don't commit, push, or open PRs.
- Don't spawn subagents in worktrees — the shared tree is what powers self-healing.
- Don't skip the wave gate, even if every subagent reported green.
- Don't silently drop a quarantined task. Every task must end with an `Outcomes` entry.
- Don't run more subagents per wave than `concurrency` — orchestrator monitoring quality degrades past ~5.
