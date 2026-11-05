---
name: council
description: "Convene the council: three blind seats on three different models (both families, none that wrote the work on trial) weigh ONE judgment call that no test can settle — keep going, simplify, rescope or cancel; pick between designs; ship or hold. Each seat gets its own evidence slice and lens (value · delivery · evidence-as-prosecutor), a rule fixed in advance counts the votes (3-0 or 2-1 acts and records the dissent, 1-1-1 goes to the user), and `--jester` adds a fourth, low-powered seat that speaks but never votes. Trigger: `/council`, \"convene the council\", \"put it to the council\", \"get three models to weigh in\", \"go/no-go on X\", \"should we keep going or cut this\", \"rescope or cancel?\", \"call the jester\", or when a skill reaches a continue/rescope/cancel call on a plan it proposed itself. NOT for a claim a test, grep or measurement settles, or a diff to review (one adversarial reviewer; /code-review), rubric scoring (the gauntlet / crucible confirmation panel), stress-testing a plan with the user (/alignment), N attempts at a task (/dojo hundred-blades), proposer-vs-attacker hardening (/dojo shadow-duel), or one cross-model second opinion (/codex-seat)."
---

# Council

Some calls have no artifact to settle them: whether the rest of a plan is worth what it costs, whether to rescope, which of two designs to build. A lone judge is either kill-happy or a rubber stamp, and the model that proposed the plan is the worst judge of it. A council puts the question to three seats that cannot see each other, on three different models, each holding a different slice of the evidence, and counts their verdicts by a rule fixed before they speak.

The design comes from the archived `scrum` and `mission` skills (Phase 4) and `docs/chain-based-agentic-delivery.md` §4. Two failures recorded in `docs/postmortem-mission-street-yeet.md` §5 are designed out. Councils fired on schedule-like triggers (every N links, every budget tranche) until they ran constantly. And their only verdicts were `proceed | rescope | cancel`, so a council that diagnosed the problem exactly could not vote to drop the ceremony. Here a council fires on an event, and an option that keeps the goal at less cost is always on the ballot.

## Invocation

| Trigger | Effect |
| --- | --- |
| `/council <question>` | Frame, seat, brief and convene three seats, then tally and report the decision |
| `… --options "<a>; <b>; <c>"` | The ballot, 2–4 options. Without it: the continue ballot below, or one drafted from the question |
| `… --lenses <a>,<b>,<c>` | Replace the default lenses: exactly three, and one of them prosecutes |
| `… --kill-fired` | A stop criterion set in advance has fired, so carrying on must earn its evidence (Phase 6) |
| `… --prior <record.md>` | The last council on this same question, when Phase 1 would not find it on its own |
| `… --record <dir>` | After the tally, copy the council dir there (a campaign or sprint folder) |
| `… --jester` | Add the jester: a fourth, low-powered seat that speaks but never votes. Also "with the jester", "call the jester" |

The **continue ballot**, least to most drastic:

| Option | Means |
| --- | --- |
| `proceed` | carry on as planned |
| `simplify` | same goal, cheaper path: drop the scope or process that is not paying for itself |
| `rescope` | change the goal |
| `cancel` | stop; keep what was learned and what already works |

## Roles & artifacts

- **Caller.** The main thread, or the skill that hit the decision. It frames the question, seats the council, verifies, tallies and acts on the result. It has no vote.
- **Proposers.** Every model that wrote the plan, work or recommendation on trial; by default just the caller's own model. None takes a voting seat.
- **Seats.** Three fresh, read-only agents, one lens each, on three different models. Each reasons from its brief alone.
- **Jester** (`--jester` only). A fourth, cheap seat on the `jester` role in `~/.claude/MODELS.md`. It gets the question and the ballot but no evidence, and it has no vote. A Gemini or Muse model may take the seat once MODELS.md lists a way to reach one.
- **Council dir.** `<scratchpad>/council/<slug>/`, outside the repo so no seat finds another's brief while it works. `--record <dir>` gets a copy only after the tally:

