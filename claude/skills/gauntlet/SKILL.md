---
name: gauntlet
description: Run (or resume) a rubric-gated autonomous build/critique loop on a visual subsystem or a whole slice — one Workflow per iteration (Build → Capture → Critique), blind instrumented critics scored against RUBRIC.md, closure decided solely by `tools/gate.mjs`, captures pre-validated by `tools/measure.mjs`, routing reconciled via a mandatory route ledger. Trigger when the user types `/gauntlet`, or asks to "run the gauntlet loop", "rubric-gated build loop", "start a critique gauntlet", "resume the build/critique loop", or similar. Do NOT trigger for a single one-off review (use `/code-review`), for clearing a task backlog in parallel (use `/blitz`), or for a roadmap-bounded campaign (use `/proof-campaign`).
---

# gauntlet — rubric-gated build/critique loop

Iterate a subsystem (street, battle, cutscene, …) through Build → Capture → Critique rounds until `tools/gate.mjs` declares it CLOSED against the 7-axis rubric. Every rule below is wired to a file, a gate, or a harness toggle — **anything the loop asserts about its own behavior must land in one of those three.** A rule that can only be obeyed by remembering it will be dropped after the first exogenous shock (forensics §6).

Load-bearing tools (exact contracts — do not re-derive them):

```
node tools/gate.mjs [--dir critiques] [--json]      # full closure report, all subsystems
node tools/gate.mjs --check <subsystem>              # exit 0 iff CLOSED — the SOLE closure authority
node tools/gate.mjs --validate <file.json>           # schema-check one critique verdict
    --waive <subsystem>:<axis>   # honor a waiver for THIS invocation only (repeatable)
    --cap N                      # iteration budget for THIS invocation only (default 40)
    --bar N                      # closure bar for every axis, 1-10 (default 8) — use 9 for polish passes gated >=9

node tools/measure.mjs assert <png...> [--w --h]                       # capture sanity gate
node tools/measure.mjs diff <a> <b> [--threshold] [--boxes boxes.json] [--pad]
node tools/measure.mjs torso-sat <png> --rects r.json
node tools/measure.mjs rim-floor <png> --boxes b.json [--ring 3 --gap 5]
node tools/measure.mjs luma-bands <png> --bands y0:y1,...
```

Every command supports `--json`; parse that, never scrape prose output.

**gate.mjs is STATELESS** — a pure function of the critiques dir plus its flags; `--waive`, `--cap`, and `--bar` persist nothing. The durable copy of all three lives in a single STATUS.md line, `Gate flags: --cap N [--bar N] [--waive sub:axis ...]`, and that line is appended verbatim to EVERY gate invocation (`--check`, `--json`, report). A gate call missing a recorded flag is consulting a different gate — treat its answer as void. Auto-waiver: `critiques/live_checks.json` coverage waives ONLY a null `performance` axis; every other null axis blocks until an explicit `--waive` rides the call.

gate exit codes: report 0 · `--check` 0 CLOSED / 1 not-closed (reason on stdout) · `--validate` 0/1 · 2 usage or I/O. measure exit codes: 0 pass · 1 measurement/decode failure (incl. `assert` FAIL) · 2 usage.

## Slash invocation

```
/gauntlet [subsystem|all] [--cap N] [--bar N] [--resume]
```

| Arg | Default | Meaning |
|---|---|---|
| `subsystem` | `all` | One subsystem, or the whole slice in sequence. |
| `--cap` | 40 | Total iteration budget, enforced via `gate.mjs --cap N`. |
| `--bar` | 8 | Closure bar per axis, enforced via `gate.mjs --bar N` (9 for polish passes whose acceptance is ≥9). |
| `--resume` | off | Re-enter a live loop: read STATUS.md route ledger + `gate.mjs --json`, resume the in-flight Workflow with `resumeFromRunId`. |

---

## Phase 0 — First-invocation checklist (BLOCKING)

Run every check; a failure is fixed before any iteration starts. Never skip on `--resume` — re-entry is exactly when toggles have been lost.

