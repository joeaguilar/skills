# The Dojo — orchestration-primitive family (Claude side)

> The blades that slice a problem so agents can attack it. fan-of-agents was the first off the anvil; this doc is the **rack** that catalogs them all and the **forge** that keeps them consistent — so the family stays a rack, not a pile.

Each blade is a **self-contained skill** under `claude/skills/<name>/SKILL.md`. They never reference each other in their *bodies* (a skill describes and runs only itself). All cross-blade knowledge — which to draw, how they compose — lives **here**, in the rack. That mirrors how the repo keeps cross-tree coordination in `PLATFORM_ONLY.tsv`, never in a payload.

On disk the blades sit flat (the platform requires `skills/<name>/SKILL.md` one level deep — no family subdir). This index is the organizing layer; the forge contract below is what stops them sprawling into inconsistent one-offs.

---

## The grammar — four knobs

Every blade is one setting of four knobs. Name the knobs and the whole family is legible:

| Knob | Question |
|---|---|
| **Split** | how is the problem cut? (aspect · redundant · stage · role · type · phase · cost · failure-mode · recursive) |
| **Flow** | parallel · serial · loop · race · tree |
| **Merge** | synthesize · vote · judge · fuse-up · first-wins · transform-through |
| **Stop** | ≥1 lands · quorum · verdict survives · bar met · ladder exhausted · base case · race won |

fan-of-agents = `aspect · parallel · synthesize · ≥1-lands`. Every other blade is a different corner.

---

## The Rack — the catalog

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

### The quiet kin — off-rack blades

Not every blade in the dojo is a four-knob orchestration cut. These follow the full forge contract (frontmatter routing, ninja posture, Voice, 印, caveman register) but live outside the grammar — cataloged here so the family stays whole:

| Blade | 印 | Nature | Draw it when |
|---|---|---|---|
| `tsugi` | 次 | quiet pointer — one stone, three lines, read-only, never begins work | "next?" deserves a breath, not a report |
| `feint` | 虚 | the empty attack — walk the whole motion read-only, draft the would-be change in full, land nothing | you want to see the cut without making it — the one read-only blade |
| `ninja-clan` | 静 | stealth campaign — choose targets (or take `--sprint`) → model-routed cross-reviewed waves → last look → whisper review | the whole backlog gamut, run in silence end-to-end |
| `masamune` | 正 | the legend — ONE agent on the finest steel (Fable), whole task, one cut, no retry, silence between draw and cut | the task deserves the best blade, not many blades |
| `silent-strike` | 黙 | general-purpose quiet blade — whole task thrown to ONE background subagent, model-routed (sonnet default), total silence, one line back | the task should just be done quietly, on the cheapest blade that clears the bar |

They compose the obvious way: tsugi names the stone; ninja-clan sends the clan at it; masamune is what you draw when the stone deserves one perfect cut. silent-strike is what you throw when it just needs doing quietly, on cheap steel. **feint is the read-only counterweight to the whole rack** — every execution blade now writes by default, so feint is how you preview the cut without landing it.

### Composition — blades wrap blades

Composition is the whole reason these are primitives. A few canonical chains (run one blade, feed its output to the next — you, the orchestrator, hold the seam; the bodies stay ignorant of each other):

