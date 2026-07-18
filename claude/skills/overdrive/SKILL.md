---
name: overdrive
description: "Autonomous plan→execute→review loop condensing /sprint + /blitz + /sprint-review: pre-plans implementation and owned files per ticket, runs conflict-free waves on one branch with a commit per wave for clean rollback; the only human touch is a per-wave smoke test (`--auto` defers it to end-of-run). Loops until every ticket closes or quarantines. Trigger: `/overdrive`, \"run the whole sprint autonomously\", \"swarm the backlog hands-off\". NOT for coached single-phase work (use /sprint, /blitz, or /sprint-review)."
---

# /overdrive — autonomous plan · swarm · review loop

Autonomous super-skill. Fuses the three coached skills into one loop:

- **Plan** (`/sprint` minus gates) — spec / `/plan` / conversation → groomed `itr` backlog.
- **Pre-plan the arms** (new) — bake an impl plan + exact owned-file set for *every* ticket, so agents are **arms executing a plan**, not explorers.
- **Swarm** (`/blitz` plus commits) — conflict-free waves on the **same branch**; orchestrator commits **once per wave** → any wave rolls back clean.
- **Review** (`/sprint-review` minus ceremony) — fill Outcomes/Demo/Retro, file triage, close epic.

Philosophy: **let the agents do what they need to do.** Every coached-trio human gate removed *except one*: the per-wave **visual smoke test** (accept/reject). Loop runs until **every ticket closed** (or quarantined). Everything else autonomous.

> *Terse by design — caveman: few token do trick. Commands/thresholds exact; prose stripped, brain intact.*

> **Coached vs autonomous.** Want to approve goal/backlog/each story → coached trio (`/sprint`→`/blitz`→`/sprint-review`). `/overdrive` = *"clear this, I'll glance at each wave."* Same artifacts (`sprint/{folder}/plan.md`, `itr` epic+stories) — switch freely.

## Slash invocation

```
/overdrive [input | --backlog] [--auto|--trust] [--concurrency N] [--max-waves N]
           [--max-retries K] [--time-budget T] [--branch name] [--name slug]
           [--verify "cmd"] [--tracker "cmd"] [--repos p1,p2] [--retro|--no-retro] [--dry-run]
```

| Arg | Default | Meaning |
|---|---|---|
| `input` | — | Spec path, inline brief, or nothing (recent `/plan` / conversation). → **plan mode**. |
| `--backlog` | — | Skip planning; run the existing open `itr` backlog. → **execute mode**. Auto-picked when no input but open tickets exist. |
| `--auto` / `--trust` | off | Collapse per-wave gate → **one** end-of-run review. Hands-off until then. **Pair with `--time-budget`.** |
| `--concurrency N` | `5` | Max arms/wave. **Hard cap 5** (higher → clamp + warn; monitoring degrades past ~5). |
| `--max-waves N` | unset | Total-wave circuit breaker. |
| `--max-retries K` | `2` | Re-planned retries/ticket before quarantine (`K+1` total attempts). |
| `--time-budget T` | unset | `2h`, `45m`. No new waves once elapsed; in-flight wave finishes. |
| `--branch name` | current | Run on a fresh branch off HEAD. |
| `--name slug` | auto | Sprint-folder slug override. Sanitized `[a-z0-9-]`, cap 32. |
| `--verify "cmd"` | auto | Override verify gate (Phase 0 table). |
| `--tracker "cmd"` | `itr` | Override backlog source/record cmds. |
| `--repos p1,p2` | `.` | Repo paths in scope. |
| `--retro` / `--no-retro` | adaptive | Force/suppress Phase 8 retro (default friction-triggered). |
| `--dry-run` | off | Run plan + pre-plan + wave-pack, **print**, stop. No `itr` writes, no agents, no commits. Preview an autonomous run. |

Unsupplied flags → auto-detected in Phase 0.

---

## Roles & artifacts

`/overdrive` = **autonomous orchestrator**, not Scrum Master. Coaches little, does much.

- **You** = PO. Only live decision = per-wave visual smoke verdict.
- **Pre-plan agents** (Phase 2) — tickets → baked plans + file sets. Read-only, never edit.
- **Arms** (Phase 4) — execution swarm, one/ticket, each owns a disjoint file set, runs its baked plan.
- **Orchestrator** — sole git committer, wave packer, quarantine warden, reviewer.

