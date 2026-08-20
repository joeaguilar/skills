---
name: crucible
description: Run (or resume) a two-layer, rubric-gated autonomous build/critique loop on ANY project — one Workflow per iteration (Spec → Build ∥ blind test-author → Evidence → bounded Repair → Critique), a hard layer-1 gate (no new test failures, changed-lines coverage, every declared behavior pinned by a passing test, declared metric thresholds) plus blind instrumented critics scored against a negotiated rubric, closure decided solely by `gate.mjs`, evidence produced only by contract-registered instruments, routing reconciled via a mandatory route ledger. Trigger when the user types `/crucible`, or asks to "run the crucible loop", "iterate this module until it's actually good", "rubric-gated loop with real tests", "autonomous build/critique loop on this package", "resume the crucible", or similar. Do NOT trigger for a visual/pixel subsystem where the measurement IS the pixels (use `/gauntlet` — it carries a verified pixel instrument), for a single one-off review (use `/code-review`), for clearing a task backlog in parallel (use `/blitz`), or for a roadmap-bounded campaign (use `/proof-campaign`).
---

# crucible — two-layer gated build/critique loop, any project

Iterate a **target** (a module, package, service, or feature slice) through Spec → Build → Evidence →
Critique rounds until `gate.mjs` declares it CLOSED. Sibling of `/gauntlet`: same honesty chain, but the
rubric axes are **negotiated per project** rather than fixed, evidence comes from **contract-registered
instruments** rather than a pixel tool, and tests are a **hard gate** rather than an afterthought.

Every rule below is wired to a file, a gate, or a harness toggle — **anything the loop asserts about its own
behavior must land in one of those three.** A rule that can only be obeyed by remembering it is dropped after
the first compaction.

Load-bearing tools (exact contracts — do not re-derive them). `<dir>` = artifact dir, default `.crucible`:

```
node <dir>/tools/gate.mjs [--dir <dir>/critiques] [--json]     # full closure report, all targets
node <dir>/tools/gate.mjs --check <target>                      # exit 0 iff CLOSED — the SOLE closure authority
node <dir>/tools/gate.mjs --validate <file.json>                # schema-check one critique verdict
node <dir>/tools/gate.mjs --validate-contract [CONTRACT.json]   # schema-check the negotiated contract
node <dir>/tools/gate.mjs --verify-engine                       # sha256 every copied tool vs manifest.json
    --waive <target>:<axis>   # honor a waiver for THIS invocation only (repeatable)
    --cap N                   # iteration budget for THIS invocation only (default 40)
    --bar N                   # closure bar for every axis, 1-10 (default 8)
    --contract <path>         # contract location (default <dir>/CONTRACT.json)

node <dir>/tools/evidence.mjs run --target <t> --iter <N>       # run registered instruments -> evidence report
node <dir>/tools/evidence.mjs baseline --target <t>             # iteration-0 snapshot -> baseline/<t>.json
node <dir>/tools/testreport.mjs parse <file> --format <fmt>     # junit|tap|cargo-json|pytest-json|go-json|auto
node <dir>/tools/testreport.mjs behaviors <file> --map <b.json> # behavior id -> passing test resolution
node <dir>/tools/cover.mjs changed <cov> --format <fmt> --globs # coverage on CHANGED lines only
```

Every command supports `--json`; parse that, never scrape prose output.

**gate.mjs is STATELESS** — a pure function of the critiques dir, the evidence reports, and its flags;
`--waive`, `--cap`, and `--bar` persist nothing. The durable copy lives in a single STATUS.md line,
`Gate flags: --cap N [--bar N] [--waive t:axis ...]`, appended verbatim to EVERY gate invocation. A gate call
missing a recorded flag is consulting a different gate — treat its answer as void.

Exit codes — gate: report 0 · `--check` 0 CLOSED / 1 not-closed (reason on stdout) · `--validate*`,
`--verify-engine` 0/1 · 2 usage or I/O. evidence/testreport/cover: 0 pass · 1 measurement or parse failure ·
2 usage. **evidence.mjs's exit code reports instrument HEALTH, not gate outcome** — a clean run whose
coverage is below threshold still exits 0. Only the gate rules on quality.

## Slash invocation

```
/crucible [target|all] [--cap N] [--bar N] [--resume]
```