| File | Holds |
| --- | --- |
| `<lens>/brief.md` | that seat's whole prompt |
| `<lens>/out.md` | its final message (GPT seats: written by `codex-seat.sh`, with `cmd`, `log` and `done` beside it) |
| `record.md` | question, ballot, seating, verdicts, checks, tally and decision |

The default lenses:

| Lens | Asks | Evidence slice | Seat (MODELS.md role) |
| --- | --- | --- | --- |
| value | Is what is left worth what it costs, against the goal? | the goal, what has landed, what is spent and what is left | Claude: `planner` when Fable is on; otherwise `taste`, or `builder` when a proposer runs on the `taste` model |
| delivery | Can this be done from here? | the plan or dependency graph, rework and failure counts, constraints | GPT: `ambiguous` |
| evidence | Prosecute: the strongest concrete case against each option, as an argument some observation would falsify, not a vote label | failure logs, open questions, earlier dissent, facts that cut against the plan | GPT: `frontier` |
| jester | Say what the court won't: the obvious objection, the absurd assumption, the simpler path nobody named | none: the shared core only | `jester` |

Custom lenses (`--lenses`) follow the same shape: one question per lens, its own evidence slice, and one lens that prosecutes. A design choice might use `operability, cost-of-change, prosecutor`.

## Phases

### Phase 1 — Frame

**Announce: Phase 1 — Frame.**

1. **Is this a council question?** If a test, a grep, a measurement or reading the code would settle it, settle it that way and stop. A code change gets one adversarial reviewer, and a counterexample settles it. A council is for forecasts and trade-offs.
2. **Is it worth three seats?** Two of them spend Codex allowance. Convene when a wrong call costs more than that: the decision commits a lot of work, is hard to undo, or the caller proposed it. Convene on an event (a contradiction, a stop criterion firing, the user contesting a call), never on a schedule.
3. **Write the question** in one neutral sentence, with no favorite in it.
4. **Set the ballot**: 2–4 options, one line of meaning each. One of them always keeps the goal at less cost (`simplify`, the smaller design, keep what exists); a stop option alone does not count, because stopping drops the goal too. A ballot without it (`--options "proceed; rescope; cancel"`) gets one added, even past four. When the options cannot be recovered from the request, ask once with AskUserQuestion; a council on the wrong question wastes three seats.
5. **Name the proposers**: every model that wrote what is on trial, not only the caller's. **Kill-fired** is set when the trigger is a stop criterion firing, or by `--kill-fired`.
6. **Find the last council on this question**: `--prior`, else a `record.md` with the same question in the `--record` dir or under this session's `<scratchpad>/council/`. If there is one, this council needs a new fact since then (name it in the record), and the dissent tripwire is armed (Phase 6).
7. **Sort the evidence.** The shared core goes to every seat, and it is framing only: the question, the ballot, hard constraints, and one paragraph saying what is being decided. Every fact about progress, cost, risk or failure goes to exactly one lens, even an undisputed one. Paste each excerpt into the brief with its source (`path:line`, the command that produced it, the `itr` id) rather than pointing at it. A seat reasons from its brief alone (Phase 3), so a slice it is not given stays out of its reach, and Phase 5 checks the sources.

Then print one line: `Council — <question> · ballot: <a | b | c> · proposers: <models>[ · jester]`.

### Phase 2 — Seat

**Announce: Phase 2 — Seat.**

1. Open `~/.claude/MODELS.md` now, not before. Resolve each lens's role to a model and effort. Voting GPT seats run at `high` or above, because judgment calls are risky work. The jester keeps its role's effort.
2. **Three distinct voting models, both families, none a proposer's.** When a role resolves to a proposer's model or to a model already seated, that seat takes the first model in this order that is unseated, not a proposer's, and reachable: `frontier`, `ambiguous`, `planner` (Fable on), `taste`, `builder`. A voting seat never runs on the `floor` role.
3. **One family short:** when Codex is unreachable, or the proposers leave one family with no eligible model, the seats take models of the other family in the same order, and the record says `single-family council` and why. The reroute is legal; an unrecorded one is not. If three distinct models still cannot be seated, stop and tell the user what is missing (the Codex login, `fable=on`). Three seats on two models keep the shared blind spots a council exists to remove.
4. **Jester:** resolve the `jester` role and its effort. If its model is a proposer's or is unreachable, take another reachable model of the kinds the role names, at its effort, and record the swap. With none left, tell the user before convening and ask whether to sit without one; if they agree, the record says `jester: unavailable`. Never move the jester up to a strong model.