Artifacts (same schema as coached trio → interoperate):

- **`itr` epic + stories** — backlog. Tags `sprint-N`, `risk:<tier>`; `--files` written back by pre-plan.
- **`sprint/{folder}/plan.md`** — durable record. **Exact `/sprint` schema** (so `/sprint-review` can re-open). Overdrive fills Outcomes/Demo/Retro in Phase 8.
- **`sprint/{folder}/overdrive/wave-N.md`** — per-wave log (config, arms, files, interventions, retries, quarantines, commit SHA, smoke verdict).
- **`sprint/{folder}/overdrive/run.md`** — run metadata (mode, baseline SHA, config, `agent-info` snapshot, timeline).
- **`sprint/CURRENT`** — one line = in-flight folder. Written at plan, repointed/removed at close.
- **Git commits** — one/accepted wave on the branch (rollback checkpoints).

---

## The loop at a glance

```
Phase 0  Preflight & baseline ........ resolve input, detect tooling, clean git baseline (stash WIP)
Phase 1  Plan (autonomous) ........... spec → itr epic + stories   [skipped in --backlog mode]
Phase 2  Pre-plan the arms ........... every ticket → impl plan + exact owned files + neighbors
Phase 3  Wave-pack ................... conflict graph → disjoint-file waves, topo-ordered
─ loop while open tickets remain ───────────────────────────────────────────────
Phase 4  Spawn wave ................. static file audit → swarm arms (same branch, no commits)
Phase 5  Monitor & self-heal ........ unblock, re-plan failures, quarantine after K attempts
Phase 6  Wave gate & commit ......... full-repo verify (flaky double-check) → ONE commit
Phase 7  Visual smoke gate .......... accept → next wave | reject → rollback + iterate
─ stop: backlog empty · only-quarantined · 2 zero-waves · blocking-quarantine · max-waves · time-budget ─
Phase 8  Finalize ................... fill plan.md, adaptive retro, triage, close epic, report
```

Only human touch inside the loop = Phase 7. With `--auto`/`--trust`, Phase 7 skipped per wave, runs **once** in Phase 8 over the whole increment.

---

## Phase 0 — Preflight & baseline

Announce `Phase 0 — Preflight & baseline`. Terse logging throughout.

1. **Input → mode**, in order:
   - `--backlog`, or empty input + tracker has open tickets → **execute mode** (skip Phase 1).
   - Path that exists / inline brief / recent `/plan` / clear conversational ask → **plan mode**.
   - Nothing usable, no open tickets → **terminal no-op** (not a gate): print `Nothing to clear — no spec/brief and no open tickets. Re-invoke with a spec, brief, or --backlog.` Stop.

2. **Tracker.** Default `itr`. `itr stats`; no `.itr.db` → **autonomously `itr init`** (init fail → surface + stop). `itr agent-info` once — prefer its syntax for `update`/`close`/`--files`/body fields over anything here. `--tracker` override → capture list-open + close cmds. Snapshot `agent-info` → `run.md`.

3. **Detect tooling** (non-blocking):
   - `kgr` on PATH → file inference (`kgr refs`, `kgr query --who-imports`) + Phase 6 contract check.
   - `STORY_STYLE.md` / `CLAUDE.md` / `AGENTS.md` → mirror issue conventions.
   - `docs/ROADMAP.md` → seed goal (plan mode), update Phase 8.
   - `sprint/CURRENT` → in-flight sprint (execute mode finds the folder here).

