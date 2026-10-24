---
name: crucible
description: Run (or resume) a two-layer, rubric-gated autonomous build/critique loop on ANY project — the work is laid out as milestones that together cover everything the spec proposes (planning must be finished for every one of them before the run starts), a milestone is met only when the gate closes every target in it and its outcome command runs, the loop is run exactly as written, work that does not fit it is told so and pointed to a workflow that does, and within a milestone the whole chain of targets is built first, one Workflow per link (Spec → Build ∥ blind test-author → Evidence → bounded Repair) with only the hard gate between links, then critiqued once it works end to end, with fix rounds only where an axis is below the bar; a hard layer-1 gate (no new test failures, changed-lines coverage, every declared behavior pinned by a passing test, declared metric thresholds) plus blind instrumented critics scored against a negotiated rubric, closure decided solely by `gate.mjs`, evidence produced only by contract-registered instruments, routing reconciled via a mandatory route ledger. Trigger when the user types `/crucible`, or asks to "run the crucible loop", "iterate this module until it's actually good", "rubric-gated loop with real tests", "autonomous build/critique loop on this package", "resume the crucible", or similar. Do NOT trigger for a visual/pixel subsystem where the measurement IS the pixels (use `/gauntlet` — it carries a verified pixel instrument), for a single one-off review (use `/code-review`), for clearing a task backlog in parallel (use `/blitz`), or for a roadmap-bounded campaign (use `/proof-campaign`).
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

**The run is measured in milestones, and a milestone has to be met.** A milestone is a stage of the work a
person can use: an outcome sentence, the command that shows it, and the targets that make it up. **Everything
the project's spec and roadmap propose is work to be done**, and the contract covers all of it, as milestones
in order. A milestone is **met** when the gate has CLOSED every target in it and its command does what its
sentence says — nothing less. The run is finished when every milestone is met, or is reported as not met with
what it would take. Part of the work is never "the scope" because it happened to be the part that was
specified, came first, or fit the budget.

## Run the loop as written, or say that the work does not fit it

**This loop is followed exactly as this file describes it. It is not a menu and not a starting point.** The
order is fixed:

1. Planning check, fit check, then the contract — covering every milestone.
2. Baselines: measured, never scored.
3. For each milestone in order: build every link, with only the hard gate between links → run the
   milestone's outcome command → critique each of its targets once → fix rounds only on an axis below the bar
   → the milestone is met → the next milestone starts in the same turn.

Do not reorder, skip, add or repeat a step on your own judgement. No critic between links. No critique of a
baseline. No closing one target before the next one is built. No round whose purpose is a higher score. No
stopping to report between links: the one line allowed between them is a `pace BEHIND` warning (Phase 5.6),
and the chain carries on after it. No bookkeeping beyond Phase 5. No reading "milestone 1" as "the run". If you
notice you are doing something this file does not describe, stop doing it and return to the step you left.

**If the work does not fit the loop, SAY SO, in those words, and do not run it.** The work fits only when
every one of these holds (the **fit check**, run in Phase 0 before the contract and again whenever the facts
change):

- Every milestone can be given an outcome sentence and a command that shows it.
- The work divides into targets with disjoint files, in a build order, few enough to be one chain per
  milestone. A roadmap of dozens of rows is a campaign, not a chain.
- "Good" can be measured by registered instruments — tests, declared behaviors, metrics — and not only by eye.
- The agreed budget can close every milestone (`--validate-contract` checks the arithmetic).
- The loop can be run as written on this machine: the Workflow toggle is on, the engine verifies, every seat
  the contract needs can run its instruments.

When any of them fails, the first thing the user reads is: **"This work does not fit the crucible loop,
because <the check that failed>."** Then name the workflow that does fit and why, and wait for their choice:

| The work is… | Use |
|---|---|
| a whole roadmap, many rows, closed only on proof | `/proof-campaign`, or `/rolling-campaign` when it will not fit one context |
| greenfield, or "take this from brief to working": the smallest runnable end-to-end path first | `/mission` |
| a backlog of independent tasks that can run side by side | `/blitz` |
| one feature in one sitting | `/feature-build` |
| a visual subsystem where the measurement is the pixels | `/gauntlet` |
| one review of work that already exists | `/code-review` |