### Phase 3 — Brief

**Announce: Phase 3 — Brief.**

Every voting seat's `brief.md` uses the same blocks (the `codex-seat` format), on Claude and GPT seats alike:

```text
<task>
Give your own verdict on the decision below, from the evidence you are given.
Question: <one sentence>
Ballot (pick exactly one, verbatim):
- <option> — <meaning>
Constraints: <hard limits>
What is being decided: <one paragraph, no evidence>
</task>
<lens><the lens's question></lens>
<evidence><this seat's slice: excerpts, each with its source></evidence>
<grounding_rules>Your evidence is this brief. Ground every load-bearing claim in a line of it and name that line's source. Do not open files or run commands to find more; the facts you cite will be checked against their sources. Label inferences as inferences.</grounding_rules>
<autonomy>Bias towards action and carry the task to completion. This is a non-interactive run, so a question ends it unanswered. Fill routine gaps from context and state the assumption.</autonomy>
<instruction_priority>This brief overrides AGENTS.md and skill files where they conflict. If one of them makes you stop or change course, name the file and quote the line.</instruction_priority>
<output_contract>
Your final message is this block alone:
verdict: <one ballot option, verbatim>
why: <one line>
load-bearing:
- <fact> (<where it comes from>)
flip: <the one observation that would change your verdict>
</output_contract>
```

One to three load-bearing facts. The jester's brief keeps the question, ballot and constraints, drops `<lens>` and `<evidence>`, and swaps the task and the contract:

```text
<task>
You are the jester at a council deciding the question below. You have no vote, so you owe no one politeness. Say the thing the council won't: the obvious objection, the assumption that sounds absurd out loud, the simpler path nobody named. One blunt line each.
…question, ballot, constraints…
</task>
<output_contract>
Your final message is this block alone:
jest: <one line>
poke: <the assumption it pokes>
cheaper: <a simpler path nobody named, or "none">
</output_contract>
```

**Blind.** A brief says nothing about the other seats, the tally rule, what a vote triggers, or which option the caller leans to. A seat that knows one `cancel` vote takes `proceed` off the table is being asked to cast it.

### Phase 4 — Convene

**Announce: Phase 4 — Convene.**

<!-- claude-only -->
Launch every seat in ONE message so they run in parallel:

- **GPT seat:** a `codex-seat` wrapper (Agent tool, `subagent_type: 'general-purpose'`, `model: 'sonnet'`, the wrapper prompt from that skill), seat dir `<council dir>/<lens>`, `-s read-only`, `-m`/`-e` from Phase 2. Use foreground `run` with Bash `timeout: 600000`, or `start` and then `wait` if the seat may run past ~9 min.
- **Claude seat:** Agent tool, `subagent_type: 'general-purpose'`, `model:` the resolved Claude model, the prompt `brief.md` verbatim. Write its returned message to `<lens>/out.md`.
- **Inside a Workflow:** `agent()` calls with the same models and labels.

Label every seat `<model>:council-<lens>` (`gpt-6-astra:council-evidence`, `sonnet-5.5:council-value`, `gpt-6-luna:council-jester`). The roster then shows who sat where, and `ccq` can find past councils.
<!-- /claude-only -->

### Phase 5 — Verify

**Announce: Phase 5 — Verify.**

| Signal | Action |
| --- | --- |
| `out.md` matches the contract and the verdict is on the ballot | check its load-bearing facts (below) |
| empty, off-contract, or a verdict off the ballot | re-brief once in a fresh seat dir with the contract tightened; still off → the seat abstains |
| the seat failed (`done` non-zero, Codex unreachable) | reseat it once, by Phase 2's order, and record `planned=<model> actual=<model> SEAT-DOWN`; fails again → it abstains |

