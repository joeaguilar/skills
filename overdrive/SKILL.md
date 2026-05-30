---
name: overdrive
description: Autonomous plan→execute→review loop that condenses /sprint, /blitz, and /sprint-review into one hands-off swarm. Pre-plans an implementation + exact owned-file set for EVERY ticket (the "arm" model), then runs conflict-free waves of parallel agents on the SAME branch, committing once per wave so any wave can roll back to a clean state. The ONLY human touch is a per-wave visual smoke test (accept → next wave; reject → roll back + iterate); everything else — planning, file assignment, execution, verify gates, quarantine triage, review — is autonomous. The loop continues until every ticket is closed or quarantined. Trigger when the user types `/overdrive`, or asks to "run the whole sprint autonomously", "plan execute and review end to end", "clear the backlog until every ticket is closed", "swarm the backlog hands-off", "autonomous sprint", "overdrive the backlog", or similar. `--auto`/`--trust` collapses the per-wave gate to one end-of-run review. Do NOT trigger for COACHED single-phase work: use `/sprint` when the user wants to plan WITH approval gates, `/blitz` for execution-only against an existing backlog WITHOUT the loop/commits, `/sprint-review` for review-only, or the `itr` skill for one-off issue filing. If the user wants to review the plan before any agent runs, point them at `/sprint` (coached) or `/overdrive --dry-run`.
---

# /overdrive — autonomous plan · swarm · review loop

`/overdrive` is the autonomous super-skill. It fuses the three coached skills into a single loop:

- **Plan** (what `/sprint` does, minus the gates) — turn a spec / `/plan` / conversation into a groomed `itr` backlog.
- **Pre-plan the arms** (new) — for *every* ticket, bake a concrete implementation plan + an exact owned-file set, so wave-agents are **arms executing a plan**, not explorers rediscovering the codebase.
- **Swarm** (what `/blitz` does, plus commits) — run conflict-free waves of parallel agents on the **same branch**, the orchestrator committing **once per wave** so any wave can roll back to a clean state.
- **Review** (what `/sprint-review` does, minus the ceremony) — fill Outcomes / Demo / Retro, file triage, close the epic.

The governing philosophy is **"how can the human let the agents do what they need to do?"** Every gate the coached trio uses for human approval is removed *except one*: a per-wave **visual smoke test**. The human looks at the running result, says *accept* or *reject*, and the loop keeps going until **every ticket is closed** (or quarantined). Planning, file ownership, execution, verify gates, quarantine triage, and review are all autonomous.

> **Coached vs autonomous.** If you want to approve the goal, the backlog, or each story — use the coached trio (`/sprint` → `/blitz` → `/sprint-review`). `/overdrive` is for *"go clear this, I'll glance at each wave."* The two paths write the **same artifacts** (`sprint/{folder}/plan.md`, `itr` epic + stories), so you can switch between them.

## Slash invocation

```
/overdrive [input | --backlog] [--auto|--trust] [--concurrency N] [--max-waves N]
           [--max-retries K] [--time-budget T] [--branch name] [--name slug]
           [--verify "cmd"] [--tracker "cmd"] [--repos p1,p2] [--retro|--no-retro] [--dry-run]
```

| Arg | Default | Meaning |
|---|---|---|
| `input` | — | A spec path, an inline brief, or nothing (use the recent `/plan` block or conversation). Drives **plan mode**. |
| `--backlog` | — | Skip planning; run against the existing **open `itr` backlog**. Drives **execute mode**. Auto-selected when there's no usable input but open tickets exist. |
| `--auto` / `--trust` | off | Collapse the per-wave visual gate into **one** end-of-run review. Fully hands-off between start and that review. **Strongly pair with `--time-budget`.** |
| `--concurrency N` | `5` | Max parallel arms per wave. **Hard cap 5** — higher is overridden with a warning (orchestrator monitoring degrades past ~5). |
| `--max-waves N` | unset | Circuit breaker on total waves. |
| `--max-retries K` | `2` | Re-planned retries per ticket before quarantine (so up to `K+1` total attempts). |
| `--time-budget T` | unset | e.g. `2h`, `45m`. Stop launching new waves once elapsed; the in-flight wave finishes. |
| `--branch name` | current | Run on a fresh branch cut from HEAD instead of the current branch. |
| `--name slug` | auto | Override the sprint-folder slug. Sanitized to `[a-z0-9-]`, capped 32. |
| `--verify "cmd"` | auto-detect | Override the verify gate (see Phase 0 detection table). |
| `--tracker "cmd"` | `itr` | Override the backlog source/record commands. |
| `--repos p1,p2` | `.` | Comma-separated repo paths in scope. |
| `--retro` / `--no-retro` | adaptive | Force or suppress the retro in Phase 8. Default is adaptive (friction-triggered). |
| `--dry-run` | off | Run plan + pre-plan + wave-pack and **print** them, then stop. No `itr` writes, no agent spawn, no commits. The way to preview an autonomous run. |

All flags optional. Anything unsupplied is auto-detected in Phase 0.

---

## Roles & artifacts

