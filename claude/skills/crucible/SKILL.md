---
name: crucible
description: Run (or resume) a two-layer, rubric-gated autonomous build/critique loop on ANY project — the whole chain of targets is built first, one Workflow per link (Spec → Build ∥ blind test-author → Evidence → bounded Repair) with only the hard gate between links, then critiqued once it works end to end, with fix rounds only where an axis is below the bar; a hard layer-1 gate (no new test failures, changed-lines coverage, every declared behavior pinned by a passing test, declared metric thresholds) plus blind instrumented critics scored against a negotiated rubric, closure decided solely by `gate.mjs`, evidence produced only by contract-registered instruments, routing reconciled via a mandatory route ledger. Trigger when the user types `/crucible`, or asks to "run the crucible loop", "iterate this module until it's actually good", "rubric-gated loop with real tests", "autonomous build/critique loop on this package", "resume the crucible", or similar. Do NOT trigger for a visual/pixel subsystem where the measurement IS the pixels (use `/gauntlet` — it carries a verified pixel instrument), for a single one-off review (use `/code-review`), for clearing a task backlog in parallel (use `/blitz`), or for a roadmap-bounded campaign (use `/proof-campaign`).
---

# crucible — two-layer gated build/critique loop, any project

Build a **chain of targets** (modules, packages, services, or feature slices, each built on the one before)
through Spec → Build → Evidence links, then critique what was built until `gate.mjs` declares each target
CLOSED. Sibling of `/gauntlet`: same honesty chain, but the rubric axes are **negotiated per project** rather
than fixed, evidence comes from **contract-registered instruments** rather than a pixel tool, and tests are a
**hard gate** rather than an afterthought.

**Building comes first and critique is spent sparingly.** The hard gate (tests, declared behaviors, coverage,
metrics) is mechanical and cheap, so it sits between every pair of links. A critic costs about as much as the
build it judges, so critics run once the chain works end to end, each target closes on its first critique at
the bar, and another scored round is spent only on an axis that is below it. A run that polishes its first
layers and never reaches the last one has failed, whatever its scores say.

Every rule below is wired to a file, a gate, or a harness toggle — **anything the loop asserts about its own
behavior must land in one of those three.** A rule that can only be obeyed by remembering it is dropped after
the first compaction.

Load-bearing tools (exact contracts — do not re-derive them). `<dir>` = artifact dir, default `.crucible`:

```
node <dir>/tools/gate.mjs [--dir <dir>/critiques] [--json]     # full closure report, all targets
node <dir>/tools/gate.mjs --check <target>                      # exit 0 iff CLOSED — the SOLE closure authority
node <dir>/tools/gate.mjs --layer1 <target> --iter <N>          # exit 0 iff that link passes the hard layer — what advances the chain
node <dir>/tools/gate.mjs --validate <file.json>                # schema-check one critique verdict
node <dir>/tools/gate.mjs --validate-contract [CONTRACT.json]   # schema-check the negotiated contract, budget included
node <dir>/tools/gate.mjs --verify-engine                       # sha256 every copied tool vs manifest.json
    --waive <target>:<axis>   # honor a waiver for THIS invocation only (repeatable)
    --cap N                   # scored rounds allowed PER TARGET (default 4)
    --run-cap N               # scored rounds allowed over ALL targets (default: none)
    --confirm N               # critiques in a row at the bar that close a target (default 1)
    --bar N                   # closure bar for every axis, 1-10 (default 8)
    --contract <path>         # contract location (default <dir>/CONTRACT.json)

node <dir>/tools/evidence.mjs run --target <t> --iter <N>       # run registered instruments -> evidence report
node <dir>/tools/evidence.mjs run --target <t> --iter <N> --scratch   # re-measure without replacing that report
node <dir>/tools/evidence.mjs baseline --target <t>             # iteration-0 snapshot -> baseline/<t>.json
node <dir>/tools/testreport.mjs parse <file> --format <fmt>     # junit|tap|cargo-json|pytest-json|go-json|auto
node <dir>/tools/testreport.mjs behaviors <file> --map <b.json> # behavior id -> passing test resolution
node <dir>/tools/cover.mjs changed <cov> --format <fmt> --globs # coverage on CHANGED lines only
```

Every command supports `--json`; parse that, never scrape prose output.

