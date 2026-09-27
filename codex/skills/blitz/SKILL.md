---
name: blitz
description: "Use only when the user explicitly invokes $blitz or clearly asks to execute an existing backlog in parallel conflict-free subagent waves with approval and verification gates. Do not use for planning-only work, a single bounded task, or autonomous plan-execute-review with orchestrator commits."
metadata:
  short-description: Run parallel subagent backlog blitzes
---

# blitz — parallel Codex subagent backlog clearance

Orchestrate a multi-wave parallel agent blitz against an open task backlog. Mirrors sprint planning + grooming + iterated sprint execution: Phases 0–3 are grooming and planning (refine, size, find conflicts, lock the wave plan); Phases 4–8 execute each wave as a mini-sprint with a hard gate between waves.

The unit of parallelism is **file ownership**, not the task. Codex subagents within a wave never own the same file. Each subagent verifies its work without editing a neighbor's files; the orchestrator coordinates integration repairs after the relevant writers finish.

## Invocation

```
$blitz [tracker=...] [verify=...] [concurrency=N] [max_waves=N] [time_budget=...] [repos=path1,path2]
```

All args optional. Anything not supplied is auto-detected in Phase 0.

| Arg | Default | Meaning |
|---|---|---|
| `tracker` | `itr` | Backlog source. Override with any shell command that lists open tasks (e.g. `gh issue list --state open --json number,title,body`). |
| `verify` | auto-detect | Verify-gate command. See detection table in Phase 0. |
| `concurrency` | `5` | Requested maximum; clamp to the active harness's available worker slots. |
| `max_waves` | unset | Hard cap on waves. |
| `time_budget` | unset | e.g. `2h`, `45m`. Stop launching new waves once elapsed; in-flight wave finishes. |
| `repos` | `.` | Comma-separated repo paths in scope. |

---

## Phase 0 — Preflight