Check every load-bearing fact before counting the vote that rests on it: grep it, read it, or run it. In one early cross-model review, about one claim in ten did not hold. A vote whose load-bearing fact is false is void: re-run that seat once with the correction added to its brief, otherwise it abstains. Void a vote only on a fact checked false, and write the check down; disagreeing with a seat's judgment is no reason. Copy verdicts as they are: never edit, merge or soften one.

The jester's poke is checked the same way when it names a fact that a counted vote rests on. If the check shows the seat wrong, that vote is void like any other. That is the jester's only power.

### Phase 6 — Tally & record

**Announce: Phase 6 — Tally.**

Two rules apply before counting:

- **Carrying on earns its evidence.** When kill-fired is set (Phase 1), any vote for the stop option strikes the continue option (on the continue ballot: `cancel` strikes `proceed`). A struck option cannot be the decision, and votes for it decide nothing; they are recorded, not moved to another option. A custom ballot must name its continue option and its stop option to use this rule.
- **Dissent tripwire.** If Phase 1 found a last council on this question, and a lens that dissented then dissents now in the same direction, the user decides, even on a 2-1. Same direction means the same verdict, or, when the ballot changed between councils, the option that means the same (`cancel` then, `abandon` now); write that mapping in the record. A lens that now sides with the majority trips nothing.

Then count the valid votes:

| Votes | Decision |
| --- | --- |
| 3 for one option | that option |
| 2 for one option (the third dissents, abstains, or voted a struck option) | that option; the record keeps the dissent: lens, model, verdict and its strongest load-bearing fact |
| 1-1-1, or no option left standing with 2 votes | the user decides (operator brief) |

**Operator brief**, one screen: the question and ballot; for each seat its lens, model, verdict, why, strongest load-bearing fact and flip; why it reached the user (1-1-1, the tripwire, a struck option, too few valid votes); and the jester's line, if one sat. The caller's own recommendation may follow, labelled as the proposer's. Then ask with AskUserQuestion, the choices being the ballot minus any struck option.

Write `record.md`:

```markdown
# Council: <question>
<date> · trigger: <event> · proposers: <models> · ballot: <a | b | c> · struck: <option, or none> · prior: <record path + the new fact, or none>

| Lens | Model | Verdict | Why | Load-bearing |
|---|---|---|---|---|

Checks: <fact → command → held | false (void)>
Seating: <reroutes, SEAT-DOWN, single-family council, or none>
Jester (<model>): <jest> · poke: <…> · cheaper: <…>
Tally: <3-0 | 2-1 | 1-1-1> → <decision> (dissent: <lens>/<model>: <verdict> — <fact>)
```

With `--record`, copy the council dir there now. Report in one or two lines: the decision, the tally, any dissent, and the jester's jest. When the decision belongs to a tracked item (an `itr` issue, a campaign), put the tally line on it. Hand the decision to the caller, which acts on it; the council itself changes nothing.

## Principles

- **A council for forecasts, an adversary for artifacts.** Where ground truth exists, one reviewer and a counterexample settle it. A council is for the calls no artifact can settle.
- **Independence is built, not claimed:** different models, disjoint evidence, blind briefs. Two seats on one model share blind spots, whatever their briefs say.
- **Doing less is always on the ballot.** A council that can only choose between process remedies, or between them and quitting, can name a problem but cannot fix it.
- **Carrying on earns its evidence.** Once a stop criterion fires, one stop vote is enough to take "as planned" off the table.
- **An event, not a calendar; once per question.** Convening again on the same question needs a new fact, named in the record. Anything else is shopping for a verdict.
- **The jester speaks, the seats vote, the caller counts, the user breaks ties.** None does another's job.

## Don't

- Don't seat a proposer's model, or one model twice.
- Don't tell a seat about the other seats, the tally, what its vote triggers, or which way you lean.
- Don't convene on a schedule, or on a question a test settles.
- Don't edit, merge, move or reinterpret a verdict. Void one only on a fact checked false, and record the check.
- Don't break a 1-1-1 yourself.
- Don't count the jester's opinion, give it an evidence slice, or seat it on a strong model. A jester on `frontier` is a fourth seat in a funny hat.
- **Commit policy:** seats are read-only and the record lives in the scratchpad, so a council has nothing to commit. With `--record` inside a repo, the caller commits the record with the unit of work the decision belongs to.