Never bend the loop to make the work fit, never bend the work (cut it down, pick the part that fits) to make
the loop fit, and never run some other shape of loop under this name. The same holds in the middle of a run:
when a step cannot be carried out as written — a seat cannot run, the engine cannot do what a phase asks, the
budget cannot close what is left — stop at that step, say which step and why, and offer the choices: repair
the rig, change the contract with the user's yes, or move the rest of the work to a workflow that fits.
Carrying on in an improvised shape is the one thing not on that list.

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

The full report carries a `pace` block: what the progress so far should have cost (one build link and one
critique per target) against what it did cost (every evidence report plus every scored round). Its `state`
is `EARLY`, `ON-PACE` or `BEHIND`. `BEHIND` fires at half the expected pace, or once the run cap left cannot
close the open targets; each reason is one string in `pace.warnings`. Pace reports and never changes a
target's state.

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
4. **Check that planning is finished, then negotiate the contract — the one human gate.**
   **Planning check (BLOCKING, before any contract is drafted).** Read the spec and the roadmap whole and list
   every milestone they propose. Everything proposed is work to be done, whatever the document calls it:
   "later", "v2", "phase 2", "fast follow", "deferred", "not specified here". Each milestone must be planned
   to the same depth as the first: requirements a numbered behavior list can be written from, acceptance, and
   an outcome a command can show. A milestone that is a heading and a sentence is not planned, and a spec that
   is detailed up to some point and thin after it is an unfinished plan, not a scope. If any milestone is
   thinner than the first, **planning is not finished: STOP.** Tell the user which milestones are thin and
   what each is missing, and finish the spec with them (`/alignment`, `/spec-writer`) before any contract,
   baseline or build. Do not start on the part that happens to be specified while the rest waits. Only the
   user takes work out of the run, in so many words; agreeing to an order of delivery ("that can be
   milestone 2", "start with the core") takes nothing out.
   **Fit check (BLOCKING, before any contract is drafted).** Run the five checks under "Run the loop as
   written, or say that the work does not fit it". If one fails, do not draft a contract: tell the user
   "This work does not fit the crucible loop, because …", name the workflow that does, and wait. Write the
   result in STATUS.md as `Fit: yes — <date>` or do not start.
   **Then the contract.** Scan the repo: language and package manager, test runner
   and its machine-readable reporter flag, coverage tooling, linter/typechecker, benchmark or perf harness,
   CI config, existing scripts, and which measurement surfaces are reachable (Chrome MCP, `unity-bridge`,
   `/run`, other skills). Then draft the full `CONTRACT.json` (schema: `assets/SCHEMAS.md` §1) — targets **in
   build order** (the array is the chain: each target may use the ones before it) with **disjoint**
   source/test globs and a `brief` each (what it has to deliver, and which documents say so — the first Spec
   stage works from it), the axis subset from `assets/AXES.md` with anchors tuned to this project,
   layer-1 thresholds, the budget (`cap`, `runCap`, `confirm`), and the instrument registry. The targets
   cover **every milestone**, grouped by milestone in order; the budget is sized for all of them. Agree each
   milestone's **outcome** at the same sitting: one sentence on what a person can do once that milestone is
   built, and the exact command that shows it. Each goes in STATUS.md as
   `Milestone <n>: <sentence> — shown by: <command> — targets: <a, b, c>` (a run with one milestone has one
   such line) and is what Phase 2 builds toward. Before sign-off, show the user a table of milestone →
   targets → the spec sections they cover, and one line `Not covered by this contract: <list, or nothing>`.
   A contract that covers less than the spec proposes is presented as exactly that and needs the user's yes
   to what is left out; it is never the default. **Ask via AskUserQuestion about anything the scan leaves
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
6. **Codex seat ready** (powers the cross-model critic seat): `codex login status` succeeds and the
   `codex-seat` skill's launcher exists — `<skills-dir>/codex-seat/scripts/codex-seat.sh`, passed to the
   script as `seatScript` (absolute path). Missing → `codex login` / install the skill. If the user declines, **offer the
   all-Claude fallback explicitly at this gate and record their choice**: set `codexSeat: false` in
   CONTRACT.json, write `Judging: all-claude (codex seat declined <date>)` in STATUS.md, and every critique
   ledger row from then on carries `SANDBOX-DOWN`. A silent all-Claude jury is a routing defect; a consented
   one is a recorded degradation.
7. **Residual sink**: `itr stats` succeeds (`.itr.db` present) — else create `<dir>/RESIDUALS.md` and use it.
   Residuals go to a tracked file, never to prose.
8. **STATUS.md scaffolded** with the route ledger table (Phase 5), the resume block, one `Milestone <n>:` line per milestone,
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
single-target run is a chain of one. **The chain is worked one milestone at a time:** steps 1 to 4 below run
for the first milestone's targets until that milestone is met, then for the next milestone's, in the same
turn, to the last. The strict review (steps 3 and 4, both gate layers) is held at every milestone and is not
thinned for a later one. Every Workflow call goes to the bundled script, never to loose Agent calls:

```
Workflow({ scriptPath: "<dir>/tools/iteration.js", args: { target, iter, dir, mode, critique, brief,
                                                           builtBy, seat, panel, codexSeat, seatScript, codexModel, codexEffort, criticModel,
                                                           priorCritique, findings, sourceGlobs, testGlobs } })
```

**Step 1 — build every link of the milestone, with no critic between them.** For each of its targets in contract order, one call with
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

**Step 2 — show the outcome.** When the milestone's last link has landed, run the command on its STATUS.md `Milestone <n>:` line.
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
round. Repeat until the gate says CLOSED, CAPPED or PLATEAU for every target of the milestone.

**Meeting the milestone.** A milestone is **met** when `gate.mjs --check` exits 0 for every one of its targets
and its outcome command, run again after the last fix round, still does what its sentence says. Write
`— met <date>` at the end of its STATUS.md line, tell the user in one line, and start the next milestone's
step 1 in the same turn. If one of its targets ended CAPPED or PLATEAU, the milestone is **not met**: write
`— NOT MET: <target>: <gate state>` on its line and never describe it as done, finished or complete. Carry on
with every later milestone that can be built without what is missing. The run's final report opens with the
list of milestones, each met or not met, before any score or count.

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

**Seats.** Regular rounds: 1 critic, and **the critic follows the builder**: the family that did not build
the round judges it. Pass the model the build actually ran on (the ledger's `build` row) as `builtBy`; the
script then puts a Claude-built round on the Codex seat and a GPT-built round on a Claude critic, so the
ledger reconciles without judgment calls. The bundled script builds on the session model, so unset
`builtBy` means Claude-built. `seat` overrides the choice; record why in STATUS.md. Opus never judges its
own work (MODELS.md) — unless the project's own instructions set a different review rule, which then
governs and is recorded in STATUS.md (`Judging:` line). When the other family is unavailable, a different
model of the same family is the minimum: `criticModel` puts every Claude critic seat on a named model, and
it must not be the builder's.
Confirmation rounds exist only under `--confirm 2` or more (the round that could produce the last
consecutive all-≥bar): a **3-critic panel**, run one seat at a time —
correctness/error-handling lens, design/maintainability lens, and a **does-it-reproduce seat from the
other family than the builder** (Codex for a Claude-built round) that
re-derives the prior round's measured claims from fresh instrument runs and scores only what reproduces.
Per-axis score = median of the three; all verdicts are committed and the merged file is what the gate reads.
One same-family opinion closing a target is the exact gameability the panel prevents.

**The cross-model seat** is a read-only codex seat (the `codex-seat` skill) on the **`frontier`** role in
`~/.claude/MODELS.md` — the cross-model judge of Claude work. Resolve it once per run and pass it to the script
as `codexModel` / `codexEffort` (unset, the script falls back to gpt-6-astra at `high`):

```bash
read -r CODEX_M CODEX_E < <(awk -F'|' '{r=$2; gsub(/ /,"",r)} r=="frontier"{m=$3; e=$4; gsub(/ /,"",m); gsub(/ /,"",e); print m, e; exit}' ~/.claude/MODELS.md)
bash "$SEAT_SH" run -d <dir>/seats/<target>_iter<N> -m "$CODEX_M" -e "$CODEX_E" -s read-only
# brief.md = the blind critic prompt, verbatim; out.md = its final message, the critique JSON
```

Same contract, no exceptions: Codex runs the registered instruments itself and must cite commands and outputs
like any critic; it learns nothing about closure mechanics. You transcribe `out.md` after `done` reads
`exit=0` and `--validate` passes. Seat failure → the seat reroutes to Opus AND the ledger row records `SANDBOX-DOWN`. The reroute
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
| 1    | parser | build    | gpt-6.1-sol | gpt-6.1-sol | —             |
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

**3. Resume block — rewritten every link and every critique.** Which milestone and which step of Phase 2 the chain is in, target,
iteration N, in-flight `runId`, gate verdict, the report's `pace` line, next action. This is what `--resume` reads. Because each iteration is one Workflow call, agent tokens never touch
your context, so the orchestrator stays lean by construction — the resume block, not a token budget, is what
survives a compaction.

**4. Residuals at critique time** — every finding on an axis that is at the bar, every entry in a critique's
`notes`, every finding the builder will not fix this round, every disclosed trade: `itr add` it NOW (per the `itr` skill) citing the critique file and axis, or
append to `<dir>/RESIDUALS.md`. Residuals parked in prose are invisible to `/blitz` and every future loop.

**5. Ownership-scoped commit** — `git add` the target's declared globs plus this iteration's artifacts only.
Never `git add -A` / `git add .`; another agent's in-flight work must never be swept into a loop commit.

**6. Pace — read after every link and every critique.** Take `pace` from `gate.mjs --json <Gate flags>`.
When its `state` is `BEHIND`, tell the user at once, in one line that opens `crucible pace BEHIND:` and
quotes every `pace.warnings` entry verbatim, plus the time since the first baseline commit. Say it each time
a new warning appears or the ratio drops further, and not otherwise. Then carry on with the step you were
on: the warning is for the user, who may stop the run. It is never a reason to stop, ask, change the budget
or bar, or skip a step yourself. The run's final report gives the last `pace` line right after the list of
milestones.

**Closure reconciliation** (before declaring any target closed): reconcile the ledger against BOTH
transcripts — `ccq` for Claude dispatches (`ccq agents -p <project> --root "C:\Users\Blue\.claude\projects"`)
and `cxq` for the Codex seat (`cxq sessions -p <project>`, `cxq tools`), so a `SANDBOX-DOWN` row is verified
rather than asserted. Either tool absent → skip with a note in the ledger. Rows whose `actual` was copied from the Seat Guard
ledger tool are the engine's own record already; the transcript check is for the rows that were not. Any ledger row contradicted by a
transcript, or any dispatch missing a row, reopens bookkeeping. Gate exit 0 + clean two-sided reconciliation
= closed; either alone is not.

---

## Model routing

Seats name **roles** from `~/.claude/MODELS.md`; resolve each to its model when you plan the round, and the
ledger records the resolved model.

| Seat | MODELS.md role | Notes |
|---|---|---|
| Builder (default) | `generalist` | Implementation work off the Claude family; keeps the Opus critic seat honest. |
| Builder (taste-critical) | `taste` | Only for user-facing/taste surfaces. That round's critique MUST use the Codex seat. |
| Test-author (blind) | `builder` | Behavior-driven assertions against a written spec; a different family from the generalist builder by default. |
| Critic (Claude seat: GPT-built rounds + panel lenses) | `taste` | Taste and design judgment — never over a `taste`-built round's own output. |
| Critic (cross-model seat: Claude-built rounds + panel reproduce seat) | `frontier` via `codex-seat.sh`, read-only (`codexModel` / `codexEffort`) | Different family, different blind spots. Failure → Opus + `SANDBOX-DOWN` row. |
| Spec / Evidence / merge clerking | `builder` | Mechanical stages stay off the flagship rungs and off your context. |
| Escalation on a missed round | `generalist` → `frontier` → `ceiling` | Non-taste ladder per MODELS.md (`ceiling` gated); record the escalation in the ledger. |

The bundled script sets a model for the Claude critic seats only (`criticModel`). Every other seat runs on the
session model, whatever this table plans: record that in the ledger as planned ≠ actual with `TOOL-MISSING`,
once per stage, and do not edit the script to change it mid-run.

## Principles

- The loop is run as written or not at all. Work that does not fit it is told so, out loud, and sent to a workflow that fits.
- Everything the spec proposes is work to be done. The run is measured in milestones met, not in targets closed, scores or rounds spent.
- A plan that is detailed up to a point and thin after it is not finished. Finish it with the user before building any of it.
- Finish a milestone's chain before judging it. A working end-to-end result with residuals beats a first layer at 9 and nothing a person can run.
- The hard gate is cheap and sits between every link; a critic is dear and is spent once per target, then only below the bar.
- The gate is the referee; critics are witnesses; instruments are the record; you are the clerk. None may do another's job.
- Two layers because they catch different lies: layer 1 catches "it isn't tested", layer 2 catches "it isn't good".
- Functional coverage over line coverage — a behavior with no failing-when-broken test is untested, whatever the percentage says.
- Blind test-authoring + mutation-backed scoring + a validator = the honesty chain. Break any link and the scores are decoration.
- Every self-report must be reconcilable: ledger vs both transcripts, scores vs gate output, claims vs registered instruments.
- Deviation is allowed; undeclared deviation is a defect the next checkpoint reads as a defect.

## Don't

- Don't run this loop in any shape other than the one written here, and don't start it on work that fails the fit check. Say "this work does not fit the crucible loop, because …" and name the workflow that does.
- Don't improvise when a step cannot be done as written. Stop at that step, say so, and offer: repair the rig, change the contract with the user's yes, or another workflow.
- Don't draft a contract, take a baseline or build anything while any milestone the spec proposes is planned more thinly than the first. Stop and finish the planning with the user.
- Don't narrow the run to part of what the spec proposes — a "priority path", a first slice, the first milestone — on your own, and don't read a yes to an order of delivery as leaving work out.
- Don't call a milestone met unless the gate closed every target in it and its outcome command ran. Don't skip or thin the review for a later milestone.
- Don't launch without the ultracode session toggle confirmed on, and don't substitute loose Agent calls for the iteration Workflow.
- Don't run with an unverified engine — `--verify-engine` on every Phase 0 and every `--resume`.
- Don't let the builder touch a test file, or the test-author touch source. Blindness is worthless if either can reach into the other's files.
- Don't weaken, skip, or delete a blind author's test to make a round pass. Report the contradiction and leave it failing.
- Don't score `test_quality` without a mutation experiment, and don't leave a mutation in the tree.
- Don't spawn a critic on a broken rig, on missing evidence, or on a failed layer 1.
- Don't spawn a critic on a baseline, between links, or on a target already at the bar, and don't run a round to answer findings on an axis that is at the bar — those are residuals.
- Don't stop, summarize or ask between links; the chain runs to the outcome on its own. The one line allowed is a `pace BEHIND` warning, and the chain carries on after it.
- Don't sit on a `pace BEHIND`. Say it the moment it appears; a run that falls behind in silence has failed its user whatever it closes.
- Don't ask the user to raise the cap, lower the bar or change `confirm` mid-run, and don't change them yourself. A spent budget is reported, not negotiated.
- Don't let a critic run instruments without `--scratch` — the evidence record is written once, by the Evidence stage.
- Don't tell a critic anything about closure mechanics, the bar, or round significance — and don't hand the Codex seat anything Claude critics are denied.
- Don't put a round's critic in the family that built it while the other family is available, and don't route a critique of Opus output to Opus.
- Don't invoke `gate.mjs` without the recorded `Gate flags:` line — the tool is stateless, and a flagless call silently drops every waiver and the cap.
- Don't declare closure yourself — only `gate.mjs --check` exit 0 plus a reconciled ledger closes a target.
- Don't hand-edit scores, critique JSONs, evidence reports, or STATUS score tables — regenerate them.
- Don't park residuals in prose, and don't exceed 2 repair attempts inside one iteration.