| Arg | Default | Meaning |
|---|---|---|
| `target` | `all` | One target from CONTRACT.json, or every target in sequence. |
| `--cap` | 40 | Iteration budget per target, enforced via `gate.mjs --cap N`. |
| `--bar` | 8 | Closure bar per axis, enforced via `gate.mjs --bar N`. |
| `--resume` | off | Re-enter a live loop: read the STATUS.md resume block + `gate.mjs --json`, resume the in-flight Workflow with `resumeFromRunId`. |

## Roles & artifacts

| Role | Who | Artifact |
|---|---|---|
| Referee | `gate.mjs` | the only thing that says CLOSED |
| Witness | critics | `<dir>/critiques/<target>_iter<N>.json` |
| Instrument | `evidence.mjs` + registered commands | `<dir>/evidence/<target>_iter<N>.json` |
| Clerk | you | STATUS.md, commits, residuals — never a score |

---

## Phase 0 — First-invocation checklist (BLOCKING)

Run every check; a failure is fixed before iteration 0 starts. Never skip on `--resume` — re-entry is exactly
when toggles and engine copies have been lost.

1. **Harness opt-in — ultracode ON for the SESSION via `/config`.** Tell the user to flip it and wait for
   confirmation. A keyword pasted in prompt text or embedded in `/loop` wakeup prompts does NOT survive
   re-entry — the opt-in lives in the message envelope, not the content. If the session toggle is not on,
   **STOP.** Do not substitute loose Agent calls for the iteration Workflow.
2. **Git repo, clean-enough tree.** The loop commits per iteration and coverage is computed from `git diff`.
   Uncommitted unrelated work must be committed or stashed first — the loop must never sweep it up.
3. **Engine installed and verified.** Copy this skill's bundled assets into `<dir>/tools/` —
   `gate.mjs`, `evidence.mjs`, `cover.mjs`, `testreport.mjs`, `iteration.js`, `SCHEMAS.md`, `AXES.md` — and
   `manifest.json` into `<dir>/` itself (its keys are `tools/`-relative to its own directory)
   (`<skill>` = the directory containing this SKILL.md, typically `~/.claude/skills/crucible/`; glob for
   `**/skills/crucible/assets/gate.mjs` if unsure). Then run `node <dir>/tools/gate.mjs --verify-engine`.
   **A mismatch STOPS the run** — either re-copy from the bundle or record an explicit override in the
   ledger with a reason. A hand-edited local gate is an unverified closure authority and voids every closure
   it grants. Verify again on every `--resume`. Never write these tools from memory.
4. **Negotiate the contract — the one human gate.** Scan the repo: language and package manager, test runner
   and its machine-readable reporter flag, coverage tooling, linter/typechecker, benchmark or perf harness,
   CI config, existing scripts, and which measurement surfaces are reachable (Chrome MCP, `unity-bridge`,
   `/run`, other skills). Then draft the full `CONTRACT.json` (schema: `assets/SCHEMAS.md` §1) — targets with
   **disjoint** source/test globs, the axis subset from `assets/AXES.md` with anchors tuned to this project,
   layer-1 thresholds, and the instrument registry. **Ask via AskUserQuestion about anything the scan leaves
   genuinely ambiguous** — which module is the target, what "good" means here, what the perf budget is —
   then present the draft for sign-off, accept edits, and write it. Validate with
   `gate.mjs --validate-contract`. Generate `<dir>/RUBRIC.md` from it (critics read the rubric; they never
   read CONTRACT.json, which carries thresholds and the bar). This is the ONLY blocking human gate; every
   phase after it is autonomous.
5. **Instrument precedence, when an axis has no number yet.** In order: (a) the project's own commands —
   test, lint, typecheck, bench, CI scripts; (b) available tooling — Chrome MCP, `unity-bridge`, `/run`,
   another skill, registered as `kind:"tool"` with its exact invocation and required output shape;
   (c) only if neither can produce the number, write a small probe, commit it to the target repo, and
   register it as `kind:"probe"`. Every instrument gets a registry line or it does not exist. An axis with no
   instrument scores `null` and blocks closure until measured or waived with cited evidence.
6. **Codex companion present** (powers the cross-model critic seat):
   `COMPANION=$(ls -d ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs 2>/dev/null | sort -V | tail -1)`
   non-empty and `node`-runnable. Missing → `/codex:setup` fixes it. If the user declines, **offer the
   all-Claude fallback explicitly at this gate and record their choice**: set `codexSeat: false` in
   CONTRACT.json, write `Judging: all-claude (companion declined <date>)` in STATUS.md, and every critique
   ledger row from then on carries `SANDBOX-DOWN`. A silent all-Claude jury is a routing defect; a consented
   one is a recorded degradation.