`/overdrive` plays **autonomous orchestrator**, not Scrum Master — it coaches little and *does* much.

- **You** are the Product Owner, but your only live decision is the per-wave visual smoke verdict. Everything else you've delegated by invoking the autonomous path.
- **Pre-plan agents** (Phase 2) turn tickets into baked plans + file assignments — read-only, never edit.
- **Arms** (Phase 4) are the execution swarm — one per ticket, each owns a disjoint file set and executes its baked plan.
- **The orchestrator** is the single git committer, the wave packer, the quarantine warden, and the reviewer.

Artifacts (identical schema to the coached trio, so they interoperate):

- **`itr` epic + stories** — the backlog. Tags `sprint-N`, `risk:<tier>`; `--files` written back by the pre-plan.
- **`sprint/{folder}/plan.md`** — the durable per-sprint record. **Exact `/sprint` schema** so `/sprint-review` can re-open it. `/overdrive` fills Outcomes / Demo / Retro itself in Phase 8.
- **`sprint/{folder}/overdrive/wave-N.md`** — per-wave run log (config, arms, files, interventions, retries, quarantines, commit SHA, smoke verdict).
- **`sprint/{folder}/overdrive/run.md`** — run metadata (mode, baseline SHA, config, `itr agent-info` snapshot, wave timeline).
- **`sprint/CURRENT`** — single line naming the in-flight sprint folder. Written at planning, repointed/removed at close.
- **Git commits** — one per accepted wave on the working branch (the rollback checkpoints).

---

## The loop at a glance

```
Phase 0  Preflight & baseline ........ resolve input, detect tooling, clean git baseline (stash WIP)
Phase 1  Plan (autonomous) ........... spec → itr epic + stories   [skipped in --backlog mode]
Phase 2  Pre-plan the arms ........... every ticket → impl plan + exact owned files + neighbors
Phase 3  Wave-pack ................... conflict graph → disjoint-file waves, topo-ordered
─ loop while open tickets remain ───────────────────────────────────────────────
Phase 4  Spawn wave ................. static file audit → swarm arms (same branch, no commits)
Phase 5  Monitor & self-heal ........ unblock, re-plan failures, quarantine after K retries
Phase 6  Wave gate & commit ......... full-repo verify (flaky double-check) → ONE commit
Phase 7  Visual smoke gate .......... accept → next wave | reject → rollback + iterate
─ stop: backlog empty · only-quarantined · 2 zero-waves · blocking-quarantine · max-waves · time-budget ─
Phase 8  Finalize ................... fill plan.md, adaptive retro, triage, close epic, report
```

The **only** human interaction inside the loop is Phase 7. With `--auto`/`--trust`, Phase 7 is skipped per wave and runs **once** in Phase 8 against the whole increment.

---

## Phase 0 — Preflight & baseline

Announce: `Phase 0 — Preflight & baseline`. Terse logging from here; no coaching essays.

1. **Resolve input → mode.** In order:
   - `--backlog` flag, or an input that's empty AND the tracker has open tickets → **execute mode** (skip Phase 1).
   - An input path that exists, inline brief, recent `/plan` block, or a clear conversational ask → **plan mode** (run Phase 1).
   - Nothing usable and no open tickets → **terminal no-op** (not a gate): report `Nothing to clear — no spec/brief given and no open tickets. Re-invoke with a spec, an inline brief, or --backlog.` and stop.