**gate.mjs is STATELESS** — a pure function of the critiques dir, the evidence reports, and its flags;
`--waive`, `--cap`, `--run-cap`, `--confirm`, and `--bar` persist nothing. The durable copy lives in a single
STATUS.md line, `Gate flags: --cap N [--run-cap N] [--confirm N] [--bar N] [--waive t:axis ...]`, appended
verbatim to EVERY gate invocation. A gate call missing a recorded flag is consulting a different gate — treat
its answer as void. (`--layer1` reads none of them: the hard layer has no budget and no bar.)

**Budgets count scored rounds — merged critiques — and nothing else.** A build link, a repair and a baseline
are never counted. `--cap` is one target's budget and `--run-cap` is the whole run's: they are two numbers
because one number read both ways ends a multi-target run at its first few targets.

Exit codes — gate: report 0 · `--check` 0 CLOSED / 1 not-closed (reason on stdout) · `--validate*`,
`--verify-engine` 0/1 · 2 usage or I/O. evidence/testreport/cover: 0 pass · 1 measurement or parse failure ·
2 usage. **evidence.mjs's exit code reports instrument HEALTH, not gate outcome** — a clean run whose
coverage is below threshold still exits 0. Only the gate rules on quality.

## Slash invocation

```
/crucible [target|all] [--cap N] [--run-cap N] [--confirm N] [--bar N] [--resume]
```

| Arg | Default | Meaning |
|---|---|---|
| `target` | `all` | One target from CONTRACT.json, or the whole chain in contract order. |
| `--cap` | 4 | Scored rounds per target, enforced via `gate.mjs --cap N`. |
| `--run-cap` | none | Scored rounds over the whole run, enforced via `gate.mjs --run-cap N`. |
| `--confirm` | 1 | Critiques in a row at the bar that close a target. `2` buys a confirmation round (and its panel) for every target; ask for it only where one critic's word is not enough. |
| `--bar` | 8 | Closure bar per axis, enforced via `gate.mjs --bar N`. |
| `--resume` | off | Re-enter a live loop: read the STATUS.md resume block + `gate.mjs --json`, resume the in-flight Workflow with `resumeFromRunId`. |

**A single number from the user is the run's budget.** "Cap it at 10" means ten scored rounds for the run:
record it as `runCap` in the contract and `--run-cap 10` in the gate flags, leave `--cap` at its default, and
ask nothing. `--validate-contract` refuses a `runCap` the declared targets cannot close within.

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
2. **Git repo, clean-enough tree.** The loop commits per link and per critique, and coverage is computed from `git diff`.
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
   `/run`, other skills). Then draft the full `CONTRACT.json` (schema: `assets/SCHEMAS.md` §1) — targets **in
   build order** (the array is the chain: each target may use the ones before it) with **disjoint**
   source/test globs and a `brief` each (what it has to deliver, and which documents say so — the first Spec
   stage works from it), the axis subset from `assets/AXES.md` with anchors tuned to this project,
   layer-1 thresholds, the budget (`cap`, `runCap`, `confirm`), and the instrument registry. Agree the
   **outcome** at the same sitting: one sentence on what a person can do once the chain is built, and the
   exact command that shows it. It goes in STATUS.md as `Outcome: <sentence> — shown by: <command>` and is
   what Phase 2 builds toward. **Ask via AskUserQuestion about anything the scan leaves
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
8. **STATUS.md scaffolded** with the route ledger table (Phase 5), the resume block, the `Outcome:` line,
   and the `Gate flags: --cap N [--run-cap N] [--confirm N] [--bar N]` line. Running `gate.mjs --cap N` once
   records nothing — the flag is per-invocation, so the STATUS.md line is the record and every subsequent
   gate call carries it.

---

## Phase 1 — Iteration 0: the baseline (no builder, no critic)

You cannot claim a delta without a before. Iteration 0 runs the iteration Workflow in baseline mode: no Spec,
no Build, no critic — `evidence.mjs baseline --target <t>` snapshots the failing-test set and every metric's
starting value into `<dir>/baseline/<target>.json`. Take every target's baseline before the first link, one
Workflow call each.

- The baseline failure set is what makes `newFailures` meaningful forever after: a repo that ships with three
  known-broken tests stays usable, and only regressions block.
- An instrument that cannot produce its number **here** is a contract defect — fix the contract or the
  instrument before any code is touched. This is the cheapest place to discover a broken rig.