- **scout-strike → fan-of-agents → shadow-duel** — recon the terrain, fan across the mapped aspects, then send an assassin at each portion before you trust it. (shadow-duel is the verifier fan-of-agents lacks: it takes what lands but can't tell a true strike from a confident-wrong one.)
- **hundred-blades, each blade a relay** — N independent pipelines attack the whole; vote the output. Ensemble of chains.
- **splitting-blade with whetstone leaves** — recurse until a leaf is small, grind that leaf to a bar, fuse up.
- **drawn-steel whose top rung is hundred-blades** — cheap single agent first; only escalate to an expensive consensus swarm if the cheap rung fails the bar.

When two blades' triggers feel close, the rack disambiguates:
- **fan-of-agents vs hundred-blades** — *different* targets (decompose) vs the *same* target N times (consensus).
- **first-blood vs drawn-steel** — all strategies at once, race (parallel) vs cheapest-first, escalate only on failure (serial).
- **whetstone vs shadow-duel** — cooperative self-improvement of my draft (critic helps) vs adversarial combat to verify (critic tries to kill it, judge rules).
- **relay vs fan-of-agents** — serial stages that transform vs parallel facets that synthesize.

---

## The Forge — how a blade is made

Every blade obeys one contract. Forge to it; the rack stays consistent.

### Non-negotiables (the steel)

1. **Self-contained body.** The body references only its own fan + harness tools (`subagent_type`, `run_in_background`, `SendMessage`). **No sibling skill named in the body** — no "for a deeper take, use /X" footers. Cross-blade routing lives in the frontmatter `description` (for the router) and in this rack (for maintainers), never in the execution plan.
2. **Frontmatter routing.** `description` lists concrete **trigger** phrases *and* explicit **"Do NOT trigger"** routing to the confusable sibling blades (name them — that's the router's job). Sharp differentiators are the anti-pile measure at the routing layer.
3. **Ninja posture — autonomous by default.** Infer the plan and act; **no approval gate** unless an opt-in `--confirm` flag is set. Run straight through; don't stop voluntarily. Adapt the *failure stance* to the blade: parallel blades tolerate misses (a lost knife is fine); serial/loop/verify blades (`relay`, `whetstone`, `shadow-duel`, `drawn-steel`) cannot — a broken link, a failed verdict, or an exhausted ladder is a real stop, surfaced.
4. **Caveman register.** Compress the mouth, keep the brain byte-for-byte (commands, thresholds, flags, the emitted per-agent prompt template, the 4-knob settings). Method: `../COMPRESSION.md`. Fragments + arrows; the contract loses nothing.
5. **Voice — speak twice, silent between.** A `## Voice` section with in-character templates. The skill surfaces only at the **throw** and the **return** — no progress chatter. `{slots}` are the contract; the flavor is mouth. Each blade carries its own signature 印 (see the rack).
6. **Right-size & clamp.** Default and clamp on the fan-width flag (fan-of-agents: 2–5, default 5; synthesis/monitoring degrades past ~5, and wide fan-outs trip API rate-limit cascades). State the clamp.
7. **Write by default, never commit.** Execution blades edit files in disjoint sets (overlapping edits clobber) simply by being invoked — no flag gates the write; the orchestrator never commits/pushes/PRs — the user reviews. Read-only is **not** a mode of an execution blade — it is its own blade (`feint` 虚, the empty attack). Pure-analysis blades (`pre-mortem`, `tsugi`, and read phases like `scout-strike`'s scouts) touch nothing by nature.

### The skeleton (fill the ⟨slots⟩)

```markdown
---
name: ⟨blade⟩
description: ⟨one-line what-it-does⟩. ⟨ninja posture line⟩. Trigger when the user types `/⟨blade⟩`, or asks to "⟨phrase⟩", "⟨phrase⟩", … . Do NOT trigger ⟨confusable-sibling case → name the right blade⟩, ⟨case⟩.
---

# /⟨blade⟩ — ⟨evocative one-liner⟩

⟨2-line intro: one task in → the cut → the deliverable.⟩

**Ninja posture.** ⟨no gate · failure stance for this blade · runs straight through⟩

## The loop at a glance
```
⟨5-line ascii of the cut⟩
```

## Slash invocation
```
/⟨blade⟩ <task> [⟨flags⟩]
```
| Arg | Default | Meaning |
|---|---|---|
| `<task>` | — | … |
| `--⟨width⟩=N` | ⟨default⟩ | ⟨clamp⟩ |
| `--out=path` | conversation | persist deliverable |
| `--confirm` | off | the ONLY gate — print plan, wait |

**No `--write` flag.** Execution blades write by default — invoking the blade lands the change on disk (disjoint file sets; never commits). There is no read-only mode on an execution blade; read-only is its own blade (`feint` 虚). A blade whose task has no disk surface (a pure question, an analysis) simply returns its answer — nothing to land is not a miss.

## Roles & artifacts
- **You** — throw the task. No live decisions unless `--confirm`.
- **Orchestrator** — ⟨cut · run · merge⟩. Sole author of the deliverable.
- **⟨agents⟩** — ⟨role per the Split knob⟩.
No tracker/graph/sprint deps — stands alone.

## Voice — ⟨motif⟩
⟨Throw template⟩ · ⟨Return template⟩ · ⟨the-pause for --confirm⟩ · ⟨failure template⟩. 印 = ⟨glyph⟩.

## Phase 0 — Frame (no gate) … resolve config, pick the cut, emit Throw, go.
## Phase 1 — ⟨Throw/Stage/Recurse⟩ … spawn per the per-agent template (brain — emit verbatim).
## Phase 2 — ⟨Collect/Iterate/Judge⟩ … the Merge + Stop rules.
## Phase 3 — Deliver … Return template + the merged deliverable.

## Principles … ⟨the 4-knob settings restated as terse laws⟩
## Don't … ⟨gate-only-on-confirm · never commit · stay-in-cut · the blade's specific footgun⟩
```

### Registering a new blade

1. Write `claude/skills/<blade>/SKILL.md` to the contract above.
2. Add a line to **`PLATFORM_ONLY.tsv`** under the Claude-only skills block (Claude forges first; Codex ports and graduates it later):
   `claude<TAB>skills<TAB><blade>`
3. Add its row to **The Rack** table above + any composition note.
4. Run **`./validate-skills.sh`** (0 errors) and the per-file integrity grep (fences even; every `--flag` in both table and body; 印 present).

> A blade not on the rack and not in `PLATFORM_ONLY.tsv` is a weapon on the floor. Sheathe it in both, or it trips the validator.