1. **Harness opt-in — ultracode ON for the SESSION via `/config`.** Tell the user to flip it and wait for confirmation. A keyword pasted in prompt text or embedded in `/loop` wakeup prompts does NOT survive re-entry — the opt-in lives in the message envelope, not the content. The Cyberfunk run wrote `ultracode` six times in quoted text, the harness never saw it, and zero Workflows fired across 19 hours (forensics §3.1). If the session toggle is not on, STOP.
2. **Rubric exists**: `RUBRIC.md` with 7 anchored axes (palette_lighting, sprite_readability, parallax_depth, ui_polish, animation_feel, scene_composition, performance) and 3/5/8/10 anchors. If absent, write it first from reference shots; the loop has nothing to score without it.
3. **Capture rig runnable**: `node tools/shoot.mjs <label>` (or project equivalent) produces PNGs into `shots/`. Do NOT use `chrome --headless --screenshot` — it hangs on the rAF loop.
4. **Gate + measure runnable**: `node tools/gate.mjs --json` and `node tools/measure.mjs assert <any existing shot> --json` both exit cleanly against the real `critiques/` and `shots/` dirs. If either tool is missing from the project, copy it from this skill's `assets/` directory into `tools/` first (they are zero-dependency, Node ≥18).
5. **itr initialized**: `itr stats` succeeds (`.itr.db` present). Residuals are filed here, not in prose.
6. **Route ledger table present in STATUS.md** (format in Phase 4). Create the empty table if missing.
7. Record the cap (and bar, if not 8) in the STATUS.md `Gate flags:` line (e.g. `Gate flags: --cap 40 --bar 9`). Running `gate.mjs --cap N` once records nothing — the flag is per-invocation, so the STATUS.md line is the record and every subsequent gate call carries it.

---

## Phase 1 — Iteration = ONE Workflow call

Each subsystem iteration runs as **ONE Workflow call**, not loose Agent calls: phase `Build` → phase `Capture` → phase `Critique`, with the barriers between them. **If you are about to call Agent for a build/critique step you have already deviated — record it in the route ledger** (planned=workflow, actual=agent, reason code) before proceeding. The prior run made 49 loose Agent calls in ad-hoc 2-wide waves with no journal and no deterministic recovery; every wakeup restart was model judgment instead of script.

- After a dead wakeup or compaction, resume the in-flight iteration with `resumeFromRunId` — never restart the iteration from scratch.
- Cross-subsystem overlap (subsystem A's critique ∥ subsystem B's build) is allowed only as pipeline phases inside a Workflow, never as untracked Agent pairs.
- **Asset generation fans out INSIDE the workflow**: 3 attempts per asset generated in parallel, critic phase picks the winner, hard cap 3 attempts per asset. Serial attempts cost the prior run three full critic round-trips per asset (`facade_a→v2`, `side_street→v2→v3`). An asset that fails all 3 attempts gets a residual filed to itr and the best attempt shipped — no fourth attempt.

### Build phase
One builder per subsystem per iteration (files are shared; parallel builders on one scene file corrupt each other). Builder receives: prior critique JSON path, the cited findings verbatim, and the file list it owns. Builder output: changed files + a one-paragraph claim list (each claim must be checkable by a `measure.mjs` subcommand or a shot).

### Capture phase — the capture gate
Shoot the iteration's shots, then run `node tools/measure.mjs assert <every png> --w <W> --h <H> --json` **before any critic spawns**. A failed assert (wrong size, blank frame, truncated file, mid-transition crossfade) means the CAPTURE RIG is broken — repair the rig and re-shoot; **never spawn a critic on a bad capture**. The prior run's rig waited 800ms against a 1200ms crossfade and critics scored mid-transition frames for multiple rounds before anyone noticed.

### Critique phase
See Phase 2. Regular rounds: 1 critic. Confirmation rounds (the round that could produce the second consecutive all-≥8): a 3-critic panel.

---

## Phase 2 — Critics: blind, instrumented, validated

**Blind.** The critic prompt contains EXACTLY: the rubric (RUBRIC.md contents), the shot paths, and the prior critique file path. **Never** tell a critic what a score triggers, what closure requires, how many consecutive rounds are needed, or that this is a confirmation round. Closure questions go to `gate.mjs`, never to a critic. A critic that knows "8 closes the loop" is a critic being asked to close the loop.