- A baseline is a measurement. Scoring code that does not exist yet tells nobody anything and used to cost
  one scored round per target; pass `critique: true` only for a target that already has code worth a cold read.
- Commit the baselines before the first link.

## Phase 2 — Build the chain, then critique it

A run is a **chain**: the contract's targets in order, each one a **link** built on the ones before it. A
single-target run is a chain of one. Every Workflow call goes to the bundled script, never to loose Agent calls:

```
Workflow({ scriptPath: "<dir>/tools/iteration.js", args: { target, iter, dir, mode, critique, brief,
                                                           seat, panel, codexSeat, companion, criticModel,
                                                           priorCritique, findings, sourceGlobs, testGlobs } })
```

**Step 1 — build every link, with no critic between them.** For each target in contract order, one call with
`critique: false` and the target's `brief`. The script runs **Spec → (Build ∥ blind Test-author) → Evidence →
bounded Repair** and returns `LINK-DONE` once the hard layer holds. Then:

- run `gate.mjs --layer1 <target> --iter <N>` yourself — exit 0 is what lets the chain move on, not the
  script's word for it;
- do the Phase 5 bookkeeping and the ownership-scoped commit;
- start the next link in the same turn. A link landing is not a reason to stop, summarize, or ask anything.

A link is the whole target as its brief describes it. Do not cut a target into several rounds so that
something can be scored between them. `LAYER1-FAILED` (two repairs spent) → one more link for the same target
at the next iteration number, with the failing clauses as its `findings`. Failing again → write
`<dir>/PLATEAU-<target>.md`, mark it terminal, and carry on with every later target that can be built without
it.

**Step 2 — show the outcome.** When the last link has landed, run the command on STATUS.md's `Outcome:` line.
If it does not do what the sentence says, what is missing is building work, not a finding: build it as one
more link on the target that owns it. No critic runs before the outcome does. Tell the user, in one line, the
command they can now run.

**Step 3 — critique what was built.** One call per target that is `UNSCORED` in the gate report, with
`mode: "critique"` and `iter` set to that target's latest link. The script spawns the critic and nothing else:
the link's own evidence report is the record. Run these calls **one at a time** — every critic runs a mutation
experiment in the one working tree.

**Step 4 — fix rounds, only below the bar.** For each target the gate reports `CONTINUE`, one full round
(`critique` left at its default) whose `findings` are the gate's work order: the findings on the axes below
the bar, and no others. Everything else a critic found goes to the residual sink (Phase 5.4) and costs no
round. Repeat until the gate says CLOSED, CAPPED or PLATEAU for every target.

To critique each link as it lands instead — the old shape — leave `critique` at its default in step 1. Do that
only when a later target cannot be built at all on an unjudged one, and say why in STATUS.md.

Phases inside the script: **Spec → (Build ∥ blind Test-author) → Evidence → bounded Repair → Critique**, with
Critique skipped on a build link and the only phase of a deferred critique.

- **Spec** pins the numbered behavior list (`B1`, `B2`, …) from the target's brief on a first build, or from
  the prior critique's findings on a fix round, plus the interface both agents must agree on and disjoint
  file ownership. Behaviors are the join key for functional coverage:
  a behavior is an externally observable statement phrased so a test can fail when it is false.
- **Build ∥ Test-author** run in parallel from the same spec, neither seeing the other's output. The builder
  owns the source globs and **must not touch a test file**; the test-author owns the test globs and writes
  the assertions the behaviors demand, not the assertions the implementation would pass. Each test's name
  carries its behavior id as a standalone token — that token is how the gate proves the behavior is pinned.
  A write outside an agent's declared globs stops the iteration before the commit.
- **Evidence** runs every registered instrument via `evidence.mjs`, patches in any `kind:"tool"` result with
  a cited transcript, and reports `gate.mjs --layer1`'s verdict verbatim. An instrument that failed to RUN is a broken
  rig: repair the rig, never the numbers, and re-run. **Never spawn a critic on missing evidence.**
- **Repair** fires only when layer 1 fails: up to **2 attempts**, builder fixes the SOURCE from the verbatim
  failing output. Editing a blind author's test to make it pass is score laundering. Still failing after 2 →
  the iteration ends `LAYER1-FAILED`, no critic spawns, and the failures roll into the next iteration's spec.
- **Critique** — Phase 3.