7. **Residual sink**: `itr stats` succeeds (`.itr.db` present) — else create `<dir>/RESIDUALS.md` and use it.
   Residuals go to a tracked file, never to prose.
8. **STATUS.md scaffolded** with the route ledger table (Phase 5), the resume block, and the
   `Gate flags: --cap N [--bar N]` line. Running `gate.mjs --cap N` once records nothing — the flag is
   per-invocation, so the STATUS.md line is the record and every subsequent gate call carries it.

---

## Phase 1 — Iteration 0: the baseline (no builder)

You cannot claim a delta without a before. Iteration 0 runs the iteration Workflow in baseline mode: no Spec,
no Build — `evidence.mjs baseline --target <t>` snapshots the failing-test set and every metric's starting
value into `<dir>/baseline/<target>.json`, then one critic scores every axis cold against the rubric.

- The baseline failure set is what makes `newFailures` meaningful forever after: a repo that ships with three
  known-broken tests stays usable, and only regressions block.
- An instrument that cannot produce its number **here** is a contract defect — fix the contract or the
  instrument before any code is touched. This is the cheapest place to discover a broken rig.
- Commit the baseline before iteration 1.

## Phase 2 — Iteration = ONE Workflow call

Each iteration is **ONE Workflow call** against the bundled script, never loose Agent calls:

```
Workflow({ scriptPath: "<dir>/tools/iteration.js", args: { target, iter, dir, gateFlags, seat, panel,
                                                           codexSeat, companion, priorCritique, findings,
                                                           sourceGlobs, testGlobs } })
```

Phases inside the script: **Spec → (Build ∥ blind Test-author) → Evidence → bounded Repair → Critique.**

- **Spec** pins the numbered behavior list (`B1`, `B2`, …) from the prior critique's findings, the interface
  both agents must agree on, and disjoint file ownership. Behaviors are the join key for functional coverage:
  a behavior is an externally observable statement phrased so a test can fail when it is false.
- **Build ∥ Test-author** run in parallel from the same spec, neither seeing the other's output. The builder
  owns the source globs and **must not touch a test file**; the test-author owns the test globs and writes
  the assertions the behaviors demand, not the assertions the implementation would pass. Each test's name
  carries its behavior id as a standalone token — that token is how the gate proves the behavior is pinned.
  A write outside an agent's declared globs stops the iteration before the commit.
- **Evidence** runs every registered instrument via `evidence.mjs`, patches in any `kind:"tool"` result with
  a cited transcript, and reports the gate's verdict verbatim. An instrument that failed to RUN is a broken
  rig: repair the rig, never the numbers, and re-run. **Never spawn a critic on missing evidence.**
- **Repair** fires only when layer 1 fails: up to **2 attempts**, builder fixes the SOURCE from the verbatim
  failing output. Editing a blind author's test to make it pass is score laundering. Still failing after 2 →
  the iteration ends `LAYER1-FAILED`, no critic spawns, and the failures roll into the next iteration's spec.
- **Critique** — Phase 3.

On a dead wakeup or compaction, resume the in-flight iteration with `resumeFromRunId` — never restart it from
scratch. If you are about to call Agent for a Spec/Build/Evidence/Repair/Critique step, **you have already
deviated: record it in the route ledger** (planned=workflow, actual=agent, reason code) before proceeding.

## Phase 3 — Critics: blind, instrumented, validated

**Blind.** The critic prompt contains EXACTLY: `RUBRIC.md`, the evidence report path, the prior critique path,
the source/test globs, and the registered instrument list. **Never** tell a critic what a score triggers, what
closure requires, how many consecutive rounds are needed, or that this is a confirmation round. Critics never
read CONTRACT.json — it carries the bar. Closure questions go to `gate.mjs`.

**Instrumented.** Every measured claim cites a registered instrument id, the exact command, and its verbatim
output. Hand-rolled measurement scripts are forbidden — if a needed number has no registered instrument, that
is a finding, not an improvisation.

**Mutation-backed.** `test_quality` is **unscorable without a mutation experiment**: break one behavior in the
source, run the registered test command, cite the output, revert, confirm the revert. A suite that stays green
under the mutation does not constrain behavior — that is a finding and a low score. `gate.mjs --validate`
rejects a non-null `test_quality` score with no `mutation` block. Never mutate a test file; never leave a
mutation in the tree.