2. **Tracker.** Default `itr`. Run `itr stats`; if no `.itr.db`, **autonomously `itr init`** (if init fails, surface the error and stop — can't run without a tracker). Run `itr agent-info` once — prefer what it reports over anything hardcoded here, including the exact syntax for `update`/`close`/`--files`/body fields used below. If `--tracker` overrides, capture a *list-open* and a *close* command. Snapshot `agent-info` into `run.md`.

3. **Detect tooling (non-blocking surfaces):**
   - `kgr` on PATH → use for file inference (`kgr refs`, `kgr query --who-imports`) and the Phase 6 contract check. Note absence.
   - `STORY_STYLE.md` (canonical) / `CLAUDE.md` / `AGENTS.md` → mirror issue conventions. Note which won.
   - `docs/ROADMAP.md` → seed the Sprint Goal in plan mode; update in Phase 8. Note absence.
   - `sprint/CURRENT` → an in-flight sprint. In execute mode this is how the folder is found.

4. **Sprint number & folder.** In **execute mode**, if `sprint/CURRENT` names a valid folder, reuse that folder and its `sprint-{N}` (you're continuing an in-flight sprint — don't allocate a new number). Otherwise (plan mode, or no `CURRENT`): max `sprint-{N}` under `sprint/` + 1 (fallback: max `sprint-N` tag + 1; else `sprint-1`). Slug from `--name`, else 2–4 keywords from the goal (plan mode) or the input (execute mode), sanitized `[a-z0-9-]`, capped 32. Folder = `sprint-{N}-{YYYY-MM-DD}-{slug}`; if it collides, append `-{HHMM}`.

5. **Stale-ticket sweep (inherited from `/sprint`).** `git log --grep='closes\? #'` / `fixes\? #` / `resolves\? #` over the last 30 days; for each referenced ID still `open` in `itr`, it shipped but never closed. **Autonomously exclude** these from scope and log them under `run.md` → `Stale (excluded)`. (Autonomous skill — don't pause for the three-way choice `/sprint` offers; excluding is the safe default since the commit already shipped the work.)

6. **Git safety & baseline (load-bearing — this is what makes rollback safe).** The orchestrator commits, so the tree must be sane. Resolve each condition **autonomously** (no human gate) except the one hard blocker:
   - **Not a repo** → **hard stop** (the single unavoidable setup blocker): print `overdrive needs a git repo — run \`git init\` and retry (per-wave commits are load-bearing).` Don't auto-init; don't proceed.
   - **Detached HEAD** → create and check out `overdrive-{slug}`. Log it.
   - **`--branch name`** → `git checkout -b name` from current HEAD.
   - **No commits yet** → `git commit --allow-empty -m "overdrive: baseline"`, then confirm it landed (`git rev-parse HEAD` exit 0).
   - **Dirty tree** → **don't commit the user's WIP onto their branch, and don't gate on it — stash it.** `git stash push --include-untracked -m "overdrive: pre-run WIP (sprint-N)"`. This preserves their in-flight work in a recoverable stash *and* leaves a clean baseline. Surface the stash ref in the summary with how to restore it (`git stash list` / `git stash pop`). (Matches `/blitz`'s clean-tree precondition, but autonomous — no pause.)
   - Capture `BASELINE_SHA = git rev-parse HEAD` (now a clean, committed state). Record in `run.md`. Verify clean: `git diff-index --quiet HEAD --` must exit 0 — if not, surface and stop (never run a swarm on a dirty tree).

7. **Config & verify gate.** Resolve `concurrency` (cap 5, warn-and-clamp if higher), `max-waves`, `max-retries` (2), `time-budget`, `--auto`/`--trust`. **`--auto` runaway backstop:** if `--auto` is set and *neither* `--time-budget` nor `--max-waves` is given, set a default `max-waves = 2 × open-ticket-count` and warn `Auto mode with no time/wave cap — backstopping at <N> waves; override with --max-waves/--time-budget.` (The poisoned-wave and only-quarantined stops still bound a runaway; this is the belt to that suspenders.) Auto-detect the verify gate per repo unless `--verify`:

   | File present | Default verify gate |
   |---|---|
   | `Cargo.toml` | `cargo test && cargo clippy -- -D warnings && cargo fmt --check` |
   | `package.json` | union of existing `test`/`lint`/`typecheck`/`format:check` scripts |
   | `pyproject.toml` | `pytest && ruff check . && ruff format --check .` |
   | `go.mod` | `go test ./... && go vet ./... && test -z "$(gofmt -l .)"` |
   | `Makefile` w/ `test` | `make test` + any of `lint`/`check`/`verify` |
   | nothing matched | **stop and ask** for the gate command (one-time setup input, same class as the repo/tracker — *not* a workflow gate) |

   A no-op/`true` verify gate is **deliberately not** the fallback: unverified per-wave commits would let broken code ship every wave and defeat the self-healing model. Supply the gate once via `--verify` to stay fully hands-off on an unusual stack.

8. **Print the preflight summary** (transparency, not a gate — proceed straight through unless a genuine blocker above stopped you):

   ```
   overdrive preflight
     Mode:         plan (spec: <path>) | execute (existing backlog)
     Tracker:      itr (.itr.db)            kgr: present|absent
     Story style:  STORY_STYLE.md | inferred | base default
     Roadmap:      docs/ROADMAP.md (next: §A.16 [wide dep]) | absent
     Sprint:       sprint-N → sprint/sprint-N-YYYY-MM-DD-<slug>/
     Branch:       <branch>   Baseline: <sha7>   Tree: clean ✓ (stashed M pre-run changes → git stash pop to restore)
     Verify gate:  <cmd>      Concurrency: 5      Retries: 2
     Gate mode:    per-wave visual smoke | --auto (single end-of-run review)
     Stop when:    backlog empty | only-quarantined | 2 zero-waves | blocking-quarantine | max-waves=<N> | time-budget=<T>
     Stale:        none | excluded #<id> (shipped in <sha>)
   ```

---

## Phase 1 — Plan (autonomous; plan mode only)

Announce: `Phase 1 — Plan`. **Skipped entirely in execute mode.** No approval gate — this is the autonomous path. (Want to approve the plan first? Use coached `/sprint`, or `--dry-run`.)

1. **Draft one Sprint Goal** (`Deliver <value> by <change> so that <outcome>.`) + a short **Non-Goals** list. If `docs/ROADMAP.md` surfaced next-section candidates, seed from the top one and note any divergence into `## Open Assumptions` (for the Phase 8 roadmap update).

2. **Decompose into stories.** Each story: serves the goal, imperative title, sized to one arm (bounded files, single concern, runnable verify at the end). Split oversized stories; flag truly-unsplittable ones as spillover (`product-backlog,needs-sprint`).

3. **Risk tier** each (`risk:high|med|low`) and **order** risk → dependency → value. Set `--blocked-by` only on concrete signals (a kgr import edge, an explicit "X before Y").

4. **Build the sprint Definition of Done** (AC pass · verify gate green · behavior observable · docs updated when user-facing). It's appended to every story's AC.

5. **File to `itr`** (no gate — autonomous): epic first (`itr add -k epic -p high -f json`, tags `sprint-N`, body = goal + non-goals + DoD) — **capture the epic ID from the JSON** so stories can `--parent` it. Then `itr batch add` the stories (`kind: task`, `parent: <epic-id>`, `acceptance` = story AC + DoD, tags `sprint-N,risk:<tier>` + style tags). Capture all IDs. On partial failure: retry the item once, then surface the failed payload and resume — never roll back the epic.

6. **Write `sprint/{folder}/plan.md`** now (the `/sprint` Phase 6 schema verbatim — `# Sprint-N`, **Sprint Goal**, **Epic**, **Created**, **Story style**, `## Non-Goals`, `## Definition of Done`, `## Sprint Backlog` table, `## Spillover`, `## Open Assumptions`, empty `## Outcomes` / `## Demo` / `## Retro` stubs). Write `sprint/CURRENT` = folder name.

---

## Phase 2 — Pre-plan the arms (the ARM model — autonomous)

Announce: `Phase 2 — Pre-plan`. This is the innovation. **Blitz agents discover files at execution time; overdrive bakes the plan at *plan* time so agents are arms, not explorers.** Cheaper conflicts (found now, not mid-wave), faster agents (no rediscovery), tighter waves.

1. **Fan out pre-plan agents over every open ticket** (parallel, read-only). One agent per ticket (or batched in groups), `subagent_type: general-purpose`. Each reads the ticket body + AC, searches the codebase (`kgr refs`/`kgr query --who-imports` if present, else grep), and returns:

   ```json
   { "ticket_id": N, "files": ["src/a.rs", "src/b.rs"], "confidence": "high|medium|low",
     "plan": "3–6 concrete imperative steps the arm will follow",
     "api_surface": ["public symbols this ticket adds/changes/removes"],
     "semantic_neighbors": ["#M removes tokenize — don't call it"],
     "blocked_by": [M], "reasoning": "why this file set" }
   ```
   Pre-plan agents **do not edit files**. Keep file sets minimal — only what the ticket must edit. **Multi-repo:** if the ticket body declares `Repo: path/to/repo`, scope the search to that repo and return paths relative to its root (the orchestrator prepends `<repo>:` when writing back); otherwise search the whole tree.

2. **Write the baked plan back to the ticket** so the arm reads it from the tracker, not from orchestrator memory: `itr update <id> --files "<csv>"` plus the plan + neighbors into the ticket's body/context field (use the exact field/syntax `itr agent-info` reports — `--context` or the body-update flag). Persisting to the tracker means a crash is recoverable: re-running in `--backlog` mode picks up where it left off (closed tickets stay closed; open ones still carry their baked plan).

3. **Cycle detection on `blocked-by`** (DFS). A cycle makes wave ordering impossible. **Autonomously break it** by dropping the lowest-confidence edge in the ring (tie-break: drop the edge whose *source* ticket has the highest ID — stable and arbitrary), then **re-derive the topological order** so no `blocked-by` violations remain. Log `Cycle broken: #A→#B→#A, dropped #B→#A (low confidence)` to `run.md` (the Phase 8 retro flags it). Don't stop to ask.

4. **Low-confidence flags.** Tickets with `confidence: low` are kept but tagged in the wave log; if one later quarantines, the retro notes "low-confidence file ownership" as a likely cause.

---

## Phase 3 — Wave-pack (autonomous)

Announce: `Phase 3 — Wave-pack`. The pool for packing is **currently-open tickets minus any tagged `quarantined-sprint-N`** — quarantined tickets have left the active pool and must never re-enter (this exclusion is what makes the loop terminate). The same filter applies every cycle when the plan is re-derived (Phase 4).

1. **Conflict graph.** From the eligible pool, map every file → owning tickets. A file owned by ≥2 tickets is a conflict edge — those tickets can't share a wave. Add semantic-conflict edges from `semantic_neighbors`.

2. **Greedy bin-pack** respecting: topological order of `blocked-by` (a ticket lands strictly after its blockers' waves), no intra-wave file conflict, wave size ≤ `concurrency`.

3. **Write the wave plan** to `sprint/{folder}/overdrive/wave-plan.md` (waves, per-ticket owned files, neighbors, conflicts and how split). Print a one-screen summary. **No gate** — proceed to the loop. (`--dry-run` stops here after printing.)

---

## Phase 4 — Spawn the wave (autonomous)

Announce: `Phase 4 — Wave N`. The wave plan is **re-derived at the start of each cycle from the eligible pool = currently-open tickets minus those tagged `quarantined-sprint-N`** (re-run Phase 3's bin-pack on that pool). So newly-closed tickets drop out, genuinely-new tickets enter, and quarantined tickets stay excluded — the exclusion is load-bearing for termination.

1. **Record the pre-wave SHA** = the previous wave's commit, or `BASELINE_SHA` for wave 1. This is the rollback target for this wave.

2. **Static file audit** (cheap pre-flight against pre-plan staleness): for each ticket in the wave, re-confirm its owned files still exist and don't now collide with a wave-neighbor (a prior wave may have moved code). If a real collision surfaces, **defer** the offending ticket to the next cycle (don't launch a known conflict), **increment its attempt counter, and quarantine it instead if that counter now exceeds `max-retries`** (so a ticket can't defer forever). Log it. Scan owned-file directories for stale `*.tmp`/lock files and remove them.

3. **Spawn one arm per ticket in parallel** — `subagent_type: general-purpose`, `run_in_background: true`, using the **Per-arm prompt template** below. Agents work the **same branch / shared tree**; they never commit, push, branch, or spawn worktrees (the shared tree is what powers self-healing). **Per-arm timeout:** give each arm a wall-clock cap of `min(time-budget-remaining / (2 × concurrency), 30m)`; an arm that exceeds it without reporting is interrupted, logged to `Interventions`, and treated as a verify failure (re-plan path below) so one hung arm can't stall the wave or drain the budget.

---

## Phase 5 — Monitor & self-heal (autonomous)

Announce inline as events arrive. Event-driven; no polling. Mid-edit LSP noise is ignored until an agent reports.

- **Permission / missing-dep failure** → orchestrator fixes it (edit manifest, install tool, grant the path), logs to `Interventions`, resumes the arm via `SendMessage`.
- **Verify-gate failure reported by an arm** → **re-plan, don't just retry.** Dispatch a fresh pre-plan agent that sees the failure tail + original ticket → a new plan/file set. Then, **incrementing the ticket's attempt counter either way:**
  - If the new file set stays within the ticket's already-owned files (no new conflict) → respawn a fresh arm **in the same wave window**.
  - If it now needs a neighbor's file → **defer** the ticket to the next cycle's wave (re-pack), so the swarm stays conflict-free.
- **One attempt counter per ticket.** Every re-plan retry *and* every collision-defer (Phase 4 step 2) increments the same counter — there's no path that retries or defers without counting, so a ticket can't loop unbounded.
- **Quarantine-and-continue.** Once a ticket's attempt counter exceeds `max-retries` (default 2), mark it **quarantined**: leave it `open` in `itr` but add tag `quarantined-sprint-N` (so Phase 3/4 exclude it from the eligible pool), and record the full context where it's durable — `itr update <id>` body/context with `Quarantine (sprint-N, wave-M): K attempts. Last error:\n<last ~50 lines>\nRoot cause: <one-line orchestrator diagnosis>` (exact field per `agent-info`) — plus a line under `sprint/{folder}/overdrive/wave-N.md` → `Quarantine`. **The wave continues; the loop continues.** Quarantined tickets never re-enter a wave and surface in Phase 8. This is the guarantee that the loop always terminates.

---

## Phase 6 — Wave gate & commit (autonomous)

Announce: `Phase 6 — Wave N gate`. Once every arm has reached a terminal state (closed / quarantined):

1. **Full-repo verify gate** from each repo root.
2. **Flaky double-check** before trusting a red result: if red, re-run the gate up to **2 more times** on the unchanged tree. Green on a re-run → flaky gate; log `flaky gate detected` to `Interventions` and treat as green. Consistently red → real.
3. **Red on a slice no arm owned** → orchestrator diagnoses; if the fix is small and obvious, apply and log; if not, **roll the wave back** to the pre-wave SHA (see rollback mechanics), re-plan the implicated tickets, and re-run the wave. This counts against the **shared per-wave rework budget** (see box below). Never commit a red gate. This rollback is autonomous — *not* a human gate; the human's only verdict is the Phase 7 visual smoke.
4. **Light contract check** (kgr only, if present): for symbols the wave *removed* from its `api_surface`, run `kgr query --who-imports <symbol>`; if a still-open ticket's declared files import a removed symbol, log a `contract-warning` to the wave log and add a neighbor note for the next cycle. Non-blocking — surfaced, not gated.
5. **Commit the wave (single committer).** Green gate → snapshot. Use one `-m` per block so git lays out subject / body / trailer with the blank lines it expects:
   ```
   git add -A   # stages modified, deleted, and new (non-ignored) files; ignored files stay untracked, which is fine
   git commit -m "overdrive wave-N: closes itr#a, itr#b, itr#c (3 stories)" \
              -m "<one-line gate summary>" \
              -m "Co-Authored-By: <orchestrator model> <noreply@anthropic.com>"
   ```
   **Verify the commit landed:** capture `WAVE_N_SHA = git rev-parse HEAD`; it must differ from the pre-wave SHA *and* `git diff-index --quiet HEAD --` must exit 0 (a pre-commit hook can silently abort). If either check fails, stop and surface — do **not** launch wave N+1 on an uncommitted/dirty tree. The subject's `closes itr#…` list is the parseable bridge (`^overdrive wave-\d+: closes ((?:itr#\d+,? ?)+)`) so review tooling and a later manual `/sprint-review` can map commit → tickets.

> **Shared per-wave rework budget (= 3).** Phase 6 orchestrator rollbacks (red gate) and Phase 7 human rejects draw from **one** counter per wave, reset when the wave is finally accepted. When it hits 3, the orchestrator **autonomously quarantines** that wave's still-open tickets (tag `quarantined-sprint-N`, record context per Phase 5) and moves to the next cycle — **it does not ask.** This bounds per-wave iteration and keeps the loop terminating; the quarantines surface in Phase 8.

---

## Phase 7 — Visual smoke gate (the one human touch)

Announce: `Phase 7 — Wave N smoke`. **This is the only place a human is asked anything during the loop.** With `--auto`/`--trust`, skip this per-wave and do it once in Phase 8.

1. **Build the wave report** — unambiguous enough that *accept vs reject* is obvious (a vague report is the documented failure mode):
   ```
   Wave N — <K> closed, <Q> quarantined   (commit <sha7>)
     Stories:   itr#a ✓  itr#b ✓  itr#c ⚠ quarantined
     Diff:      git diff --stat (owned files)
     Verify:    tests ✓ | lint ✓ | typecheck ✓     (every check listed pass/fail)
     Smoke it:  <how to see it — run the app / visit URL / screenshot, per project>
     In scope to eyeball:   <user-visible behavior from this wave's stories>
     Out of scope (ignore): <adjacent stories' territory · sprint Non-Goals>
   ```
   If any verify check is yellow/partial, **highlight it** and offer three verdicts instead of two.

2. **Run the visual smoke** the project way (a project `/run` skill, `npm run dev` + screenshot, a CLI invocation, etc.). Show the result.

3. **Collect the verdict:**
   - **accept** → log the verdict + timestamp; reset the wave's rework budget; proceed to the next cycle.
   - **reject** → **roll back and iterate this wave** (mechanics below): capture the human's one-line reason, splice it into a fresh re-plan of the wave's tickets, re-run the *same* wave number. This draws on the **shared per-wave rework budget** (Phase 6 box). When that budget hits 3, the orchestrator **autonomously quarantines** the wave's tickets and moves on — it does **not** add a second ask here. (The visual smoke verdict is the only human gate; want it to keep trying? say so in your reject reason and it re-plans with that.)
   - **accept-with-followup** (offered when checks are mixed) → accept the wave, file a bug for the issue, continue.

### Rollback mechanics (reject path)

```
1. git status --porcelain  →  if untracked-not-ignored files exist (rare post-commit; e.g. a file you
   added by hand), back them up first — DON'T silently nuke human work:
   git stash push --include-untracked -m "overdrive-rollback-wave-N"
2. git reset --hard <pre-wave-SHA>
3. git clean -fd            (remove agent-created untracked files; respects .gitignore)
4. git diff-index --quiet HEAD --   MUST exit 0  (else surface "reset incomplete — resolve manually", stop)
5. Reopen the tickets this wave CLOSED (from wave-N.md → Closed:; never reopen quarantined ones):
   itr update <id> --status open     (syntax per agent-info; resyncs itr to the rolled-back git state)
6. Log the rollback + reason under wave-N.md → Interventions.
```
The step-1 stash is a **recoverable backup, not auto-restored** — popping it would re-introduce the very changes we're rolling back. It survives in `git stash list`; recover human files manually with `git stash pop` if needed. The retry starts from the clean pre-wave state.

---

## Loop control — stop conditions

The check runs **once per cycle, right after a wave is accepted (or auto-accepted) and before re-deriving the next wave plan.** Re-query open tickets, then test:

- **Backlog empty** (no open tickets remain — quarantined ones are tagged out, so they don't count) → success → Phase 8.
- **Only quarantined remain** (every open ticket is tagged `quarantined-sprint-N`) → exhausted → Phase 8 (triage there).
- **Poisoned** — maintain a `consecutive-zero` counter: after each accepted wave, if it closed zero tickets increment it, else reset to 0. If it reaches **2** *and* no attempts are in flight (no re-plan or defer pending), stop → Phase 8 (surface). Mid-attempt counts as progress, so a slow-but-moving sprint won't false-trigger.
- **A blocking quarantine** (a quarantined ticket that still-open tickets are `blocked-by`) → stop launching its dependents → Phase 8.
- **`max-waves` reached** → circuit-broken → Phase 8.
- **`time-budget` elapsed** → finish the in-flight wave (never kill mid-edit), launch no more → Phase 8.

**Why this always terminates:** every ticket ends `closed` or `quarantined` — re-plan retries and collision-defers share one bounded counter (Phase 5), the per-wave rework budget bounds rollback/reject iteration (Phase 6 box), and the four circuit-breakers above cap the outer loop. No path retries, defers, or rejects without a counter.

---

## Phase 8 — Finalize (autonomous review)

Announce: `Phase 8 — Finalize`.

1. **`--auto`/`--trust` end-of-run gate.** If per-wave gates were skipped, do the **one** visual smoke now against the whole increment: show the full run report + a combined smoke. Verdict:
   - **accept** → continue close-out.
   - **reject from wave M onward** → multi-wave rollback: stash untracked (recoverable backup, as in Phase 7), `git reset --hard <WAVE_M_SHA>`, `git clean -fd`. Then **reopen exactly the tickets each wave M+1…N CLOSED** — parse each `sprint/{folder}/overdrive/wave-{k}.md` `Closed:` line and `itr update <id> --status open`; **never reopen `quarantined-sprint-N` tickets** (they stay out of scope). After **2** end-of-run rejects, the orchestrator **autonomously** stops and reports kept-vs-discarded (it does not re-offer — re-run `/overdrive --backlog` to iterate further); this mirrors the bounded per-wave reject logic.

2. **Outcomes.** Plan-vs-actual table (every original ticket → final status), counts, completion rate, goal achievement (yes/partial/no — **quarantined ≠ accepted**), and any `git diff` not tied to a ticket. Read all `wave-*.md` for the friction view.

3. **Adaptive retro.** Required if any friction signal fired (quarantine · intervention · rollback/reject · bug · completion <80%); otherwise skipped. `--retro`/`--no-retro` override. When it runs: plan-vs-actual, friction log (root-cause each quarantine/intervention/rollback), 1–3 process-improvement action items, agent-learnings — written to `## Retro` and a standalone `sprint/{folder}/retro-{date}.md`.

4. **Triage filing** (autonomous, via `itr`, honoring `STORY_STYLE.md`): quarantined/rejected → `carryover` (`sprint-N+1-candidate`, `product-backlog`); bugs found → `bug` (`from-review-N`); retro items → `task` (`retro`,`process-improvement`). (Same tag taxonomy as `/sprint-review` so triage is indistinguishable from a coached close-out.)

5. **Fill `plan.md`** Outcomes / Demo / Retro in place (the `/sprint-review` section schemas — so the artifact reads identically whether overdrive or the coached trio produced it).

6. **Close out.** **Scan for blocking quarantines first:** for each quarantined ticket, check whether any open ticket lists it in `blocked-by`; if so, log it to `run.md` and **leave the epic open** (carryover). Otherwise close the epic only if **(a)** all goal-critical stories are closed (or conditionally accepted with a filed follow-up) **and** completion rate ≥ 80%, **or (b)** the increment was explicitly accepted at a visual gate: `itr close <epic-id> "Reviewed <date>. Outcome: <yes|partial|no>. <closed>/<total> accepted."` If any goal-critical story is quarantined/rejected, leave the epic open and file carryover. Repoint or remove `sprint/CURRENT`. If `docs/ROADMAP.md` exists, call `/roadmap --update` (non-blocking; pass any goal-divergence note from `## Open Assumptions`).

7. **Final report:**
   ```
   overdrive complete — sprint-N

     Goal:         <one sentence>            Achievement: yes | partial | no
     Waves:        <W> run, <accepted> accepted, <rejected> rolled back
     Stories:      <closed>/<total> closed, <Q> quarantined, <S> spillover
     Commits:      <sha7>…<sha7> on <branch>   (one per accepted wave)
     Quarantined:  itr#.. (<reason>)  →  filed carryover itr#..
     Time:         <elapsed> / budget <T>      Interventions: <N>
     Retro:        sprint/{folder}/retro-<date>.md | skipped (clean)

   Next: review the branch and merge/PR when ready. Re-run /overdrive to clear carryover.
   ```

Stop. Do **not** push or open a PR unless asked. Do not auto-start the next sprint.

---

## Per-arm prompt template

Each arm receives its **baked plan** — it doesn't rediscover. Inject the pre-plan values:

```
You are arm {id} in overdrive wave {N}: {title}.

Baked implementation plan (follow it; you may refine, but stay in your file set):
{plan steps from Phase 2}

Ticket body / AC:
{full body + acceptance verbatim}

Files you OWN — edit ONLY these:
{owned file list}

Files owned by neighbor arms in this wave — DO NOT touch:
{neighbor file list}

Semantic neighbor warnings:
{e.g. "arm #58 is removing util/parse::tokenize — do not call it"}

Working directory: {repo path}   Branch: {branch} (shared with other arms)

HARD RULES:
  - DO NOT commit, push, branch, or spawn a git worktree. The orchestrator is the
    sole committer; worktrees break the shared-tree self-healing.
  - Write files ATOMICALLY (write to a temp file, then move into place). Never leave a
    half-written file — a neighbor or the verify gate may read it.
  - DO NOT run any write-mode formatter — it rewrites the whole project and wipes
    neighbors' in-flight edits:
      cargo fmt (even with a path arg) · prettier --write/-w · npm run format/fmt ·
      ruff format (no --check) · black · gofmt -w · goimports -w · any wrapper of these.
    READ-ONLY checks are SAFE and expected: cargo fmt --check · prettier --check ·
    ruff format --check · gofmt -l. If a read-only check reports drift OUTSIDE your
    owned files, surface it — do not auto-fix with a write-mode formatter. Inside your
    files, hand-edit the offending lines.

When done editing, run the full-repo verify gate from the repo root:
  {verify command}

It MUST exit zero. The full-repo gate is intentional: if a neighbor left a temporary
error outside your files, try to fix it — your run is also their safety net. If the gate
stays red on something clearly outside your scope after best effort, STOP and report
(do not guess-fix and risk a worse break).

Only after the gate is fully green:
  - Close the ticket:  {close command, e.g. itr close {id} "<one-line outcome>"}
  - Report: one paragraph on what changed + the last 10 lines of the verify output.
```

---

## Wave log schema (`sprint/{folder}/overdrive/wave-N.md`)

```markdown
# Wave N — sprint-N

**Pre-wave SHA:** <sha>   **Commit:** <sha> (or "rolled back")   **Smoke:** accepted | rejected×K | auto
**Closed:** itr#a, itr#b   **Quarantined:** itr#c

## Arms
| Ticket | Files | Confidence | Outcome | Retries |
|--------|-------|-----------|---------|---------|
| itr#a | src/a.rs | high | closed | 0 |

## Interventions
- <orchestrator fix / flaky-gate note / rollback + reason>

## Quarantine
- itr#c — K attempts — last error: <tail> — likely cause: <low-confidence files | …>

## Contract warnings
- <symbol removed, imported by still-open itr#d>
```

---

## Multi-repo

Goal-scoped, not the default. When stories declare `Repo: path/to/repo`: owned files are `<repo>:<file>`; the verify gate runs per repo from its root; the orchestrator commits per repo (one wave can produce one commit per touched repo); `itr` stays the single sprint-level tracker. Otherwise keep paths repo-relative.

---

## How overdrive relates to its parents

| | `/sprint` | `/blitz` | `/sprint-review` | **`/overdrive`** |
|---|---|---|---|---|
| Scope | plan only | execute only | review only | **plan → execute → review, looped** |
| Human gates | 2 (goal, draft) | 2 (config, waves) | 2 (scope, triage) | **1 (per-wave visual smoke)** |
| File ownership | declared when easy | discovered at run time | n/a | **pre-baked for every ticket (arms)** |
| Commits | none | none | none | **one per accepted wave (rollback points)** |
| Failure | n/a | blocking quarantine triage | n/a | **quarantine-and-continue (autonomous)** |
| Ends when | filed | stop condition | reviewed | **every ticket closed or quarantined** |

Use the **coached trio** when you want to approve the goal, the backlog, or each story, or to run a single phase. Use **overdrive** when you want it cleared autonomously and will glance at each wave. Same artifacts — switch freely.

---

## Principles

- **One human gate.** The visual smoke test is the only thing a human is asked for inside the loop. Planning, file assignment, execution, verify, quarantine, and review are autonomous. That's the whole point.
- **Pre-plan the arms.** Conflicts are found at plan time (cheap), not mid-wave (expensive). Agents execute a baked plan; they don't explore.
- **The orchestrator is the sole committer.** Agents share one branch and never touch git. One commit per accepted wave makes every wave a clean rollback checkpoint.
- **Quarantine-and-continue guarantees termination.** A ticket gets K re-planned tries, then leaves the pool. The loop can't spin forever.
- **The verify gate is the convergence point.** Each arm runs the full-repo gate and self-heals neighbors' leftovers. The orchestrator re-runs it (flaky double-checked) before committing.
- **Roll back safely.** Stash untracked work before any hard reset; reopen `itr` tickets to resync. Never lose human files.
- **Autonomous ≠ reckless.** Cycle detection, file audits, flaky double-checks, time budgets, and the concurrency cap are guardrails that need no human — they let the swarm protect itself.
- **Same artifacts as the coached trio.** `plan.md` and the `itr` lifecycle are schema-identical, so a run is interchangeable with `/sprint`+`/blitz`+`/sprint-review`.

---

## Don't

- Don't add planning, draft, or per-story approval gates — overdrive's contract is one visual gate. (Want them? That's `/sprint`/`/blitz`/`/sprint-review`.)
- Don't let agents commit, push, branch, or spawn worktrees. Single-committer, shared-tree, only.
- Don't commit a red verify gate, and don't launch the next wave on an uncommitted or dirty tree.
- Don't `git reset --hard` without stashing untracked-not-ignored files first.
- Don't retry a failed ticket forever — K re-plans, then quarantine and continue.
- Don't block the loop on a quarantine; surface it in Phase 8.
- Don't count quarantined tickets as accepted, and don't close the epic on goal-critical quarantined work without recording carryover.
- Don't run more than 5 arms per wave — monitoring quality degrades.
- Don't roll back `itr` history on reject — reopen the tickets instead (the work happened; the result was rejected).
- Don't push, open a PR, or start the next sprint automatically.
- Don't run overdrive *and* manual `/blitz`/`/sprint-review` against the same sprint folder — overdrive owns the whole cycle.