**Instrumented.** The critic prompt lists the `measure.mjs` subcommands verbatim (the block at the top of this skill) and requires: every measured claim cites the exact command run and its output; findings cite axis, score, region, defect, concrete fix (RUBRIC.md contract). **Forbid hand-rolled PNG decoders / ad-hoc pixel scripts** — the prior run's critics burned 60–150k tokens each re-deriving instruments that `measure.mjs` now provides.

**Validated.** Critic output is written to `critiques/<subsystem>_iter<N>.json` only after `node tools/gate.mjs --validate <file.json>` passes. On rejection, respawn the critic with the validator's error message appended — do not hand-patch the JSON yourself (that is score laundering).

**Panel on confirmation rounds.** When `gate.mjs --json` shows a subsystem one clean round from closure, run 3 critics with distinct lenses in parallel (inside the Workflow's Critique phase):

| Lens | Focus |
|---|---|
| palette / composition | palette_lighting, scene_composition, parallax_depth |
| readability / animation | sprite_readability, animation_feel, ui_polish |
| does-it-reproduce | re-derives the prior round's measured claims from fresh captures; scores only what reproduces |

Per-axis score = median of the three (2-of-3 agreement). All three verdicts are validated and committed; the merged verdict is the file `gate.mjs` reads. One Opus opinion closing a subsystem is the exact gameability the panel exists to prevent (forensics §4.2 fix 1).

**Constraint caps.** When a critic proves a constraint (not effort) bounds an axis, append `--waive <subsystem>:<axis>` to the STATUS.md `Gate flags:` line AND append the evidence to RUBRIC.md "Known caps". `gate.mjs` persists nothing — the waiver only exists on gate calls that carry the flag, which is why the `Gate flags:` line rides every invocation. Waivers without a cited measurement are invalid. (Null `performance` is the one axis live_checks.json coverage auto-waives; everything else needs this explicit flag.)

---

## Phase 3 — Closure is gate.mjs, not you

After committing the iteration's critique(s):

```
node tools/gate.mjs --check <subsystem> <Gate flags>   # exit 0 iff CLOSED (two most recent critiques all-measured ≥8, waivers honored)
node tools/gate.mjs --json <Gate flags>                # full report for STATUS.md
```

(`<Gate flags>` = the recorded STATUS.md `Gate flags:` line — on every call, no exceptions.)

- Exit 0 → subsystem CLOSED. Proceed to Phase 4 reconciliation, then the next subsystem.
- CONTINUE / CONFIRM (exit 1) → next iteration, seeded with the new findings.
- BLOCKED (exit 1: measured closure met but a null axis is unwaived, or an invalid critique file poisons the record) → do NOT dispatch a builder; the fix is bookkeeping, not building. Either measure the null axis, waive it with evidence (Phase 2 constraint caps), or regenerate the invalid file through `--validate`, then re-run the gate.
- Gate reports PLATEAU (3 consecutive critiques with no improvement in total measured score) or CAPPED (budget spent) → write `PLATEAU.md` containing the verbatim `gate.mjs --json` report plus the open itr residual list, commit, and STOP the loop. Do not argue with the gate, do not hand-count consecutive rounds, do not "interpret" a 7 as effectively-8. **The loop ends when the gate says every subsystem is CLOSED — or when PLATEAU/CAPPED fires. There is no third exit.**

---

## Phase 4 — Per-iteration bookkeeping (all mandatory, all files)

Do these after EVERY iteration, in order:

**1. Route ledger row(s)** — STATUS.md carries this exact table; append one row per stage:

```markdown
## Route ledger
| iter | subsystem | stage    | planned | actual | reason if differs |
|------|-----------|----------|---------|--------|-------------------|
| 1    | street    | build    | codex   | codex  | —                 |
| 2    | street    | build    | codex   | opus   | SANDBOX-DOWN      |
```

Reason codes: `SANDBOX-DOWN`, `TOOL-MISSING`, `RATE-LIMIT`, `TASTE-REQUIRED` (mechanical stage turned out to need visual judgment), `WORKFLOW-UNAVAILABLE` (record + fix Phase 0.1). **A blank reason where planned≠actual is a closure blocker** — the prior run's Codex→Opus drift (38 of 49 dispatches) was invisible precisely because each choice was locally reasonable and nothing forced a narration.

**2. Score table** — the STATUS.md scores section is GENERATED: paste `node tools/gate.mjs` output verbatim (fenced). Never hand-edit a score, a trajectory, or a closure claim. Hand-written prose in STATUS.md is limited to "Next action" and the route ledger's reason cells. (The prior run hand-edited STATUS.md 76 times; drift between prose and ground truth was undetectable.)

**3. Residuals to itr, at critique time** — every finding the builder will not fix this round, every 9-blocker, every disclosed trade, every note-and-ship: `itr add` it NOW (per the `itr` skill), citing the critique file and axis. Residuals parked in STATUS prose are invisible to `/blitz` and every future loop.

**4. Ownership-scoped commit** — `git add <declared file list>` only: the changed source files, this iteration's shots, this iteration's critique JSON(s), STATUS.md. Never `git add -A` / `git add .` — commit `6e66a24` swept another agent's in-flight work into a loop commit.

**5. Context checkpoint** — check orchestrator token spend: `ccq sessions -s <session-id> --root "C:\Users\Blue\.claude\projects"` (the `--root` flag is required from this cwd), and **write the measured number into the iteration's ledger block** as a `tokens: <n>` line — an iteration with no `tokens:` line is a bookkeeping defect that Closure reconciliation flags, which is what makes this check skippable-but-not-silently. Past ~250k: write full checkpoint state to STATUS.md (current iter, gate report, in-flight runId, next action), commit, `/compact`. This trigger never self-fired in the prior run — the one compact in 19 hours was typed by the human. Checking is part of the iteration, not an aspiration.

**Closure reconciliation** (before declaring any subsystem closed): reconcile the route ledger against the transcript with ccq — `ccq agents -p <project> --root "C:\Users\Blue\.claude\projects"` plus a grep of the session `.jsonl` for Agent/Workflow dispatch records. Any ledger row contradicted by the transcript, any dispatch missing a row, or any iteration missing its `tokens:` line (Phase 4.5) reopens bookkeeping. Gate exit 0 + clean ledger reconciliation = closed; either alone is not.

---

## Model routing

| Role | Model | Notes |
|---|---|---|
| Critic (all lenses) | Opus-class, high effort | Taste is the product; never downgrade. |
| Visual-polish builder fixes | Opus-class | Only builder role that earns Opus. |
| Mechanical scaffolds, capture glue, serve/shoot plumbing | Sonnet-class | Keep mechanical work OFF the orchestrator — 170 orchestrator PowerShell calls is why context filled last run. |
| Builders (default) | Session model | |
| Non-taste bulk builders / image-gen | Codex (`codex:rescue`) | Max one active. On Codex failure: reroute per this table AND write the ledger row with `SANDBOX-DOWN` — the reroute is legal, the silent drift back is not. Any later return to Codex also gets a row. |

---

## Principles

- The gate is the referee; critics are witnesses; you are the clerk. None of the three may do another's job.
- Blind critics + instrumented claims + validator = the honesty chain. Break any link and the scores are decoration.
- Every self-report must be reconcilable: ledger vs transcript, scores vs gate output, claims vs measure.mjs.
- Deviation is allowed; undeclared deviation is a defect the next checkpoint reads as a defect.

## Don't

- Don't launch without the ultracode session toggle confirmed on.
- Don't call Agent for a build/capture/critique stage without a ledger row saying so.
- Don't tell a critic anything about closure mechanics or round significance.
- Don't spawn a critic on shots that haven't passed `measure.mjs assert`.
- Don't hand-edit scores, critique JSONs, or STATUS score tables — regenerate from `gate.mjs`.
- Don't declare closure yourself — only `gate.mjs --check` exit 0 plus a reconciled ledger closes a subsystem.
- Don't invoke `gate.mjs` without the recorded `Gate flags:` line — the tool is stateless, and a flagless call silently drops every waiver and the cap.
- Don't park residuals in prose — file them to itr at critique time.
- Don't exceed 3 attempts per asset, and don't run the 3 serially.
- Don't skip the ~250k checkpoint check "because the iteration went fine".
