# Postmortem: /mission on STREET YEET — where the skill's instructions were counter-productive

**Verdict up front:** the mission did 19 hours / ~9.5M tokens of real work — a city block with
1,465 instanced props, a hero rig with the gigantic fist, 7 synthesized SFX cues, a physics spike,
an event bus, 244 unit + 35 e2e tests — and the user saw a spinning block, because the skill
**forbids wiring any of it to the screen**. The spinning block is the render-loop liveness probe:
the only object the rules permit on the user-facing path.

Evidence sources: session `5151a758` (street-yeeter, 19h32m, 722 assistant msgs, 43 subagents),
the street-yeeter repo (48 commits, `missions/street-yeet/*`), and the A/B siblings
(street-yeet = bare prompt on Opus, playable in ~1h; street-yeetist = run-the-rivers-dry;
street-yeetum = ninja-meiyaku).

## The numbers

| | /mission (street-yeeter) | bare prompt (street-yeet) |
|---|---|---|
| tokens | ~9.5M (~$345) | ~1% of that (~$17) |
| wall clock | 19h32m (incl. freeze/idle) | playable in ~1h |
| commits | 48 — **11 feat, 37 docs/chore(mission)** | n/a |
| tests | 244 unit + 35 e2e | enough |
| visible product | spinning debug probe on a grey plane | a working game |

Token split (from `ccq agents` + session stats): only **~2.5M of ~9.5M went to the 43 subagents**
(implement 1.22M · rework 559k · adversarial review 481k · council seats 146k · experiments/
screenshot-judging ~94k). **~7M burned in the orchestrator's own main loop** — writing the
1,101-line contract and its 11 amendments, 98 FACTS entries, journals, digests, RESUME state,
freeze/thaw reconciliation, and serially landing every patch through the full gate.
`missions/` bookkeeping: 392K on disk vs 1.0M of `src/`.

## The counter-productive instructions, line by line

Line refs are `claude/skills/mission/SKILL.md`.

### 1. The dormancy rule is the spinning block (SKILL.md:177, :269-270, :322; flip only at Phase 6 :220)

> "user-visible behavior lands **dormant** — behind a flag where the project has flags, **else not
> wired into any user-facing path** — until the chain's terminal link" · "Don't wire user-visible
> behavior live before the terminal link"

Every chain obeyed. `src/main.ts` at the end of the run: *"C4/L1 — THE CITY BLOCK, DORMANT …
attach an on-demand `__YEET__.city` hook and **build NOTHING**"*, *"`SOUND_ENABLED` is still
false and the only caller is the `__YEET__` debug bridge"*, *"No city, no hero, no prop, no
trail"*. The flag-flip happens only in Phase 6 Closure (:220) — and a mission that exhausts its
budget mid-walk **never reaches Phase 6**, so nothing ever flips. The final commit
(`2eee5c9 feat(yeet): wire the verb — STREET YEET is playable`) wires the *debug-bridge* yeet only.
The user's 02:12 check — "I've not actually seen this game run once" — was ~4.5h in and correct
for the entire run.