4. **Sprint number & folder.** Execute mode + valid `sprint/CURRENT` → reuse that folder + `sprint-{N}` (continuing; don't allocate new). Else: max `sprint-{N}` under `sprint/` +1 (fallback max `sprint-N` tag +1; else `sprint-1`). Slug = `--name`, else 2–4 keywords from goal (plan) / input (execute), `[a-z0-9-]`, cap 32. Folder = `sprint-{N}-{YYYY-MM-DD}-{slug}`; collision → append `-{HHMM}`.

5. **Stale-ticket sweep.** `git log --grep='closes\? #'` / `fixes\? #` / `resolves\? #` (last 30 days). Referenced ID still `open` in `itr` = shipped-not-closed → **autonomously exclude** from scope, log `run.md` → `Stale (excluded)`. (Autonomous — no three-way pause; commit already shipped it.)

6. **Git safety & baseline** (load-bearing — makes rollback safe). Orchestrator commits → tree must be sane. Resolve **autonomously** except the one hard blocker:
   - **Not a repo** → **hard stop**: print `overdrive needs a git repo — run \`git init\` and retry (per-wave commits are load-bearing).` No auto-init.
   - **Detached HEAD** → create + checkout `overdrive-{slug}`. Log.
   - **`--branch name`** → `git checkout -b name` off HEAD.
   - **No commits** → `git commit --allow-empty -m "overdrive: baseline"`; confirm landed (`git rev-parse HEAD` exit 0).
   - **Dirty tree** → **don't commit user WIP, don't gate — stash it.** `git stash push --include-untracked -m "overdrive: pre-run WIP (sprint-N)"`. Preserves their work (recoverable) + clean baseline. Surface stash ref + restore hint (`git stash list` / `git stash pop`).
   - `BASELINE_SHA = git rev-parse HEAD`. Record `run.md`. Verify clean: `git diff-index --quiet HEAD --` exit 0 — else surface + stop (never swarm a dirty tree).

7. **Config & verify gate.** `concurrency` (cap 5, clamp+warn), `max-waves`, `max-retries` (2), `time-budget`, `--auto`/`--trust`. **`--auto` backstop:** `--auto` + neither `--time-budget` nor `--max-waves` → set `max-waves = 2 × open-ticket-count`, warn `Auto with no cap — backstopping at <N> waves; override with --max-waves/--time-budget.` Auto-detect verify gate/repo unless `--verify`:

   | File | Default verify gate |
   |---|---|
   | `Cargo.toml` | `cargo test && cargo clippy -- -D warnings && cargo fmt --check` |
   | `package.json` | union of existing `test`/`lint`/`typecheck`/`format:check` scripts |
   | `pyproject.toml` | `pytest && ruff check . && ruff format --check .` |
   | `go.mod` | `go test ./... && go vet ./... && test -z "$(gofmt -l .)"` |
   | `Makefile` w/ `test` | `make test` + any of `lint`/`check`/`verify` |
   | nothing matched | **stop and ask** for the gate cmd (one-time setup input, same class as repo/tracker — *not* a workflow gate) |

   No-op/`true` gate is **deliberately not** the fallback: unverified per-wave commits ship broken code + kill self-healing. Supply `--verify` once to stay hands-off on odd stacks.

8. **Preflight summary** (transparency, not a gate — proceed unless a blocker stopped you):

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

Announce `Phase 1 — Plan`. **Skipped in execute mode.** No approval gate (want one? coached `/sprint`, or `--dry-run`).

1. **Sprint Goal** (`Deliver <value> by <change> so that <outcome>.`) + short **Non-Goals**. Roadmap candidates → seed from top one; note divergence → `## Open Assumptions` (Phase 8 roadmap update).
2. **Decompose into stories.** Each: serves goal, imperative title, one-arm sized (bounded files, single concern, runnable verify). Split oversized; truly-unsplittable → spillover (`product-backlog,needs-sprint`).
3. **Risk tier** (`risk:high|med|low`) + **order** risk → dependency → value. `--blocked-by` only on concrete signal (kgr import edge / explicit "X before Y").
4. **DoD** (AC pass · gate green · behavior observable · docs if user-facing). Appended to every story AC.
5. **File to `itr`** (no gate): epic first (`itr add -k epic -p high -f json`, tags `sprint-N`, body = goal+non-goals+DoD) — **capture epic ID from JSON** for `--parent`. Then `itr batch add` stories (`kind: task`, `parent: <epic-id>`, `acceptance` = AC+DoD, tags `sprint-N,risk:<tier>` + style tags). Capture IDs. Partial fail → retry item once, else surface payload + resume (never roll back the epic).
6. **Write `sprint/{folder}/plan.md`** (`/sprint` Phase 6 schema verbatim: `# Sprint-N`, **Sprint Goal**, **Epic**, **Created**, **Story style**, `## Non-Goals`, `## Definition of Done`, `## Sprint Backlog` table, `## Spillover`, `## Open Assumptions`, empty `## Outcomes`/`## Demo`/`## Retro`). Write `sprint/CURRENT` = folder.

---

## Phase 2 — Pre-plan the arms (autonomous)

Announce `Phase 2 — Pre-plan`. Blitz discovers files at run time; overdrive bakes them at plan time → arms not explorers. Conflicts found now (cheap), faster agents, tighter waves.

1. **Fan out pre-plan agents over every open ticket** (parallel, read-only), `subagent_type: general-purpose`. Each reads body+AC, searches (`kgr refs`/`kgr query --who-imports`, else grep), returns:

   ```json
   { "ticket_id": N, "files": ["src/a.rs", "src/b.rs"], "confidence": "high|medium|low",
     "plan": "3–6 concrete imperative steps the arm will follow",
     "api_surface": ["public symbols this ticket adds/changes/removes"],
     "semantic_neighbors": ["#M removes tokenize — don't call it"],
     "blocked_by": [M], "reasoning": "why this file set" }
   ```
   No edits. Minimal file sets. **Multi-repo:** ticket body `Repo: path/to/repo` → scope search to that repo, paths relative to its root (orchestrator prepends `<repo>:` on writeback); else whole tree.

2. **Write baked plan back to ticket** (arm reads from tracker, not orchestrator memory): `itr update <id> --files "<csv>"` + plan + neighbors into body/context (exact field per `agent-info` — `--context` or body flag). Tracker-persisted = crash-recoverable: re-run `--backlog` resumes (closed stay closed; open carry their plan).

3. **Cycle detection on `blocked-by`** (DFS). Cycle → **autonomously break**: drop lowest-confidence edge in the ring (tie → drop edge whose *source* ticket has highest ID), **re-derive topo order**, log `Cycle broken: #A→#B→#A, dropped #B→#A (low confidence)` → `run.md`. No ask.

4. **Low-confidence flags.** `confidence: low` kept but flagged in wave log; if it later quarantines, retro notes "low-confidence file ownership" as likely cause.

---

## Phase 3 — Wave-pack (autonomous)

Announce `Phase 3 — Wave-pack`. **Eligible pool = currently-open tickets minus any tagged `quarantined-sprint-N` minus any tagged `visual-gate-only`** — quarantined never re-enter (this exclusion = termination); visual-gate-only never enter at all (nothing for an arm to build — pure PO smoke). Same filter every re-derive (Phase 4).

**Visual-gate-only = smoke-only, deferred to the gate.** A ticket tagged `visual-gate-only` (or visual-scope with no agent-implementable code — its only AC is the PO's own visual smoke against a `LOOK AT / IGNORE / EXPECTED / CONFOUNDERS` block) gets **no arm, no wave, no attempt**. Overdrive already has a PO smoke (Phase 7 per-wave / Phase 8 end-of-run) — that's the review that picks these up. Hold them aside; surface them in the smoke report (Phase 7/8) for the PO to eyeball; **accept → close, reject → carryover** (Phase 8 triage). For loop purposes treat them as **resolved** — they never block `backlog empty` (see stop conditions). Pre-plan (Phase 2) flags them: a ticket whose pre-plan returns `files: []` / no implementable step *and* is visual-scope is visual-gate-only — tag it `visual-gate-only` so this filter catches it.

1. **Conflict graph.** From eligible pool, file → owning tickets. File owned by ≥2 = conflict edge (can't share a wave). Add semantic edges from `semantic_neighbors`.
2. **Greedy bin-pack** respecting: topo order of `blocked-by` (ticket after its blockers' waves), no intra-wave file conflict, wave ≤ `concurrency`.
3. **Write** `sprint/{folder}/overdrive/wave-plan.md` (waves, owned files, neighbors, conflicts + split). Print one-screen summary. No gate. (`--dry-run` stops here.)

---

## Phase 4 — Spawn the wave (autonomous)

Announce `Phase 4 — Wave N`. **Re-derive each cycle from eligible pool = open minus `quarantined-sprint-N`** (re-run Phase 3 bin-pack on it). Newly-closed drop out, new tickets enter, quarantined stay excluded — exclusion is load-bearing for termination.

1. **Pre-wave SHA** = prior wave's commit, or `BASELINE_SHA` for wave 1. Rollback target.
2. **Static file audit** (vs pre-plan staleness): per ticket, confirm owned files exist + don't now collide with a wave-neighbor (prior wave may have moved code). Real collision → **defer to next cycle** (don't launch a known conflict), **increment attempt counter, quarantine instead if counter > `max-retries`** (can't defer forever). Scan owned dirs for stale `*.tmp`/lock → remove.
3. **Spawn one arm/ticket in parallel** — `subagent_type: general-purpose`, `run_in_background: true`, **Per-arm template** below. Same branch/shared tree; never commit/push/branch/worktree (shared tree powers self-healing). **Per-arm timeout** = `min(time-budget-remaining / (2 × concurrency), 30m)`; exceed without reporting → interrupt, log `Interventions`, treat as verify failure (re-plan) so one hung arm can't stall the wave or drain budget.

---

## Phase 5 — Monitor & self-heal (autonomous)

Event-driven, no polling. Mid-edit LSP noise ignored until an arm reports.

- **Permission / missing-dep fail** → orchestrator fixes (edit manifest, install tool, grant path), logs `Interventions`, resumes arm via `SendMessage`.
- **Verify-gate fail reported by an arm** → **re-plan, don't just retry.** Fresh pre-plan agent sees failure tail + ticket → new plan/file set. Then, **incrementing the attempt counter either way:**
  - New file set within already-owned files (no new conflict) → respawn fresh arm **in the same wave window**.
  - Needs a neighbor's file → **defer to next cycle** (re-pack) → stays conflict-free.
- **One attempt counter/ticket.** Every re-plan retry *and* every collision-defer (Phase 4.2) increments it — no uncounted path → no unbounded loop.
- **Rate-limit cascade exception.** Several arms failing identically at the same moment (API 429/overloaded, arms "completed without calling StructuredOutput") = infrastructure, not the tickets — do **not** increment attempt counters. Pause ~60s, halve `--concurrency`, respawn only the failed arms.
- **Quarantine-and-continue.** Counter > `max-retries` (default 2) → **quarantine**: leave `open` in `itr`, add tag `quarantined-sprint-N` (Phase 3/4 exclude it), record durable context — `itr update <id>` body with `Quarantine (sprint-N, wave-M): K attempts. Last error:\n<last ~50 lines>\nRoot cause: <one-line diagnosis>` (field per `agent-info`) + line in `wave-N.md` → `Quarantine`. **Wave + loop continue.** Never re-enters; surfaces Phase 8. This is the termination guarantee.

---

## Phase 6 — Wave gate & commit (autonomous)

Announce `Phase 6 — Wave N gate`. Once every arm is terminal (closed/quarantined):

1. **Full-repo verify gate** from each repo root.
2. **Flaky double-check** before trusting red: red → re-run up to **2 more times** on the unchanged tree. Green on a re-run → flaky, log `flaky gate detected` → `Interventions`, treat green. Consistently red → real.
3. **Red on a slice no arm owned** → diagnose; small+obvious fix → apply+log; else **roll back** to pre-wave SHA (mechanics below), re-plan implicated tickets, re-run wave. Counts against **shared per-wave rework budget** (box). Never commit red. Autonomous — *not* a human gate (human's only verdict = Phase 7 smoke).
4. **Contract check** (kgr only): for symbols the wave *removed* from `api_surface`, `kgr query --who-imports <symbol>`; still-open ticket importing a removed symbol → log `contract-warning` + neighbor note for next cycle. Non-blocking.
5. **Commit (single committer).** Green → snapshot. One `-m` per block so git lays out subject/body/trailer with blank lines:
   ```
   git add -A   # stages modified, deleted, new (non-ignored) files; ignored stay untracked — fine
   git commit -m "overdrive wave-N: closes itr#a, itr#b, itr#c (3 stories)" \
              -m "<one-line gate summary>" \
              -m "Co-Authored-By: <orchestrator model> <noreply@anthropic.com>"
   ```
   **Verify landed:** `WAVE_N_SHA = git rev-parse HEAD` must differ from pre-wave SHA *and* `git diff-index --quiet HEAD --` exit 0 (hook can silently abort). Fail either → stop+surface, don't launch wave N+1 on an uncommitted tree. Subject's `closes itr#…` is the parseable bridge (`^overdrive wave-\d+: closes ((?:itr#\d+,? ?)+)`) → review tooling / manual `/sprint-review` map commit → tickets.

> **Shared per-wave rework budget (= 3).** Phase 6 red-gate rollbacks + Phase 7 human rejects draw from **one** counter/wave, reset when the wave is accepted. Hits 3 → orchestrator **autonomously quarantines** the wave's still-open tickets (tag + context per Phase 5), moves on — **no ask.** Bounds per-wave iteration; quarantines surface Phase 8.

---

## Phase 7 — Visual smoke gate (the one human touch)

Announce `Phase 7 — Wave N smoke`. **Only human ask in the loop.** `--auto`/`--trust` → skip per wave, do once in Phase 8.

1. **Wave report** — unambiguous so accept-vs-reject is obvious (vague report = the failure mode):
   ```
   Wave N — <K> closed, <Q> quarantined   (commit <sha7>)
     Stories:   itr#a ✓  itr#b ✓  itr#c ⚠ quarantined
     Diff:      git diff --stat (owned files)
     Verify:    tests ✓ | lint ✓ | typecheck ✓     (every check listed pass/fail)
     Smoke it:  <how to see it — run the app / visit URL / screenshot, per project>
     In scope to eyeball:   <user-visible behavior from this wave's stories>
     Out of scope (ignore): <adjacent stories' territory · sprint Non-Goals>
   ```
   Any check yellow/partial → highlight + offer three verdicts.

2. **Run visual smoke** the project way (project `/run` skill, `npm run dev` + screenshot, CLI invocation). Show result. **Also list any held `visual-gate-only` tickets in scope for this smoke** (they ran no arm — Phase 3) so the PO eyeballs them here against their `LOOK AT / EXPECTED` lines; accept → `itr close`, reject → carryover (Phase 8). Under `--auto` they all defer to the single Phase 8 smoke.

3. **Verdict:**
   - **accept** → log verdict+timestamp; reset rework budget; next cycle.
   - **reject** → **roll back + iterate this wave**: capture one-line reason, splice into a fresh re-plan of the wave's tickets, re-run same wave number. Draws on the **shared rework budget** (Phase 6 box); hits 3 → orchestrator **autonomously quarantines** + moves on — **no second ask**. (Smoke verdict is the only gate; want more tries? say so in your reject reason → re-plans with it.)
   - **accept-with-followup** (offered when checks mixed) → accept, file a bug, continue.

### Rollback mechanics (reject path)

```
1. git status --porcelain → untracked-not-ignored files (rare post-commit; e.g. one you added by hand)
   → back up first, DON'T nuke human work: git stash push --include-untracked -m "overdrive-rollback-wave-N"
2. git reset --hard <pre-wave-SHA>
3. git clean -fd            (remove agent-created untracked; respects .gitignore)
4. git diff-index --quiet HEAD --   MUST exit 0  (else "reset incomplete — resolve manually", stop)
5. Reopen tickets THIS wave CLOSED (from wave-N.md → Closed:; never reopen quarantined):
   itr update <id> --status open     (syntax per agent-info; resyncs itr to rolled-back git)
6. Log rollback + reason → wave-N.md → Interventions.
```
Step-1 stash = **recoverable backup, not auto-restored** (popping re-introduces what we're rolling back). Survives in `git stash list`; recover manually if needed. Retry starts clean.

---

## Loop control — stop conditions

Check **once/cycle, right after a wave is accepted (or auto-accepted), before re-deriving the next plan.** Re-query open tickets, test:

- **Backlog empty** (no open remain; quarantined *and* visual-gate-only are tagged out — the latter resolve at the Phase 7/8 smoke, not by an arm) → success → Phase 8.
- **Only quarantined remain** (every open ticket tagged `quarantined-sprint-N`) → exhausted → Phase 8.
- **Poisoned** — `consecutive-zero` counter: after each accepted wave, +1 if it closed zero else reset 0. Reaches **2** *and* no attempt in flight (no re-plan/defer pending) → stop → Phase 8. Mid-attempt = progress (no false-trigger on slow sprint).
- **Blocking quarantine** (quarantined ticket that still-open tickets are `blocked-by`) → stop launching dependents → Phase 8.
- **`max-waves` reached** → Phase 8.
- **`time-budget` elapsed** → finish in-flight wave (never kill mid-edit), no more → Phase 8.

**Why it always terminates:** every ticket ends `closed` or `quarantined` — re-plan retries + collision-defers share one bounded counter (Phase 5), the rework budget bounds rollback/reject (Phase 6 box), four circuit-breakers cap the outer loop. No uncounted retry/defer/reject path.

---

## Phase 8 — Finalize (autonomous review)

Announce `Phase 8 — Finalize`.

1. **`--auto`/`--trust` end-of-run gate.** Per-wave gates skipped → do the **one** smoke now over the whole increment: full run report + combined smoke.
   - **accept** → close-out.
   - **reject from wave M onward** → multi-wave rollback: stash untracked (backup), `git reset --hard <WAVE_M_SHA>`, `git clean -fd`. **Reopen exactly what waves M+1…N CLOSED** — parse each `wave-{k}.md` `Closed:` line → `itr update <id> --status open`; **never reopen `quarantined-sprint-N`**. After **2** end-of-run rejects → orchestrator **autonomously** stops + reports kept-vs-discarded (no re-offer; re-run `/overdrive --backlog` to iterate). Mirrors bounded per-wave reject.

2. **Outcomes.** Plan-vs-actual table (every original ticket → final status), counts, completion rate, goal achievement (yes/partial/no — **quarantined ≠ accepted**), `git diff` not tied to a ticket. Read all `wave-*.md` for friction.

3. **Adaptive retro.** Required if any friction fired (quarantine · intervention · rollback/reject · bug · completion <80%); else skip. `--retro`/`--no-retro` override. When run: plan-vs-actual, friction log (root-cause each), 1–3 process-improvement items, agent-learnings → `## Retro` + standalone `sprint/{folder}/retro-{date}.md`.

4. **Triage filing** (autonomous, via `itr`, honoring `STORY_STYLE.md`): quarantined/rejected → `carryover` (`sprint-N+1-candidate`, `product-backlog`); bugs → `bug` (`from-review-N`); retro items → `task` (`retro`,`process-improvement`). Same taxonomy as `/sprint-review`.

5. **Fill `plan.md`** Outcomes/Demo/Retro in place (`/sprint-review` schemas → reads identical to a coached close-out).

6. **Close out.** **Scan blocking quarantines first:** any open ticket `blocked-by` a quarantined one → log `run.md`, **leave epic open** (carryover). Else close epic only if **(a)** all goal-critical stories closed (or conditional + filed follow-up) **and** completion ≥ 80%, **or (b)** increment explicitly accepted at a visual gate: `itr close <epic-id> "Reviewed <date>. Outcome: <yes|partial|no>. <closed>/<total> accepted."` Any goal-critical quarantined/rejected → leave open + file carryover. Repoint/remove `sprint/CURRENT`. `docs/ROADMAP.md` exists → `/roadmap --update` (non-blocking; pass goal-divergence note from `## Open Assumptions`).

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

Stop. Don't push/PR unless asked. Don't auto-start the next sprint.

---

## Per-arm prompt template

Arm gets its **baked plan** — doesn't rediscover. Inject pre-plan values:

```
You are arm {id} in overdrive wave {N}: {title}.

Baked plan (follow it; refine if needed, but stay in your file set):
{plan steps from Phase 2}

Ticket body / AC:
{full body + acceptance verbatim}

Files you OWN — edit ONLY these:
{owned file list}

Files owned by neighbor arms this wave — DO NOT touch:
{neighbor file list}

Semantic warnings:
{e.g. "arm #58 is removing util/parse::tokenize — do not call it"}

Working dir: {repo path}   Branch: {branch} (shared)

HARD RULES:
  - DO NOT commit, push, branch, or spawn a git worktree. Orchestrator is sole committer;
    worktrees break shared-tree self-healing.
  - Write files ATOMICALLY (temp file, then move). Never leave a half-written file — a
    neighbor or the verify gate may read it.
  - DO NOT run any write-mode formatter — it rewrites the whole project, wiping neighbors'
    in-flight edits:
      cargo fmt (even with a path arg) · prettier --write/-w · npm run format/fmt ·
      ruff format (no --check) · black · gofmt -w · goimports -w · any wrapper of these.
    READ-ONLY checks SAFE/expected: cargo fmt --check · prettier --check · ruff format
    --check · gofmt -l. Read-only drift OUTSIDE your files → surface it, don't write-format.
    Inside your files, hand-edit the lines.

When done editing, run the full-repo verify gate from the repo root:
  {verify command}

MUST exit zero. Full-repo gate is intentional: if a neighbor left a temp error outside your
files, try to fix it — your run is also their safety net. If it stays red on something clearly
outside your scope after best effort, STOP and report (don't guess-fix into a worse break).

Only after fully green:
  - Close ticket:  {close command, e.g. itr close {id} "<one-line outcome>"}
  - Report: one paragraph on changes + last 10 lines of verify output.
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

Goal-scoped, not default. Stories declare `Repo: path/to/repo` → owned files `<repo>:<file>`; verify gate per repo from its root; orchestrator commits per repo (one wave → one commit/touched repo); `itr` stays the single sprint tracker. Else paths repo-relative.

---

## How overdrive relates to its parents

| | `/sprint` | `/blitz` | `/sprint-review` | **`/overdrive`** |
|---|---|---|---|---|
| Scope | plan only | execute only | review only | **plan → execute → review, looped** |
| Human gates | 2 (goal, draft) | 2 (config, waves) | 2 (scope, triage) | **1 (per-wave visual smoke)** |
| File ownership | declared when easy | discovered at run time | n/a | **pre-baked every ticket (arms)** |
| Commits | none | none | none | **one/accepted wave (rollback points)** |
| Failure | n/a | blocking quarantine triage | n/a | **quarantine-and-continue (autonomous)** |
| Ends when | filed | stop condition | reviewed | **every ticket closed or quarantined** |

Coached trio → approve goal/backlog/each story, or run one phase. Overdrive → clear autonomously, glance per wave. Same artifacts — switch freely.

---

## If a run is orchestrated via the Workflow tool

Arms here are Agent-tool spawns, but when a cycle runs through a Workflow-tool script instead, two failure classes recur:

- Workflow scripts are plain JS — no TypeScript syntax. `node --check` a scratch copy before launching a large run; on a mid-run script error, edit the persisted script and relaunch with `{scriptPath, resumeFromRunId}` instead of restarting from zero.
- Schema-returning subagents: omit `model` so they inherit the session model — never pin a haiku-class model for structured output — and keep the schema's payload small (paths, IDs, verdicts; not bulk file content). Oversized returns fail StructuredOutput validation and surface as "completed without calling StructuredOutput".

---

## Principles

- **One human gate.** Visual smoke = the only human ask in the loop. Plan, file assignment, execution, verify, quarantine, review all autonomous.
- **Pre-plan the arms.** Conflicts at plan time (cheap), not mid-wave. Arms execute a baked plan.
- **Orchestrator = sole committer.** Arms share one branch, never touch git. One commit/accepted wave = clean rollback checkpoint.
- **Quarantine-and-continue → termination.** K re-planned tries, then leaves the pool. Can't spin forever.
- **Verify gate = convergence point.** Each arm runs the full-repo gate, self-heals neighbors. Orchestrator re-runs it (flaky double-checked) before committing.
- **Roll back safely.** Stash untracked before any hard reset; reopen `itr` tickets to resync. Never lose human files.
- **Autonomous ≠ reckless.** Cycle detection, file audits, flaky double-checks, time budgets, concurrency cap — guardrails that need no human.
- **Same artifacts as the trio.** `plan.md` + `itr` lifecycle schema-identical → interchangeable.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. Already the design: one commit/accepted wave, orchestrator sole committer, arms never.

---

## Don't

- Don't add planning/draft/per-story gates — overdrive's contract is one visual gate. (Want them? `/sprint`/`/blitz`/`/sprint-review`.)
- Don't let agents commit/push/branch/worktree. Single-committer, shared-tree.
- Don't commit a red gate; don't launch the next wave on an uncommitted/dirty tree.
- Don't `git reset --hard` without stashing untracked-not-ignored first.
- Don't retry a ticket forever — K re-plans, then quarantine + continue.
- Don't block the loop on a quarantine; surface it Phase 8.
- Don't count quarantined as accepted; don't close the epic on goal-critical quarantined work without carryover.
- Don't run >5 arms/wave — monitoring degrades and wide file-reading fan-outs trip API rate-limit cascades.
- Don't fan out fresh readers to review a finished wave — synthesize from arm reports; delegate unavoidable bulk re-reads to one subagent.
- Don't roll back `itr` history on reject — reopen the tickets (work happened; result rejected).
- Don't push/PR/start-next-sprint automatically.
- Don't run overdrive + manual `/blitz`/`/sprint-review` on the same sprint folder — overdrive owns the cycle.
