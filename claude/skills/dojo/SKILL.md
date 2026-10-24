---
name: dojo
description: "The Dojo — 15 blades, each cutting ONE task across subagents a different way; the cut lands on disk, the orchestrator commits. Draw: `/dojo <blade> <task> [flags]`, or `/dojo <task>` and the rack picks. Blades: fan-of-agents (aspects in parallel → synthesize), hundred-blades (N attempts → vote), first-blood (rival strategies race), splitting-blade (recursive split → fuse up), the-clan (route parts by type), relay (serial stages), whetstone (polish loop to a bar), shadow-duel (proposer vs assassin, judge rules), scout-strike (map cheap, then strike), drawn-steel (cheapest model first, escalate on a miss), pre-mortem (failure modes → guardrails), shuriken-storm (one op across many small targets), feint (read-only preview of a cut), masamune (one agent on Fable), silent-strike (one quiet background agent). Also fires on a blade's name, \"fan out agents on this\", \"do X to every Y\", \"N tries, keep the best\", \"pre-mortem this plan\". NOT for a tracker backlog (use /blitz) or a roadmap campaign (use /proof-campaign)."
---

# /dojo — 道場 · the rack

One task in. Draw one blade. The blade cuts the task across agents its own way; what lands, the orchestrator commits.

Fifteen blades, one skill. Each blade's full text sits in `blades/<blade>.md` beside this file and loads only when drawn. This file = the rack: which blade, how they compose. The forge (authoring contract + Meiyaku canon) = `FORGE.md` — read it only to make or change a blade.

## Draw

```
/dojo <blade> <task> [flags]    draw the named blade
/dojo <task> [flags]            the rack picks
/dojo                           show the rack, wait
```

1. **Name the blade.** First word of the args is a blade on the rack → that blade. Else pick: match the task to *Draw it when*, settle near-misses with *Close calls*. A plain ask that names a blade or its cut ("fan out agents", "do X to every Y", "N tries, keep the best") draws the same way. A word that looks like a blade but isn't on the rack → show the rack, wait.
2. **Load it.** Read `blades/<blade>.md` from this skill's base directory, in full. Nothing from the rack carries into the run.
3. **Run it exactly.** The blade file is the skill now — its flags, clamps, phases, failure stance, Voice, emitted prompts (Meiyaku byte-for-byte), commit policy. Its `/dojo <blade>` line takes the rest of the args as `<task> [flags]`.
4. **Picked, not named?** One line before the blade's own Throw: `道 drew {blade} · {why, one phrase}`. Then silence — the blade speaks for itself.

## The rack — four knobs

Every rack blade = one setting of four knobs:

| Knob | Question |
|---|---|
| **Split** | how is the problem cut? (aspect · redundant · stage · role · type · phase · cost · failure-mode · recursive) |
| **Flow** | parallel · serial · loop · race · tree |
| **Merge** | synthesize · vote · judge · fuse-up · first-wins · transform-through |
| **Stop** | ≥1 lands · quorum · verdict survives · bar met · ladder exhausted · base case · race won |

| Blade | 印 | The cut (Split · Flow · Merge · Stop) | Draw it when |
|---|---|---|---|
| `fan-of-agents` | 忍 | aspect · parallel · synthesize · ≥1-lands | one task → disjoint facets, struck at once, stitched into one |
| `hundred-blades` | 影 | redundant · parallel · vote/best · quorum | one whole task, N independent attempts, keep the truest |
| `first-blood` | 韋 | rival-strategy · race · first-wins · bar-met | unknown best approach + latency matters — take whoever lands first |
| `splitting-blade` | 分 | recursive · tree · fuse-up · base-case | too big to slice once — split, split again, fuse upward |
| `the-clan` | 門 | by-type · classify→dispatch · assemble · all-handled | heterogeneous parts, each needs a different art |
| `relay` | 伝 | by-stage · serial · transform-through · chain-done | research→design→build→test — each stage feeds the next |
| `whetstone` | 砥 | by-iteration · loop · converged-artifact · bar/no-gain | polish ONE artifact pass after pass to a bar |
| `shadow-duel` | 鏡 | by-role · loop · judge-verdict · survives/rounds | harden or verify — proposer vs assassin, judge keeps what lives |
| `scout-strike` | 偵 | by-phase · recon→exploit · strike-output · strike-done | unfamiliar terrain — map cheap, then one focused strike |
| `drawn-steel` | 抜 | by-cost · serial-escalate · first-tier-passes · ladder | cost-aware — cheapest hand first, draw steel only on failure |
| `pre-mortem` | 死 | by-failure-mode · parallel · ranked-guardrails · space-covered | before a risky plan — work backward from "it failed" |
| `shuriken-storm` | 嵐 | target-per-shuriken · waved-volley · independent-land · all-thrown | ONE uniform op across MANY small disjoint targets — no synthesis, misses re-throw |

### Quiet kin — off the grammar

| Blade | 印 | Nature | Draw it when |
|---|---|---|---|
| `feint` | 虚 | the empty attack — walk the whole motion read-only, draft the would-be change in full, land nothing | see the cut without making it — the one read-only blade |
| `masamune` | 正 | the legend — ONE agent on the finest steel (Fable), whole task, one cut, no retry | the task deserves the best blade, not many blades |
| `silent-strike` | 黙 | ONE background subagent, model-routed (sonnet default), total silence, one line back | the task should just be done quietly, on the cheapest blade that clears the bar |

## Close calls

- **fan-of-agents vs hundred-blades** — *different* targets (decompose) vs the *same* target N times (consensus).
- **fan-of-agents vs shuriken-storm** — facets of one task, synthesized vs one uniform op over many targets, no synthesis.
- **first-blood vs drawn-steel** — all strategies at once, race vs cheapest first, escalate only on failure.
- **whetstone vs shadow-duel** — the critic helps the draft vs the critic tries to kill it and a judge rules.
- **relay vs fan-of-agents** — serial stages that transform vs parallel facets that synthesize.
- **masamune vs silent-strike** — finest steel, one perfect cut vs cheapest steel that clears the bar.
- **feint vs any blade** — every other blade writes; feint previews the cut and lands nothing.

## Composition — blades wrap blades

You hold the seam: run one blade, feed its output to the next. The blade files never name each other.

- **scout-strike → fan-of-agents → shadow-duel** — recon, fan across the mapped aspects, send an assassin at each portion before trusting it.
- **hundred-blades, each blade a relay** — N independent pipelines, vote the output.
- **splitting-blade with whetstone leaves** — recurse to small leaves, grind each to the bar, fuse up.
- **drawn-steel whose top rung is hundred-blades** — cheap single agent first; the consensus swarm only if it fails the bar.

`forge-change` (its own skill) is the packaged scout-strike → write/verify → shadow-duel → repair → commit chain.

## Don't

- Load more than the drawn blade's file. The rack chooses; the blade cuts.
- Switch blades mid-run. Compose by finishing one and feeding its output to the next.
- Bend a blade's text to fit a task — its flags exist for that. Changing a blade is forging: `FORGE.md`.
- Narrate the draw beyond the one `道` line. The blade's Voice is the only voice.