Resolve config from the request and project, then present a compact preflight. Reuse existing execution authorization. Ask only about missing scope, material changes, or a decision the user reserved; do not reconfirm an already-approved run.

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
| `Cargo.toml` | `cargo test && cargo clippy --all-targets -- -D warnings && cargo fmt --check` |
| `package.json` | Read `scripts`. Compose the union of `test`, `lint`, `typecheck`, `format:check` that exist (e.g. `npm test && npm run lint && npm run typecheck`). If only `test` exists, just run that. |
| `pyproject.toml` | `pytest && ruff check . && ruff format --check .` (override if the project's tool config disagrees) |
| `go.mod` | `go test ./... && go vet ./... && test -z "$(gofmt -l .)"` |
| `Makefile` with `test` target | `make test` plus any of `lint`, `check`, `verify` that exist |
| nothing matched | **stop and ask the user** for the gate command |

For multi-repo runs, detect per repo and run each repo's gate from that repo's root.

Keep `--all-targets` when narrowing the default Rust lint gate to a package so test targets remain covered. Honor an explicit project gate; do not add unsupported compilation targets.

### Check concurrent work

Snapshot `git status --porcelain` and preserve existing edits. Put unrelated dirty paths in every worker's forbidden set. If the requested work must extend existing edits, assign that path to one owner with the original diff recorded; do not discard or silently absorb those edits.

Inspect the current sprint and unscoped blitz logs for a run without a `Blitz complete` terminal marker. If `sprint/CURRENT` is absent from the working tree, its HEAD version can help locate prior logs. A missing marker is evidence to investigate, not proof that another session is live: inspect available session state and timestamps. Resolve uncertain ownership before launching overlapping writers; continue independent planning. Never stash, reset, clean, or modify user files to make preflight pass.

### Confirmation block

Use this shape when useful; omit settled or irrelevant fields. Await an answer only for an unresolved decision:

```
Blitz preflight
  Tracker:      <list cmd> / <record cmd>
  Dep graph:    kgr present | kgr absent — skipping
  Verify gate:  <cmd>   (per repo if multi)
  Concurrency:  <N>
  Repos:        <paths>
  Existing work: <dirty paths and ownership exclusions>
  Other runs:   <none found | ended | active/uncertain with evidence>
  Stop when:    backlog empty | 2 no-progress waves | max_waves=<N> | time_budget=<T>

Will execute:
  1. Audit — list open tasks; kgr check per repo (if present); read shared files
  2. Resolve file ownership — read declared file sets; one batched planner subagent for any undeclared
  3. Build wave plan — file conflicts and semantic neighbors; persist to sprint/{folder}/blitz/wave-{N}.md (or sprint/_unscoped/blitz-{ts}.md if no in-flight sprint) and tracker epic
  4. Show the concrete wave plan; resolve any new scope or ownership decision
  5. Run waves with full-repo verify gate between each; auto-retry then quarantine on failure

<Unresolved decision, if any; otherwise proceed within established scope>
```

Apply user amendments and show what changed. If they decline execution, stop.

---

## Phase 1 — Audit

Once scope is resolved, run independent reads in parallel:

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

### Verify the file map

Normalize paths against the declared repository before building the conflict map. Resolve a repo-name prefix or unique suffix only when it identifies one path inside scope; ambiguous matches stay unresolved. Check that existing paths and named symbols match the task; explicitly new files may be absent. Preserve directory claims, including future files beneath them.

Reconcile an obvious move or rename from repository evidence and record the correction. If the intended target is ambiguous or changes scope, hold that task for clarification; do not halt unrelated tasks. Workers must report any additional write path before using it so ownership can be checked again.

### Separate human acceptance from implementation

A `visual-gate-only` task is one whose only remaining deliverable explicitly requires the PO's visual acceptance. Confirm this against its AC; a UI tag, screenshot requirement, or empty file list alone does not establish it. Keep such tasks open outside implementation waves and list them for `$sprint-review` or direct PO review. Implementation plus human acceptance still gets a worker for the implementation and evidence capture.

### Build the conflict map

- Group tasks by every file they own, including shared docs, registries, generated outputs, and directory claims. A directory claim conflicts with every descendant write, including a new file.
- Any file owned by ≥2 tasks is a **file conflict** — those tasks cannot share a wave.
- Cross-reference task bodies for **semantic conflicts** — shared symbol names, API shapes, one task explicitly removing what another depends on. For each affected task, record a `neighbors:` note (e.g. "task #58 is removing `tokenize`, do not call it").
- Honor declared dependencies (`blocked-by`, `parent`): a blocked task lands in a strictly later wave than its blocker.

If a task depends on a pending human verdict, hold that dependent too rather than dropping the dependency. Continue independent tasks; if none are ready, end execution with the pending decision and its blocked dependents listed.

When one task publishes an API that another consumes, establish the contract before the consumer starts. Prefer a prep task or a later consumer wave. Give an append-contended registry or export file one writer; section markers do not make simultaneous edits to the same file safe.

### Construct waves

Greedy bin-pack tasks into waves such that:

- Within a wave, no two tasks share a file.
- Wave size ≤ `concurrency`.
- Tasks with `blocked-by` land after the blocker's wave.
- File-conflicting tasks split into consecutive waves.

---

## Phase 3 — Persist and present the wave plan

Always write a wave log file. Resolve the path in this order:

1. **If `sprint/CURRENT` exists** and names a valid folder under `sprint/`: write to `sprint/{folder-from-CURRENT}/blitz/wave-{N}.md` where N is the next available wave number (max of existing `wave-*.md` filenames + 1, or 1 if none). Create `sprint/{folder}/blitz/` if missing.
2. **Else** (no in-flight sprint): write to `sprint/_unscoped/blitz-{ISO-timestamp}.md`. Create `sprint/_unscoped/` if missing. The `_unscoped` prefix sorts to the end and signals these aren't part of any sprint.

Sections: `Config`, `Waves`, `File conflicts`, `Semantic warnings`, `Pending human acceptance`, `Interventions` (empty), `Outcomes` (empty). This is the running blitz log — the orchestrator appends to it through Phases 4–8.

If the tracker supports it, also record a high-priority epic linking to the plan file with a wave-structure summary (e.g. `itr add -k epic -p high ...`).

Show the wave plan with task ownership, conflicts, and proposed resolutions. Proceed when covered by existing authorization; pause only for requested plan review or unresolved scope/ownership. Incorporate user amendments before the affected work.

---

## Phase 4 — Execute wave

Before spawning any wave subagent, read `references/wave-agent-contract.md` completely and use its ownership, verification, close, visual-gate, and prompt contracts. If no parallel subagent mechanism is available, stop before editing and explain that `$blitz` cannot execute in the current environment.

## Phase 5 — Monitor & unblock (during a wave)

Event-driven only — no polling. React to Codex background subagent completion notifications and any mid-run reports.

- **Mid-edit LSP diagnostics** are noise. Ignore until the subagent reports.
- **File-map drift or expanded ownership:** check the proposed actual paths against all live workers' full claims, including directories and preserved user edits. Resolve collisions by serializing or deferring the affected task before it writes; record the new assignment and notify affected workers.
- **Permission failure or missing dependency:** inspect the report and resolve routine setup within existing authorization. Do not bypass a denial or mutate a live worker's shared manifest. Assign shared repairs after its owner stops, obtain approval only where required, log the intervention, then resume the worker or start a replacement with the updated context.
- **Subagent finished but left the task open:** inspect its diff against the recorded starting state and run the wave gate. Close it as an intervention only when all AC permit closure. If it awaits PO smoke, keep it open for review rather than rerunning implementation or inferring acceptance from a green gate.
- **Verify-gate failure on completion**: auto-retry once. Launch a fresh background Codex subagent with the same prompt plus a `Previous attempt failed with:\n{tail of output}` block. Don't block the wave on this — other subagents keep running. Log the retry in `Interventions`.
- **Retry succeeds**: task closed, normal flow.
- **Retry fails**: mark the task as **quarantined** in `Outcomes` and defer to Phase 7. The wave continues.

---

## Phase 6 — Wave gate (between waves)

Once every wave subagent (including retries) has reached a terminal state — closed, quarantined, or stopped:

1. Run the full verify gate yourself in every repo in scope.
2. **Green**: proceed to Phase 7 (quarantine triage), then to the next wave.
3. **Red** on a slice no subagent owned: diagnose. If the fix is small, in scope, and preserves existing user edits, assign it to one owner or apply it after writers stop; log under `Interventions`. Otherwise surface the blocker. Do not launch the next wave on a red gate.

If editor diagnostics disagree with the finished gate, use the narrowest relevant compiler/check command before rerunning the full gate. Check only targets supported by this project; do not assume every Rust project builds WebAssembly.

---

## Phase 7 — Quarantine triage (BLOCKING — must complete before next wave)

**Soft quarantine — `awaiting PO visual smoke`.** Before the normal triage below, separate out any task a Codex subagent quarantined solely because it was a Visual-Gate story awaiting PO visual-smoke confirmation, not because the verify gate failed. These are NOT blocking: the code passed the verify gate and the subagent captured runtime evidence — only the PO's own eyes are pending. Do not stop-and-ask or re-run these. Leave them open, note `awaiting PO visual smoke` in `Outcomes`, let the wave proceed, and let them resolve at `$sprint-review` where the PO does the smoke and closes or files follow-ups. They do not count against the "every quarantined task must reach a terminal state before the next wave" rule below; a soft quarantine is a deferred close, not a failure.

For each remaining hard-quarantined task:

1. **Stop and ask the user** for unblock context — what's missing, what assumption was wrong, what the subagent didn't see. Append the response to `Quarantine triage notes` in the plan.
2. **Try again** with the user's context spliced into the subagent prompt.
3. If it succeeds, proceed.
4. If it still fails, **classify with the user**:
   - **Foundational** (other tasks depend on it, or it's load-bearing): **block the blitz**. Stop, surface a diagnostic, and resume only after the user fixes the underlying issue.
   - **Trivial / nice-to-have**: ask "skip this and continue?" If yes, mark `failed-skipped` in `Outcomes` and proceed. If no, block.

Every hard-quarantined task must reach a terminal state — `closed`, `failed-skipped`, or `blitz-blocked` — before the next wave launches. Soft quarantines (`awaiting PO visual smoke`, above) are the sole exception: they stay open across waves by design and resolve at `$sprint-review`.

---

## Phase 8 — Stop conditions & final report

Stop launching new waves when **any** fire:

- No agent-executable tasks remain; any required human acceptance stays open and is reported separately.
- Two consecutive waves closed zero tasks (poisoned backlog — surface and stop).
- `max_waves` reached.
- `time_budget` elapsed (in-flight wave finishes).
- A foundational quarantine blocks progress.

Then print a final report:

- **Outcomes** — per task: `closed` / `failed-skipped` / `blitz-blocked` / `pending`. Group by wave.
- **Pending human acceptance** — tasks withheld from waves and implementation tasks awaiting PO smoke, with evidence and the next reviewer/action. Their exclusion from scheduling does not mean they passed acceptance.
- **Files touched per task** — audit trail from declared/inferred file sets.
- **Wave timeline** — start/end timestamps, subagents per wave.
- **Interventions log** — every orchestrator unblock and its resolution.
- **Quarantine triage notes** — context the user supplied during triage. (High value for tuning future blitzes.)
- **Diff summary** — `git diff --stat` against the starting commit.
- **Next steps** — pending tasks (if any) plus a reminder to review and commit.

Append `Blitz complete` with the date, final gate result, and actual outcome to the log when execution ends, including an early stop. This marks the run as ended, not the backlog as accepted. On resume, recheck live ownership rather than trusting the marker alone.

Do **not** commit. Do **not** push. Do **not** open PRs unless the user asks.

---

## Principles

- **File ownership is the unit of parallelism, not the task.** Two tasks editing the same file must be serialized.
- **Warn subagents about neighbors.** Each subagent's prompt names every other subagent's files in its wave plus any semantic-conflict notes.
- **Repair through ownership.** Workers report failures outside their scope; the orchestrator assigns one writer after checking live ownership. A green gate never justifies overwriting a neighbor or user edit.
- **Unblock immediately.** If you can resolve a permission failure or missing dep yourself in seconds, do it and resume. Surface only what genuinely needs the user.
- **Reuse authorization.** Configuration and wave planning make execution concrete; they do not create two compulsory permission prompts. Honor any review point the user requested.

## Don't

- Don't launch work with unresolved scope or overlapping live ownership.
- Don't commit, push, or open PRs.
- Don't spawn subagents in worktrees — the shared tree is what powers self-healing.
- Don't skip the wave gate, even if every subagent reported green.
- Don't silently drop a quarantined task. Every task must end with an `Outcomes` entry.
- Don't run more subagents per wave than `concurrency` — orchestrator monitoring quality degrades past ~5.
