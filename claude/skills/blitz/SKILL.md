---
name: blitz
description: Orchestrate a parallel agent blitz that clears a task backlog by spawning conflict-free waves of subagents. Trigger when the user types `/blitz`, or asks to "blitz the backlog", "execute a parallel agent blitz", "fan out the queue", "clear the open issues in parallel", "groom and sprint through the backlog", or similar phrasing. Language-agnostic — auto-detects the verify gate (Cargo, npm, pytest, go, Make, …) and defers to the configured tracker (default `itr`). Do NOT trigger for serial single-task work, or when the user just wants a plan without execution.
---

# blitz — parallel agent backlog clearance

Orchestrate a multi-wave parallel agent blitz against an open task backlog. Mirrors sprint planning + grooming + iterated sprint execution: Phases 0–3 are grooming and planning (refine, size, find conflicts, lock the wave plan); Phases 4–8 execute each wave as a mini-sprint with a hard gate between waves.

The unit of parallelism is **file ownership**, not the task. Agents within a wave never own the same file. Self-healing happens at the verify gate: each agent runs the full-repo gate before closing its task, so the wave converges even when agents leave temporary breakage in shared dependencies.

## Slash invocation

```
/blitz [tracker=...] [verify=...] [concurrency=N] [max_waves=N] [time_budget=...] [repos=path1,path2]
```

All args optional. Anything not supplied is auto-detected in Phase 0.

| Arg | Default | Meaning |
|---|---|---|
| `tracker` | `itr` | Backlog source. Override with any shell command that lists open tasks (e.g. `gh issue list --state open --json number,title,body`). |
| `verify` | auto-detect | Verify-gate command. See detection table in Phase 0. |
| `concurrency` | `5` | Max parallel agents per wave. |
| `max_waves` | unset | Hard cap on waves. |
| `time_budget` | unset | e.g. `2h`, `45m`. Stop launching new waves once elapsed; in-flight wave finishes. |
| `repos` | `.` | Comma-separated repo paths in scope. |

---

## Phase 0 — Preflight & confirm (BLOCKING)

Resolve config from args + auto-detection, then present a single confirmation block. **No agent is spawned until the user approves.**

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

**`--all-targets` is not optional, and it survives scoping.** Bare `cargo clippy` lints only the default targets — a lint in a test file passes the gate and ships. If you narrow the gate for speed (e.g. `cargo clippy -p <crate>` per agent, common on slow workspaces), the `--all-targets` must come with it: `cargo clippy -p <crate> --all-targets -- -D warnings`. *(sprint-9: a `match_wild_err_arm` in a test file cleared an unscoped per-crate Wave-1 gate, shipped in a commit, and surfaced in Wave-2 as a fresh ticket the orchestrator had to fix.)*

For multi-repo runs, detect per repo and run each repo's gate from that repo's root.

### Check the tree is safe to blitz (WARN — never mutate)

File-fence discipline assumes exactly one scheduler and no in-flight human edits. Both assumptions have broken. Check both, report both, **change nothing**.

1. **Another orchestrator in this tree?** Look for a wave log from a blitz that started and never finished: `sprint/{folder}/blitz/wave-*.md`, plus `sprint/_unscoped/blitz-*.md`. Resolve `{folder}` from `sprint/CURRENT` — and if that file is missing or deleted in the working tree, fall back to `git show HEAD:sprint/CURRENT` before concluding there is nothing to scan.

   The signal is a **missing terminal marker** — a log with no `Blitz complete` line (Phase 8 writes it) — not an empty `Outcomes` section. `Outcomes` fills *incrementally*, wave by wave, so it is non-empty for almost the entire window in which a collision can happen. *(Verified against the sprint-7 incident this rule exists to prevent: session A parked after W2, so by the time session B ran preflight the log already carried its W1 and W2 entries. An empty-`Outcomes` test would have printed "none detected" and waved session B straight into the collision. The `Blitz complete` marker is absent for that whole window and fires correctly.)*

   If a marker-less log is found, warn hard — name the file — and ask the PO to confirm no other session is live before proceeding. Two orchestrators fanning out against one tree both believe they own the fences, and neither does. A stale log from a blitz that finished without writing its marker will also warn; that is the intended cost — one PO question beats a silent collision. *(sprint-7: two sessions collided on the same tree; one task was touched by both and only recovered via a 180s quiescence window.)*