On a dead wakeup or compaction, resume the in-flight iteration with `resumeFromRunId` — never restart it from
scratch. If you are about to call Agent for a Spec/Build/Evidence/Repair/Critique step, **you have already
deviated: record it in the route ledger** (planned=workflow, actual=agent, reason code) before proceeding.

## Phase 3 — Critics: blind, instrumented, validated, and few

**Few.** A critic runs in two places only: Phase 2 step 3 (once per built target, after the outcome runs) and
the end of a fix round. Never on a baseline, never between links, and never a second time on a target that
is already at the bar. In the first run of this loop on a four-target chain, re-rounds took more time than
first builds and the critic used as many tokens as the builder, while the last target was never started.

**Held to what was declared.** A target answers for its declared behaviors and the rubric's anchors. A
sentence in a comment or a doc that no behavior declares goes in the critique's `notes` and from there to the
residual sink: it is not scored, not a mutation target, and never the reason for a round. A critic runs at
most three mutations, each on a declared behavior.

**Never a record-writer.** Critics run instruments with `evidence.mjs run … --scratch`. The round's evidence
report is the gate's input and is written once, by the Evidence stage.

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
seat) so the ledger reconciles without judgment calls. **A round whose builder ran on `opus-5.5` must be
critiqued by the Codex seat** — MODELS.md is explicit that Opus is not effective at judging its own work —
unless the project's own instructions set a different review rule, which then governs and is recorded in
STATUS.md (`Judging:` line). `criticModel` puts every Claude critic seat on a named model.
Confirmation rounds exist only under `--confirm 2` or more (the round that could produce the last
consecutive all-≥bar): a **3-critic panel**, run one seat at a time —
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

**Layer 2 (scored)** — the `confirm` most recent critiques (one, by default) have every measured axis ≥ bar,
waivers honored. A target at the bar on its first critique is CLOSED on that critique. Scores above the bar
buy nothing: there is no round whose purpose is to turn an 8 into a 9.

- **UNSCORED** — built, hard layer reported, no critique yet. The normal state of every link during Phase 2
  step 1; it becomes a critique in step 3, not before.
- Both layers pass → CLOSED. Proceed to Phase 5 reconciliation, then the next target.
- CONTINUE → a fix round (Phase 2 step 4), seeded with the gate's work order. CONFIRM (only under
  `--confirm 2`+) → a confirmation round.
- **BLOCKED** — layer 2 would close but layer 1 fails, or a null axis is unwaived, or an invalid critique
  poisons the record. Do NOT dispatch a builder: the fix is evidence or bookkeeping, not building.
- **PLATEAU** (3 consecutive critiques with no improvement in total measured score) or **CAPPED** (the
  target's `--cap` spent, or the run's `--run-cap`) → write `<dir>/PLATEAU-<target>.md` containing the
  verbatim `gate.mjs --json` report plus the open residual list, commit, and mark that target **terminal**.
  A target at its own cap does not stop the others; a stuck module does not hold healthy ones hostage. A
  spent run cap ends the scored part of the run for every target still open. The run ends when every target
  is CLOSED or terminal.

**A spent budget is a result, not a question.** Do not ask the user to raise the cap, lower the bar or change
`confirm` in the middle of a run, and do not change them yourself. Write the PLATEAU file, finish what the
budget still allows, and report what closed, what did not and what it would take. The place to get the budget
right is the contract: `--validate-contract` refuses one that cannot close the declared targets.

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

**Where `actual` comes from.** The Workflow's rows say `workflow` for a stage that ran inside the Workflow:
they record that the stage ran, not which model ran it. When the Seat Guard mod is loaded, its
`mcp__seat-guard__ledger` tool is listed: call it with `filter: "crucible:<target>#<iter>"` once the Workflow
returns. Every agent of an iteration opens its prompt with a `[seat crucible:<target>#<iter> <stage>]` line, so
each row of the answer names a stage, the model the engine sent that seat's requests to, and any Codex run
the seat launched (a run that came back as an error is marked `failed`). Write those model names in the
`actual` column in place of `workflow`. A seat planned for Codex that launched no Codex run, or only failed
ones, did not run on Codex: record the model it did run on as `actual` and give the reason code. The mod is
machine-local; where the tool is not listed, paste the Workflow's rows as returned.

**2. Score table — GENERATED.** Paste `gate.mjs --json`/report output verbatim (fenced). Never hand-edit a
score, a trajectory, or a closure claim. Hand-written prose in STATUS.md is limited to "Next action", the
resume block, and the ledger's reason cells.