**Validated.** Critic output lands in `critiques/` only after `gate.mjs --validate` passes. On rejection,
respawn the critic with the validator's error appended — hand-patching the JSON yourself is score laundering.

**Seats.** Regular rounds: 1 critic, alternating families by iteration parity (odd = Opus seat, even = Codex
seat) so the ledger reconciles without judgment calls. **A round whose builder ran on `opus-5` must be
critiqued by the Codex seat** — MODELS.md is explicit that Opus is not effective at judging its own work.
Confirmation rounds (the round that could produce the second consecutive all-≥bar): a **3-critic panel** —
correctness/error-handling lens, design/maintainability lens, and a **does-it-reproduce seat on Codex** that
re-derives the prior round's measured claims from fresh instrument runs and scores only what reproduces.
Per-axis score = median of the three; all verdicts are committed and the merged file is what the gate reads.
One same-family opinion closing a target is the exact gameability the panel prevents.

**The cross-model seat** runs through the codex plugin's companion runtime, read-only:

```bash
node "$COMPANION" task "<the blind critic prompt, verbatim>"     # NO --write, model/effort unset
```

Same contract, no exceptions: Codex runs the registered instruments itself and must cite commands and outputs
like any critic; it learns nothing about closure mechanics. You transcribe its stdout after `--validate`
passes. Companion failure → the seat reroutes to Opus AND the ledger row records `SANDBOX-DOWN`. The reroute
is legal; the silent all-Claude panel is not.

**Constraint caps.** When a critic proves a *constraint* (not effort) bounds an axis, append
`--waive <target>:<axis>` to the STATUS.md `Gate flags:` line AND append the evidence to RUBRIC.md
"Known caps". Waivers without a cited measurement are invalid.

## Phase 4 — Closure is gate.mjs, and it has two layers

```
node <dir>/tools/gate.mjs --check <target> <Gate flags>    # exit 0 iff CLOSED
node <dir>/tools/gate.mjs --json <Gate flags>              # full report for STATUS.md
```

(`<Gate flags>` = the recorded STATUS.md line — on every call, no exceptions.)

**Layer 1 (hard, binary)** — recomputed by the gate from the evidence report, never self-reported:
no new test failures vs the baseline set · changed-lines coverage ≥ `hard.coverage.min` (a low floor,
~70%, that catches whole files shipped with zero tests) · **every declared behavior resolved to a PASSING
test** (the real sufficiency check — functional coverage, not line coverage) · every declared metric inside
its threshold · every instrument ran clean.

**Layer 2 (scored)** — the two most recent critiques have every measured axis ≥ bar, waivers honored.

- Both layers pass → CLOSED. Proceed to Phase 5 reconciliation, then the next target.
- CONTINUE / CONFIRM → next iteration, seeded with the new findings.
- **BLOCKED** — layer 2 would close but layer 1 fails, or a null axis is unwaived, or an invalid critique
  poisons the record. Do NOT dispatch a builder: the fix is evidence or bookkeeping, not building.
- **PLATEAU** (3 consecutive critiques with no improvement in total measured score) or **CAPPED** (budget
  spent) → write `<dir>/PLATEAU-<target>.md` containing the verbatim `gate.mjs --json` report plus the open
  residual list, commit, and mark that target **terminal**. The run continues to the next target; a stuck
  module does not hold healthy ones hostage. The run ends when every target is CLOSED or terminal.

Do not argue with the gate, do not hand-count consecutive rounds, do not interpret a 7 as effectively-8.

## Phase 5 — Per-iteration bookkeeping (all mandatory, all files)

**1. Route ledger rows** — STATUS.md carries this exact table; append one row per stage (the Workflow returns
them ready to paste):

```markdown
## Route ledger
| iter | target | stage    | planned | actual | reason if differs |
|------|--------|----------|---------|--------|-------------------|
| 1    | parser | build    | gpt-5.5 | gpt-5.5| —                 |
| 2    | parser | critique | codex   | opus   | SANDBOX-DOWN      |
```

Reason codes: `SANDBOX-DOWN`, `TOOL-MISSING`, `RATE-LIMIT`, `TASTE-REQUIRED`, `AGENT-FAILED`,
`WORKFLOW-UNAVAILABLE` (record + fix Phase 0.1), `ENGINE-OVERRIDE` (Phase 0.3). **A blank reason where
planned≠actual is a closure blocker** — undeclared drift is invisible precisely because each local choice
looks reasonable.

