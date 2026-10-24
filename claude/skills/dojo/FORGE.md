# The Forge — how a blade is made

Read this only to make or change a blade. Drawing a blade needs `SKILL.md` and the blade's own file, nothing here.

Until 2026-10-24 each blade was its own skill and this contract lived in `claude/DOJO.md`. The retro that day found 13 of the 15 blades never drawn while the skill list had outgrown what the harness shows, so the Dojo was rerolled into one skill: one listing entry, the rack in `SKILL.md`, each blade in `blades/<blade>.md`, loaded only when drawn. The earlier skills and `DOJO.md` sit unedited in `claude/archived/`.

Every blade obeys one contract. Forge to it; the rack stays consistent.

## Non-negotiables (the steel)

1. **Self-contained blade file.** A blade file references only its own fan + harness tools (`subagent_type`, `run_in_background`, `SendMessage`). **No sibling blade named in it** — no "for a deeper take, draw X" footers. Cross-blade knowledge lives in the rack (`SKILL.md`), never in a blade.
2. **Rack routing.** A blade's triggers live in two places, both in `SKILL.md`: its rack row (*Draw it when*) and its entry in the frontmatter `description`'s blade list. A blade that is easy to confuse with another gets a *Close calls* line. Sharp differentiators are the anti-pile measure.
3. **Ninja posture — autonomous by default.** Infer the plan and act; **no approval gate** unless an opt-in `--confirm` flag is set. Run straight through; don't stop voluntarily. Adapt the *failure stance* to the blade: parallel blades tolerate misses (a lost knife is fine); serial/loop/verify blades (`relay`, `whetstone`, `shadow-duel`, `drawn-steel`) cannot — a broken link, a failed verdict, or an exhausted ladder is a real stop, surfaced.
4. **Caveman register.** Compress the mouth, keep the brain byte-for-byte (commands, thresholds, flags, the emitted per-agent prompt template, the 4-knob settings). Method: `COMPRESSION.md` at the skills-repo root. Fragments + arrows; the contract loses nothing.
5. **Voice — speak twice, silent between.** A `## Voice` section with in-character templates. The blade surfaces only at the **throw** and the **return** — no progress chatter. `{slots}` are the contract; the flavor is mouth. Each blade carries its own signature 印 (see the rack).
6. **Right-size & clamp.** Default and clamp on the fan-width flag (fan-of-agents: 2–5, default 5; synthesis/monitoring degrades past ~5, and wide fan-outs trip API rate-limit cascades). State the clamp.
7. **Write by default, commit by default.** Execution blades edit files in disjoint sets (overlapping edits clobber) simply by being drawn — no flag gates the write. Thrown agents never touch git; the orchestrator is the sole committer and commits the landed change at Deliver (Conventional Commits) — UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. Never push/PR/branch — the user reviews the commits. Read-only is **not** a mode of an execution blade — it is its own blade (`feint` 虚, the empty attack). Pure-analysis blades (`pre-mortem`, and read phases like `scout-strike`'s scouts) touch nothing by nature — nothing landed, nothing to commit.
8. **The Meiyaku (盟約).** Every prompt a blade emits to a thrown agent — worker, critic, challenger, proposer, judge, scout, router, striker — opens with the oath block below, **byte-for-byte**, before the role text. It is brain, not mouth: never compress, reword, or trim it (`./validate-skills.sh` §7 fails any drifted copy).

## The Meiyaku — the oath every thrown agent swears

This block is the canon `validate-skills.sh` §7 compares every copy against.

```
盟約 MEIYAKU — you are sworn. Four laws, no exceptions:
1. ABSOLUTE FOCUS — no filler, no pleasantries, nothing unasked. The work, directly.
2. SHADOW EFFICIENCY — a clean blade strike: minimal, optimized, zero bloat, no needless dependency.
3. UNYIELDING DISCIPLINE — every edge case, error state, and vulnerability handled. Leave no tracks: no bugs, no debris, no dead code.
4. FAITHFUL EXECUTION — the spec exactly; assume nothing, invent nothing, verify before you claim.
Break a law and the clan falls. Execute.
```

Why it works, mechanically: an explicit identity under stakes flattens drift in the agent's reasoning. Law 1 anchors low-token, high-density returns (the portion, not chat). Law 2 biases attention toward optimization over bloat. Law 3 pulls the weights for defensive programming, error handling, and clean architecture. Law 4 pins the agent to the spec and to evidence — "a written value ≠ a wired feature," sworn as an oath.

Read-only and analysis agents (scouts, challengers, pre-mortem prophets) swear the same oath — the laws govern conduct, not file writes. Every blade carries an inline copy in each emitted prompt, so a drawn blade needs no other file.

## The skeleton (fill the ⟨slots⟩)

```markdown
# /dojo ⟨blade⟩ — ⟨evocative one-liner⟩

⟨2-line intro: one task in → the cut → the deliverable.⟩

**Ninja posture.** ⟨no gate · failure stance for this blade · runs straight through⟩

## The loop at a glance
```
⟨5-line ascii of the cut⟩
```

## Slash invocation
```
/dojo ⟨blade⟩ <task> [⟨flags⟩]
```
| Arg | Default | Meaning |
|---|---|---|
| `<task>` | — | … |
| `--⟨width⟩=N` | ⟨default⟩ | ⟨clamp⟩ |
| `--out=path` | conversation | persist deliverable |
| `--confirm` | off | the ONLY gate — print plan, wait |

**No `--write` flag.** Execution blades write by default — drawing the blade lands the change on disk (disjoint file sets; the orchestrator commits at Deliver, thrown agents never do). There is no read-only mode on an execution blade; read-only is its own blade (`feint` 虚). A blade whose task has no disk surface (a pure question, an analysis) simply returns its answer — nothing to land is not a miss.

## Roles & artifacts
- **You** — throw the task. No live decisions unless `--confirm`.
- **Orchestrator** — ⟨cut · run · merge⟩. Sole author of the deliverable.
- **⟨agents⟩** — ⟨role per the Split knob⟩.
No tracker/graph/sprint deps — stands alone.

## Voice — ⟨motif⟩
⟨Throw template⟩ · ⟨Return template⟩ · ⟨the-pause for --confirm⟩ · ⟨failure template⟩. 印 = ⟨glyph⟩.

## Phase 0 — Frame (no gate) … resolve config, pick the cut, emit Throw, go.
## Phase 1 — ⟨Throw/Stage/Recurse⟩ … spawn per the per-agent template (brain — emit verbatim; opens with the Meiyaku block, byte-for-byte).
## Phase 2 — ⟨Collect/Iterate/Judge⟩ … the Merge + Stop rules.
## Phase 3 — Deliver … Return template + the merged deliverable.

## Principles … ⟨the 4-knob settings restated as terse laws⟩
## Don't … ⟨gate-only-on-confirm · no push/PR — commit unless the user said not to · stay-in-cut · the blade's specific footgun⟩
```

## Forging a new blade

1. Write `blades/<blade>.md` to the skeleton above. No frontmatter: the dojo skill's frontmatter routes for every blade.
2. Add its row to the rack in `SKILL.md` (or to *Quiet kin*, if it sits outside the four knobs), its name and cut to the frontmatter `description`'s blade list, and a *Close calls* line if a sibling is close. Update the blade count in both.
3. Run `./validate-skills.sh` from the skills-repo root (0 errors), then the per-file integrity check: fences even; every `--flag` in both the table and the body; 印 present; every emitted-prompt fence opens with the Meiyaku, byte-for-byte (§7 checks the bytes, you check the coverage).

No `PLATFORM_ONLY.tsv` line per blade: the `dojo` skill carries one Claude-only line for all of them.

> A blade not on the rack is a weapon on the floor. Rack it in `SKILL.md`, or no draw will ever find it.