**3. Resume block — rewritten every link and every critique.** Which step of Phase 2 the chain is in, target,
iteration N, in-flight `runId`, gate verdict, next action. This is what `--resume` reads. Because each iteration is one Workflow call, agent tokens never touch
your context, so the orchestrator stays lean by construction — the resume block, not a token budget, is what
survives a compaction.

**4. Residuals at critique time** — every finding on an axis that is at the bar, every entry in a critique's
`notes`, every finding the builder will not fix this round, every disclosed trade: `itr add` it NOW (per the `itr` skill) citing the critique file and axis, or
append to `<dir>/RESIDUALS.md`. Residuals parked in prose are invisible to `/blitz` and every future loop.

**5. Ownership-scoped commit** — `git add` the target's declared globs plus this iteration's artifacts only.
Never `git add -A` / `git add .`; another agent's in-flight work must never be swept into a loop commit.

**Closure reconciliation** (before declaring any target closed): reconcile the ledger against BOTH
transcripts — `ccq` for Claude dispatches (`ccq agents -p <project> --root "C:\Users\Blue\.claude\projects"`)
and `cxq` for the Codex seat (`cxq sessions -p <project>`, `cxq tools`), so a `SANDBOX-DOWN` row is verified
rather than asserted. Either tool absent → skip with a note in the ledger. Rows whose `actual` was copied from the Seat Guard
ledger tool are the engine's own record already; the transcript check is for the rows that were not. Any ledger row contradicted by a
transcript, or any dispatch missing a row, reopens bookkeeping. Gate exit 0 + clean two-sided reconciliation
= closed; either alone is not.

---

## Model routing

| Role | Model | Notes |
|---|---|---|
| Builder (default) | gpt-5.5 | The generalist does implementation work; keeps the Opus critic seat honest. |
| Builder (taste-critical) | opus-5.5 | Only for user-facing/taste surfaces. That round's critique MUST use the Codex seat. |
| Test-author (blind) | gpt-5.5 | Behavior-driven assertions are generalist work; a different family from the builder by default. |
| Critic (regular, odd iters) | opus-5.5 | Taste and design judgment — never over an `opus-5.5` builder's own output. |
| Critic (cross-model seat, even iters + panel) | Codex via companion `task`, read-only | Different family, different blind spots. Failure → Opus + `SANDBOX-DOWN` row. |
| Spec / Evidence / merge clerking | sonnet-5 | Mechanical stages stay off the flagship rungs and off your context. |
| Escalation on a missed round | gpt-5.6-terra → gpt-6-astra → fable-5.1 | Non-taste ladder per MODELS.md (gpt-6-sol's rung is skipped while it is unavailable); record the escalation in the ledger. |

The bundled script sets a model for the Claude critic seats only (`criticModel`). Every other seat runs on the
session model, whatever this table plans: record that in the ledger as planned ≠ actual with `TOOL-MISSING`,
once per stage, and do not edit the script to change it mid-run.

## Principles

- Finish the chain before judging it. A working end-to-end result with residuals beats a first layer at 9 and nothing a person can run.
- The hard gate is cheap and sits between every link; a critic is dear and is spent once per target, then only below the bar.
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
- Don't spawn a critic on a baseline, between links, or on a target already at the bar, and don't run a round to answer findings on an axis that is at the bar — those are residuals.
- Don't stop, summarize or ask between links; the chain runs to the outcome on its own.
- Don't ask the user to raise the cap, lower the bar or change `confirm` mid-run, and don't change them yourself. A spent budget is reported, not negotiated.
- Don't let a critic run instruments without `--scratch` — the evidence record is written once, by the Evidence stage.
- Don't tell a critic anything about closure mechanics, the bar, or round significance — and don't hand the Codex seat anything Claude critics are denied.
- Don't run an all-Claude panel while the companion is available, and don't route a critique of `opus-5.5` output to `opus-5.5`.
- Don't invoke `gate.mjs` without the recorded `Gate flags:` line — the tool is stateless, and a flagless call silently drops every waiver and the cap.
- Don't declare closure yourself — only `gate.mjs --check` exit 0 plus a reconciled ledger closes a target.
- Don't hand-edit scores, critique JSONs, evidence reports, or STATUS score tables — regenerate them.
- Don't park residuals in prose, and don't exceed 2 repair attempts inside one iteration.