2. **Uncommitted work in the tree?** Run `git status --porcelain` (read-only). Report every dirty path. Do **not** stash, reset, checkout, restore, or clean, and do **not** suggest that the PO do so — just show the list. Then, whatever the PO decides, **add every uncommitted path to the do-not-touch neighbor set of every agent in every wave**. An agent must never edit a file with in-flight human work in it, and the orchestrator must not "fix" one to get a gate green — surface a gate that is red only on a dirty user file and ask. *(sprint-7: a Wave-1 gate went red on the user's uncommitted `gen.rs` and the orchestrator relocated a test module inside that in-flight file to get green.)*

### Confirmation block

Print exactly this shape and **wait** for explicit user approval ("yes" / "go" / "proceed"):

```
Blitz preflight
  Tracker:      <list cmd> / <record cmd>
  Dep graph:    kgr present | kgr absent — skipping
  Verify gate:  <cmd>   (per repo if multi)
  Concurrency:  <N>
  Repos:        <paths>
  Tree:         clean | N uncommitted path(s) — fenced from all agents: <paths>
  Other blitz:  none detected | WARNING: unfinished wave log <path> — confirm no other session is live
  Stop when:    backlog empty | 2 no-progress waves | max_waves=<N> | time_budget=<T>

Will execute:
  1. Audit — list open tasks; kgr check per repo (if present); read shared files
  2. Resolve file ownership — read declared file sets; one batched planner agent for any undeclared
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

For tasks **without** declared files, dispatch a **single batched planner agent** (foreground, `subagent_type: general-purpose`) with this prompt — verbatim:

> The following tasks lack declared file sets. For each task, read its body, search the codebase, and return a single JSON array `[{"task_id": ..., "files": [...], "confidence": "high"|"medium"|"low", "reasoning": "..."}]`. Use `kgr` if available (e.g. `kgr refs <symbol>`, `kgr query --who-imports <file>`), otherwise grep. Keep file lists minimal — only files the task definitely needs to edit. Do NOT modify any files. Report under 500 words plus the JSON.
>
> Tasks:
> {tasks-as-json}

Merge the planner's output back into the task list. Tasks the planner returned with `confidence: low` should be flagged in the wave plan for the user's attention.

### Verify declared files exist (BLOCKING on anomalies)

**Normalize before you judge.** A backlog is written by many hands over months and its paths will not share a base — some rooted at the repo, some carrying the repo name, some abbreviated to the interesting suffix. Resolve each declared path against the repo root, then against each configured repo, then by unique-suffix match, before calling anything missing. A path that resolves under *any* of those is fine; record the normalized form and move on. **Only a path that resolves nowhere is a finding** — and normalize *before* the conflict map, so two spellings of one file are recognized as one contended file. *(This is not hypothetical: rustglichur's sprint-11 backlog mixes `crates/…` and `rustglichur/crates/…` across 13 stories. A literal `ls` from the repo root calls 8 of them missing — every one a false positive, every one a blocking pause. A check that cries wolf on two thirds of the backlog gets switched off in a week.)*

Then, for the paths that survive normalization:

- Files the task explicitly marks NEW are skipped — absence is expected. So is a directory declaration: treat it as a claim on everything beneath it (and see the conflict map — a directory two tasks both claim is contended, even though no single file is).
- Where a task body names a symbol **as well as** a file (`the CommitTransform handler in app/z.rs`, `export dispatch in x/y.rs`), grep that the symbol is in that file. **This is the half that earns its keep** — a stale path that still exists is the miss an existence check cannot see.
- A path that resolves nowhere, or a symbol absent from its declared file, is a **plan-file mismatch**. Collect them all, print them under `plan-file mismatch` in the wave plan, and **pause for the user before spawning any agent**. Do not silently re-infer a replacement path.

Know what this does and does not buy you. It catches the *stale* map — a ticket groomed against an older tree than the one it will execute on. *(sprint-11 #844 declared the right file but named `CommitTransform` at `action_handler.rs:1057-1138`; a prior story had renamed that handler, so the symbol was gone from the tree while the path stayed valid. The symbol grep flags it; an `ls` never would.)* It does **not** catch the *incomplete* map — a task that declares three files and does its real work in four others it never mentioned. Nothing you can check before fan-out will: those files don't exist yet, and the task body doesn't name them. That gap is covered downstream, by the agent self-report in the prompt template and the Phase 5 re-check — not here. Don't mistake a green check for a complete map.

### Build the conflict map

- Group tasks by every file they own. **"File" includes docs** — `docs/**`, specs, ADRs, roadmaps, READMEs. A shared paragraph is contended exactly like a shared function: two stories, one file, last writer wins. Docs are not usually declared in a task's `--files`, so read task bodies for them and add them to the map by hand. *(sprint-11 serialized code contention correctly and shipped a stale spec anyway: a Wave-1 story wrote a claim into a research spec that a Wave-2 story invalidated without updating. It survived to review, caught only by a human reading the diff.)*
- Any file owned by ≥2 tasks is a **file conflict** — those tasks cannot share a wave.
- **A declared directory is a claim on everything beneath it**, including files that don't exist yet. Two tasks claiming one directory are contended even though no single file is — and a task that *creates* a file under a directory another task claims has collided, which a file-grain map cannot see. Keep directory declarations in the map at directory grain; do not silently narrow them to the files that happen to exist today. *(sprint-11: three stories declared the same `crates/bg-effects/cpp/` directory. The orchestrator narrowed the map to the specific files each was expected to touch, and a fourth story then created a NEW file in that directory mid-wave. No collision occurred — because that agent happened not to touch the shared file. Care, not design.)*
- Cross-reference task bodies for **semantic conflicts** — shared symbol names, API shapes, one task explicitly removing what another depends on. For each affected task, record a `neighbors:` note (e.g. "task #58 is removing `tokenize`, do not call it").
- Honor declared dependencies (`blocked-by`, `parent`): a blocked task lands in a strictly later wave than its blocker.

#### Cross-agent shared surfaces (decide before fan-out, surface at Phase 3)

File ownership can be perfectly clean and the wave still needs coordination — because one agent is *publishing* something another is *consuming*. `/sprint` may have flagged this on the story already; if it didn't, it's still yours to catch. Scan the wave's task bodies for:

- **A published API surface** — one task adds enum variants, trait methods, struct fields, or function signatures that another task in the same wave calls.
- **An append-contended shared file** — a file every agent must add a line to (a registry, a dispatch table, a barrel export, a single-translation-unit include site). *(C++ instance: a header containing non-inline free functions forces exactly one TU to include it, so every consumer's stanza lands in that one file.)*

When either is present, put a resolution in the wave plan and let the PO pick at Phase 3:

- **Option A — prep wave.** A single-agent wave lands the shared surface first: stub signatures, enum variants, and **per-agent section markers** in the append-contended file. The fan-out wave then fills bodies inside its own marker, touching nothing else. *(sprint-1's Wave-0 prep did this but missed pre-staging section markers in the one single-TU include site — costing an extra Wave-0.5 polish commit before the 3-agent fan-out could run.)*
- **Option B — designated publisher.** One fan-out agent owns the surface and must land it before consumers build against it; consumers stub or tolerate its absence (e.g. publish ahead with `#[expect(dead_code)]` / equivalent) and adopt the contract **from the prompt** rather than negotiating with the publisher mid-wave.

Name the chosen option and the exact shared symbols in every affected agent's prompt. Parallel agents racing on a cross-cutting API surface is the single largest source of mid-wave intervention in this workflow — a silently-shared surface is a wave you will have to babysit.

### Set aside visual-gate-only tickets (skip during the blitz)

Before bin-packing, pull any **visual-gate-only** ticket out of the wave plan entirely. A ticket is visual-gate-only if it is tagged `visual-gate-only`, **or** it is visual-scope (tag `visual`/`ui`/`render`, or rendering-path files) and its *only* acceptance is a Visual Gate (`LOOK AT / IGNORE / EXPECTED / CONFOUNDERS`) block with no code an agent could write and self-verify. A wave agent cannot close such a ticket — closing it means a human confirmed a visual result on the running app, which no agent can do.

**Ignore these during the blitz:** never assign them to a wave, leave them open, and record them in the wave plan and the Phase 8 report under `Deferred to /sprint-review — visual-gate-only`. They are resolved by the PO at `/sprint-review`, where the visual smoke happens under human eyes — not here.

This is distinct from a task that has real implementation work *plus* a visual gate: that one goes to a wave normally, the agent does the work and captures runtime evidence, and only the final PO smoke defers (the `awaiting PO visual smoke` soft-quarantine in Phase 7). Visual-gate-only means there is nothing for an agent to implement in the first place, so it never enters a wave at all.

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

Sections: `Config`, `Waves`, `File conflicts`, `Semantic warnings`, `Deferred to /sprint-review — visual-gate-only` (the tickets set aside in Phase 2; empty if none), `Interventions` (empty), `Outcomes` (empty). This is the running blitz log — the orchestrator appends to it through Phases 4–8.

If the tracker supports it, also record a high-priority epic linking to the plan file with a wave-structure summary (e.g. `itr add -k epic -p high ...`).

Print the wave plan to the user — wave-by-wave list of tasks, file ownership, conflicts and how they're resolved, semantic warnings — and **ask once more** before spawning Wave 1. Accept edits ("move task 42 to wave 2", "drop task 58") and reprint.

---

## Phase 4 — Execute wave

For every task in the current wave, dispatch one Agent in parallel:

- `subagent_type: general-purpose`
- `run_in_background: true`
- `description`: short, e.g. `Blitz task #42`
- `prompt`: the per-agent template below.

### Per-agent prompt template

```
You are a wave agent for blitz task {id}: {title}.

Task body:
{full body verbatim}

Files you OWN (only edit these):
{owned file list}

Files you must NOT touch (owned by neighbor agents in this wave):
{neighbor file list}

Neighbor warnings (semantic conflicts to avoid):
{neighbor notes — e.g. "task #58 is removing util/parse.rs::tokenize, do not call it"}

Working directory: {repo path}

First action — verify your file map before you write anything:
  `ls` every file in your OWN set, and grep it for any symbol your task body names
  (a function, handler, or dispatch site). If a declared file is missing, or the named
  symbol lives somewhere else, STOP and report the drift to the orchestrator before
  starting work — do not silently retarget.

  Likewise, if partway in your real file set grows BEYOND the list above (a new file,
  or an edit in a directory not listed), report that to the orchestrator too, and keep
  reporting it in your final summary. Your declared set is what the contention model was
  built from — a file you add that a neighbor also owns is a collision the plan never saw.
  (Seen in the wild: a task declared one file, never touched it, and landed a new file in
  a directory the plan had fenced for a different trio in the same wave. No collision
  occurred only because that agent happened to avoid the shared file. Care, not design.)

Prohibited commands — DO NOT run any of these under any circumstances:

  - DO NOT run `cargo fmt` — it operates crate-wide regardless of file args.
    Even `cargo fmt -- path/to/owned_file.rs` reformats the ENTIRE crate, wiping
    neighbor agents' in-flight edits. Wiped neighbor edits in sprint-1
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

Pre-close gate — run these yourself, BEFORE the verify gate, and confirm each exits 0:
  - the project's READ-ONLY format check (`cargo fmt --check`, `prettier --check`,
    `ruff format --check`, `gofmt -l` — never the write-mode variant, see prohibitions above)
  - the project's linter at its strictest, over ALL targets including tests
    (`cargo clippy --all-targets -- -D warnings`, or the project equivalent)

  If the format check flags YOUR files, fix them with a SINGLE-FILE formatter invocation
  scoped to a file you own — `rustfmt <your_file>`, `prettier --write <your_file>`,
  `gofmt -w <your_file>`. That is safe and is NOT the prohibited command: the ban is on the
  crate-/repo-wide variants (`cargo fmt`, bare `prettier --write`), which reformat neighbor
  files regardless of the paths you pass. If no single-file mode exists, hand-edit — the
  check prints a diff, so copy its `+` side. Never let the drift ride to the orchestrator
  gate: it is a safety net, not your primary check, and drift that reaches it becomes
  cross-territory cleanup for a retry agent or a neighbor forced to edit outside their
  scope. (sprint-2 Wave 5: an agent closed without the format check; the retry agent had to
  apply 10 cosmetic fixes inside that agent's files before the gate would pass. sprint-9 hit
  the same drift four times, and the orchestrator cleared every one with `rustfmt <file>`.)

  Report the exit status of BOTH checks as an explicit line in your final summary. "The
  verify gate was green" does not substitute — the whole point is that these ran separately.

When you finish editing, run the full-repo verify gate from the repo root:
  {verify command}

Run it in the FOREGROUND and wait for it to finish in THIS SAME TURN — do NOT launch it as a background task and then end your turn, and do NOT defer the close to a later turn. The gate result AND the close command below must both happen before you yield. An agent that backgrounds the gate and stops leaves its task stranded: the orchestrator then has to inspect your work and close it for you.

It MUST exit zero. The full-repo gate is intentional — if another wave agent left a temporary error in code outside your owned files, attempt to fix it; your verify run is also their safety net. If after best effort the gate is still red on something clearly outside your scope, stop and report.

Runtime-evidence gate — UI-touching / user-visible / behavioral diffs ONLY:
  A green verify gate is NOT enough to close a change a user can see or feel — a
  written value is not a wired feature, and green unit tests or a successful build
  do not prove the flow works. If your diff touches UI or any user-visible/behavioral
  surface, you MUST capture runtime evidence before closing: drive the actual flow
  end-to-end and/or take a Playwright screenshot (use `/verify` plus the playwright
  plugin). If your change "wrote a value", exercise the READ site and prove it
  consumes the value — don't stop at confirming the write.

  Pure non-UI work — refactors, backend-only logic, docs, config with no user-visible
  surface — is exempt from the RUNTIME-EVIDENCE requirement: don't stall a non-UI task
  hunting for a screenshot. The exemption is about screenshots only. It does NOT exempt
  you from the read-site question, which has no exemptions and runs in both directions:

    - Every route, not one. If the behavior has several entry points, "the read site"
      is plural — trace each one. Two of three traced is how a missing path ships green.
    - The inverse case. A task scoped as test-only ("add coverage", "close the baseline
      gap") is NOT thereby non-production work. Before closing, check whether your diff
      touched production source at all. If it did, name those sites explicitly in your
      report and say why a test-scoped change belongs there — a coverage task that
      quietly alters shipping behavior passes every gate by construction, because the
      gate is measuring the thing you changed. (Seen in the wild: a story typed
      `test(...)` end to end hardcoded PRNG seeds at the production apply path, made a
      whole effect family deterministic in the shipping app, and raised the coverage
      floor as its reward. Nothing objected.)

Visual Gate PO-smoke gate — stories whose AC contains a Visual Gate block ONLY:
  If this task's AC contains the `LOOK AT / IGNORE / EXPECTED / CONFOUNDERS` Visual Gate
  block (itr #203 makes /sprint require it for visual-scope stories), you MUST NOT
  self-close on green gate + your own screenshot alone. Instead:
    1. Capture your runtime evidence as above (drive the flow / screenshot).
    2. Report your work as CLOSE-PENDING, not closed: describe the visual change in
       observational terms keyed to the AC's LOOK AT / EXPECTED lines, and explicitly
       ask the PO to confirm via `cargo native` (the exact action + what to look for).
    3. Do NOT run the close command yet. Wait for PO confirmation within the wave window.
    4. If the PO confirms: run the close command.
    5. If the PO is unavailable within the wave window: QUARANTINE the task (leave it
       open, report `awaiting PO visual smoke`). Do NOT self-close. The orchestrator's
       Phase 7 treats this as a soft quarantine — the wave still proceeds and the story
       resolves at /sprint-review under PO eyes.

Only after the gate is fully green (and, for UI/behavioral diffs, runtime evidence is captured; and, for Visual-Gate stories, the PO has confirmed the smoke):
  - Close this task in the tracker: {close command}
  - Report a one-paragraph summary of what you changed and the verify-gate output (last 10 lines).

Do NOT commit, push, or branch. The user reviews and commits at the end.
```

---

## Phase 5 — Monitor & unblock (during a wave)

Event-driven only — no polling. React to background-agent completion notifications and any mid-run reports.

- **Mid-edit LSP diagnostics** are noise. Ignore until the agent reports.
- **Agent reports file-map drift or a file set wider than declared**: re-run the conflict check for that task against the *actual* set before letting it proceed. Diff the widened set against every live neighbor's **declared** set — including any directory they declared — **not** against the narrowed map you built from the files you expected them to touch. Those are different questions, and only the first one is sound: a neighbor who claimed a directory owns the file your agent just created in it, even though that file was in nobody's map at Phase 2. If the widened set collides, stop that agent and defer its task to the next wave rather than discovering the overlap in the diff. A file set is a claim, not a fact — re-check it when the claim changes.
- **Permission failure** (denied tool, file outside its set, missing dep): read the report, apply the fix yourself (edit `Cargo.toml`/`package.json`/etc., grant the file path, install the missing tool), append to `Interventions` in the plan, then resume the agent via `SendMessage` with a one-line note about what changed. **If `SendMessage` is not available in your harness, you cannot resume a terminated agent — re-spawn a fresh background agent with the same prompt plus the fix note instead.**
- **Agent finished its work but left the task open** (it backgrounded the gate and yielded before closing, or its gate went red only on a *neighbor's* in-flight code): don't re-run the work — it's already on disk. Each agent owns a disjoint file set, so `git diff -- <its files>` isolates its changes unambiguously. Inspect them, run the wave gate yourself, and if green **close the task yourself** as an intervention (log it). `SendMessage` to resume a terminated agent is unavailable in some harnesses, so inspect-and-close is the fallback — not a re-spawn of completed work. *(sprint-4: 2 tasks closed this way — a background-yield, and a Wave-2 follower blocked on a sibling's transient red gate.)*
- **Verify-gate failure on completion**: auto-retry once. Spawn a fresh background agent with the same prompt plus a `Previous attempt failed with:\n{tail of output}` block. Don't block the wave on this — other agents keep running. Log the retry in `Interventions`.
- **Retry succeeds**: task closed, normal flow.
- **Retry fails**: mark the task as **quarantined** in `Outcomes` and defer to Phase 7. The wave continues.
- **Identical simultaneous failures across the wave** (API 429/overloaded errors, or several agents "completed without calling StructuredOutput" at once): a rate-limit cascade — infrastructure, not the tasks. Don't spend per-task retries and don't quarantine. Pause ~60s, halve the wave width, re-spawn only the failed tasks, and keep `concurrency` at the halved width for the rest of the run.

---

## Phase 6 — Wave gate (between waves)

Once every wave agent (including retries) has reached a terminal state — closed, quarantined, or stopped:

1. Run the full verify gate yourself in every repo in scope.
2. **Green**: proceed to Phase 7 (quarantine triage), then to the next wave.
3. **Red** on a slice no agent owned: diagnose. If the fix is small and obvious, apply it yourself and log under `Interventions`. Otherwise stop and surface to the user. Do not launch the next wave on a red gate.

---

## Phase 7 — Quarantine triage (BLOCKING — must complete before next wave)

**Soft quarantine — `awaiting PO visual smoke` (itr #204).** Before the normal triage below, separate out any task an agent quarantined solely because it was a Visual-Gate story awaiting PO `cargo native` confirmation (not a gate failure). These are NOT blocking: the code passed the verify gate and the agent captured runtime evidence — only the PO's own eyes are pending. Do **not** stop-and-ask or re-run these. Leave them open, note `awaiting PO visual smoke` in `Outcomes`, let the wave proceed, and let them resolve at `/sprint-review` where the PO does the smoke and closes (or files follow-ups). They do not count against the "every quarantined task must reach a terminal state before the next wave" rule below — a soft quarantine is a deferred close, not a failure.

For each remaining (hard) quarantined task:

1. **Stop and ask the user** for unblock context — what's missing, what assumption was wrong, what the agent didn't see. Append the response to `Quarantine triage notes` in the plan.
2. **Try again** with the user's context spliced into the agent prompt.
3. If it succeeds, proceed.
4. If it still fails, **classify with the user**:
   - **Foundational** (other tasks depend on it, or it's load-bearing): **block the blitz**. Stop, surface a diagnostic, and resume only after the user fixes the underlying issue.
   - **Trivial / nice-to-have**: ask "skip this and continue?" If yes, mark `failed-skipped` in `Outcomes` and proceed. If no, block.

Every *hard*-quarantined task must reach a terminal state — `closed`, `failed-skipped`, or `blitz-blocked` — before the next wave launches. Soft quarantines (`awaiting PO visual smoke`, above) are the sole exception: they stay open across waves by design and resolve at `/sprint-review`.

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
- **Deferred to /sprint-review — visual-gate-only** — every ticket set aside in Phase 2 as visual-gate-only, listed open with a one-line reminder that the PO resolves it at `/sprint-review`. These were never assigned to a wave; they are expected to be open at the end of the blitz, not a failure.
- **Files touched per task** — audit trail from declared/inferred file sets.
- **Wave timeline** — start/end timestamps, agents per wave.
- **Interventions log** — every orchestrator unblock and its resolution.
- **Quarantine triage notes** — context the user supplied during triage. (High value for tuning future blitzes.)
- **Diff summary** — `git diff --stat` against the starting commit.
- **Next steps** — pending tasks (if any) plus a reminder to review and commit.

Then **append a `Blitz complete` line to the wave log's `Outcomes` section** — date, tasks terminal, final gate result. This is the terminal marker Phase 0's second-orchestrator check reads: a wave log without it means a blitz started here and never finished. Write it even when the blitz stops early (`**Blitz complete (<date>) — stopped early: <reason>.**`); a log left marker-less because you gave up is indistinguishable from a live session and will warn the next orchestrator. Whatever ends the run — success, stop condition, or abandonment — ends by marking the log.

Do **not** commit. Do **not** push. Do **not** open PRs unless the user asks.

---

## If a run is orchestrated via the Workflow tool

Waves here are Agent-tool spawns, but when a backlog is cleared through a Workflow-tool script instead, two failure classes recur:

- Workflow scripts are plain JS — no TypeScript syntax. `node --check` a scratch copy before launching a large run; on a mid-run script error, edit the persisted script and relaunch with `{scriptPath, resumeFromRunId}` instead of restarting from zero.
- Schema-returning subagents: omit `model` so they inherit the session model — never pin a haiku-class model for structured output — and keep the schema's payload small (paths, IDs, verdicts; not bulk file content). Oversized returns fail StructuredOutput validation and surface as "completed without calling StructuredOutput".

---

## Principles

- **File ownership is the unit of parallelism, not the task.** Two tasks editing the same file must be serialized.
- **Warn agents about neighbors.** Each agent's prompt names every other agent's files in its wave plus any semantic-conflict notes.
- **Self-healing is a feature.** When an agent runs the full-repo verify gate, it often fixes another agent's leftover errors. Don't try to prevent this — the gate is the convergence point.
- **Unblock immediately.** If you can resolve a permission failure or missing dep yourself in seconds, do it and resume. Surface only what genuinely needs the user.
- **Confirm twice, run once.** Phase 0 confirms config; Phase 3 confirms the wave plan. After that the orchestrator runs autonomously through Phases 4–8 unless a quarantine triage or red gate intervenes.

## Don't

- Don't proceed past Phase 0 or Phase 3 without explicit user approval.
- Don't commit, push, or open PRs.
- Don't spawn agents in worktrees — the shared tree is what powers self-healing.
- Don't run a second orchestrator against a tree that already has one. The fences only hold with a single scheduler.
- Don't let any agent — or yourself at the gate — edit a file carrying uncommitted human work. Fence it, and surface a gate that's red only on such a file instead of fixing it.
- Don't skip the wave gate, even if every agent reported green.
- Don't silently drop a quarantined task. Every task must end with an `Outcomes` entry.
- Don't assign a visual-gate-only ticket to a wave. Skip it, leave it open, list it under `Deferred to /sprint-review — visual-gate-only`, and let the PO resolve it at `/sprint-review`. A wave agent can't smoke a visual gate.
- Don't run more agents per wave than `concurrency` — orchestrator monitoring quality degrades past ~5, and wider fan-outs of file-reading agents trip API rate-limit cascades.
- Don't fan out fresh file-reading agents to synthesize or review a finished wave — work from the agents' returned reports; if bulk re-reading is unavoidable, delegate it to one subagent.