**2. Score table — GENERATED.** Paste `gate.mjs --json`/report output verbatim (fenced). Never hand-edit a
score, a trajectory, or a closure claim. Hand-written prose in STATUS.md is limited to "Next action", the
resume block, and the ledger's reason cells.

**3. Resume block — rewritten every iteration.** Target, iteration N, in-flight `runId`, gate verdict, next
action. This is what `--resume` reads. Because each iteration is one Workflow call, agent tokens never touch
your context, so the orchestrator stays lean by construction — the resume block, not a token budget, is what
survives a compaction.

**4. Residuals at critique time** — every finding the builder will not fix this round, every blocker below
the bar, every disclosed trade: `itr add` it NOW (per the `itr` skill) citing the critique file and axis, or
append to `<dir>/RESIDUALS.md`. Residuals parked in prose are invisible to `/blitz` and every future loop.

**5. Ownership-scoped commit** — `git add` the target's declared globs plus this iteration's artifacts only.
Never `git add -A` / `git add .`; another agent's in-flight work must never be swept into a loop commit.

**Closure reconciliation** (before declaring any target closed): reconcile the ledger against BOTH
transcripts — `ccq` for Claude dispatches (`ccq agents -p <project> --root "C:\Users\Blue\.claude\projects"`)
and `cxq` for the Codex seat (`cxq sessions -p <project>`, `cxq tools`), so a `SANDBOX-DOWN` row is verified
rather than asserted. Either tool absent → skip with a note in the ledger. Any ledger row contradicted by a
transcript, or any dispatch missing a row, reopens bookkeeping. Gate exit 0 + clean two-sided reconciliation
= closed; either alone is not.

---

## Model routing

| Role | Model | Notes |
|---|---|---|
| Builder (default) | gpt-5.5 | The generalist does implementation work; keeps the Opus critic seat honest. |
| Builder (taste-critical) | opus-5 | Only for user-facing/taste surfaces. That round's critique MUST use the Codex seat. |
| Test-author (blind) | gpt-5.5 | Behavior-driven assertions are generalist work; a different family from the builder by default. |
| Critic (regular, odd iters) | opus-5 | Taste and design judgment — never over an `opus-5` builder's own output. |
| Critic (cross-model seat, even iters + panel) | Codex via companion `task`, read-only | Different family, different blind spots. Failure → Opus + `SANDBOX-DOWN` row. |
| Spec / Evidence / merge clerking | sonnet-5 | Mechanical stages stay off the flagship rungs and off your context. |
| Escalation on a missed round | gpt-5.6-terra → gpt-5.6-sol → fable-5 | Non-taste ladder per MODELS.md; record the escalation in the ledger. |

## Principles

- The gate is the referee; critics are witnesses; instruments are the record; you are the clerk. None may do another's job.
- Two layers because they catch different lies: layer 1 catches "it isn't tested", layer 2 catches "it isn't good".
- Functional coverage over line coverage — a behavior with no failing-when-broken test is untested, whatever the percentage says.
- Blind test-authoring + mutation-backed scoring + a validator = the honesty chain. Break any link and the scores are decoration.
- Every self-report must be reconcilable: ledger vs both transcripts, scores vs gate output, claims vs registered instruments.
- Deviation is allowed; undeclared deviation is a defect the next checkpoint reads as a defect.

## Don't

- Don't launch without the ultracode session toggle confirmed on, and don't substitute loose Agent calls for the iteration Workflow.
- Don't run with an unverified engine — `--verify-engine` on every Phase 0 and every `--resume`.
- Don't let the builder touch a test file, or the test-author touch source. Blindness is worthless if either can reach into the other's files.
- Don't weaken, skip, or delete a blind author's test to make a round pass. Report the contradiction and leave it failing.
- Don't score `test_quality` without a mutation experiment, and don't leave a mutation in the tree.
- Don't spawn a critic on a broken rig, on missing evidence, or on a failed layer 1.
- Don't tell a critic anything about closure mechanics, the bar, or round significance — and don't hand the Codex seat anything Claude critics are denied.
- Don't run an all-Claude panel while the companion is available, and don't route a critique of `opus-5` output to `opus-5`.
- Don't invoke `gate.mjs` without the recorded `Gate flags:` line — the tool is stateless, and a flagless call silently drops every waiver and the cap.
- Don't declare closure yourself — only `gate.mjs --check` exit 0 plus a reconciled ledger closes a target.
- Don't hand-edit scores, critique JSONs, evidence reports, or STATUS score tables — regenerate them.
- Don't park residuals in prose, and don't exceed 2 repair attempts inside one iteration.