Second-order damage: because nothing is playable, **nobody can playtest**. "Is it funny" had to be
answered by laboratory instrumentation instead of by playing (see #4).

### 2. "Sensor over hands" pays agents to find problems, not ship (SKILL.md:271-273, :162, :304)

> "a discovery that contradicts the premise is worth MORE than completing this link" · "a finding
> that matches nothing escalates UP, never drops"

Result: 98 FACTS entries, and a token multiplier on every finding — journal → FACTS → assumption
diff → council (3 fresh opus seats, :45) → contract amendment → commit. 30 of 48 commits are
`docs(mission)` records of findings about the process: *"amendment 8 — R3's mandated spelling is
the broken one"*, then *"A8.5 — Correction to Amendment 8, after independent review"* —
amendments to amendments.

### 3. Mandatory adversarial review per link, with a required `oracle_gap` field (SKILL.md:154-162, :303)

The review JSON *requires* the reviewer to name an oracle gap and "attack the DoD" every link.
On a toy, reviewers manufacture findings: reworks ran 43m–1h05m each ("all four majors and five
minors addressed", red-then-green negative controls), and **oracle repair became its own work
stream** — the mission's own journal records *"the oracles are capping the art"* (`cacfd69`) and
*"the oracle that defends the defect"* (Amendment 7): a boot tripwire calibrated to a 92-colour
stub scene went RED on the correct fix. The gate ratchets too: the full suite (grew 51 → 244
unit + 35 e2e) runs serially in the main loop **per landed link**, re-run 2× when red (:174).

### 4. Falsifiable-assumption epistemology applied to taste (SKILL.md:124-127, :139)

Every material statement must be classified and every assumption made falsifiable with
pre-registered spike questions and a mandatory terminal verdict. So the mission ran physics-lab
experiments on comedy: **Amendment 4 — "A-FUNNY falsified"** (a spike concluded the game's core
joke doesn't work), pixel-sampling screenshot judges ("at 92.7m the prop is 12.08px", "the bus
reads *more* absurd at 56.9m", 25 cross-tabulated measurements) — and then a later agent found
**the falsification itself was a confound** (`e2fccc9`, "The confound is total"). Tokens spent
falsifying fun, then more tokens un-falsifying it. The bare-prompt run answered the same question
by making the game and playing it.

### 5. Councils have no verdict for "drop the ceremony" (SKILL.md:187-197)

Mechanical triggers (25% budget, 5 links, rework ≥2, any `contradicts`, any FACTS touch) fire
constantly when #2 and #3 are generating findings. The very first councils — **~45 minutes in** —
diagnosed the failure exactly: *"The remaining 571k buys C1's four links and nothing else — the
mission ends at a verified substrate with **no hero, no city, no yeet, no sound and no fun**"*;
*"the plan spends 76% of its budget before the one assumption the whole game rests on (A-FUNNY)
is testable."* But the verdict vocabulary is `proceed | rescope | cancel` — rescope means
*more* ceremony (terminate + successor epic + supersedes relations + budget transfer, :197).
The diagnosis was perfect; the only available remedies were process. One council returned 1-1-1
(`eae233d`) and punted to the operator.

### 6. Budget machinery that interrupts the human and mis-ledgers itself (SKILL.md:25, :124, :188, :191, :208, :221)

The mission repeatedly stopped to ask for money: Amendment 2 ("operator funds to 2.2M;
fun-first resequencing"), then **Amendment 3 — "operator sets a 10M ceiling; stop asking for
funding"** — the user had to legislate an end to funding briefs. Meanwhile the ledger itself
drifted: *"The `Spent` column was last written at Amendment 4 — 695,594 … restated across four
amendments."* Tokens spent accounting tokens, incorrectly, in prose, in a file the loop re-reads.

### 7. Immutability turns every correction into permanent context (SKILL.md:57, :137, :197, :242, :301)

Contract immutable (amend by appending versioned sections); premise immutable (supersede only).
So course-corrections accumulate instead of replacing: contract.md reached **1,101 lines / 11
amendments**, re-ingested at every thaw and after each of 3 compactions. The user ultimately had
to pass **Amendment 11 — "Yeet first, jank allowed; full rigor on the yeet only"** — manually
overriding the skill's uniform rigor from the operator seat. When the operator has to amend your
process into the shape of the bare prompt, the process is the defect.

### 8. Rework ≥ 2 → council → quarantine buries paid-for work (SKILL.md:162, :188)

Issue #24 (the physics world — the actual game physics) failed review twice, convened a council,
and was exiled to `scratchpad/c2-L2-holding/` — implemented, paid for, **not in the tree**,
deferred. The escalation ladder has no rung labeled "ship the 80% version behind the flag."

### 9. Orchestrator-as-write-gate centralizes mechanical work in the most expensive context (SKILL.md:42, :163-174, :306)

Sole committer, serial landings, full-repo integration gate per link, patch-apply dance, plus all
the bookkeeping in #2/#6/#7 — that is the ~7M-token main loop. The design puts the cheapest,
most mechanical work (running gates, applying patches, transcribing ledgers) in the context that
costs the most and compacts the worst (3 compactions, 4 freeze/thaw reconciliations).

### 10. No floor below which the apparatus turns off

The skill's own routing table (:286-295) says simple bounded work belongs in `/blitz` and mission
is for "deep dependency stacks … 'this plan might be wrong'". But `/mission` invoked on a toy
game brief runs the **full** constitutional apparatus — there is no scale-to-task check inside
the skill, no degraded mode, no per-chain rigor dial (Amendment 11 had to invent one). Every
invocation pays for contract + register + spikes + councils + dormancy regardless of ask size.

## The one-sentence root cause

The skill optimizes for **provable process** (falsification, oracles, ledgers, councils) and
structurally defers the **product** (dormant until a closure phase that budget exhaustion
guarantees never runs) — so a run can be impeccably evidenced, 76% spent, and visibly a spinning
block, all at once; the bare prompt inverted the ordering (playable first, rigor where it earns
its keep) and won on every axis the user cares about.

## What the transcript proves the fix must include (not prescriptions — constraints)

1. **Visibility cannot be deferred to Phase 6.** Whatever replaces the dormancy rule must keep the
   product runnable/observable continuously — the run's own councils and the operator's Amendment 11
   both said this in-flight.
2. **Rigor must be priceable per link, not uniform** — Amendment 11's "full rigor on the joke only"
   is the operator hand-patching this in.
3. **Findings need a severity floor and a cost budget** — reviewer/council machinery must not be
   allowed to consume more than the work it verifies (here: verification+ceremony ≈ 50% of subagent
   spend plus most of the 7M main loop).
4. **The orchestrator's ledger/constitution work is the top burner** and must be capped or delegated;
   immutable-append documents that the loop re-reads are context bombs.
5. **A scale gate at intake** — the skill must be able to conclude "this ask doesn't need a mission"
   and degrade (or refuse and route), because the trigger table's routing advice is unreachable
   once the skill is already running.
