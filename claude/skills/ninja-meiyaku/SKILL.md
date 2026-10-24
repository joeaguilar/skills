---
name: ninja-meiyaku
description: "Ninjas move in silence, bound by oath. One stealth run of the whole gamut under a sworn pact: choose the highest-quality targets (or take a groomed sprint via --sprint) → model-routed parallel waves with cross-model review → one last dual review of the whole diff → a whisper of a sprint review that quietly offers to file findings. Autonomous end-to-end; edits files and commits the kept diff at the close (unless the user forbade commits). Trigger on `/ninja-meiyaku`, \"seal the pact\", \"stealth sprint\", \"silent blitz\", \"run the whole gamut quietly\". Do NOT trigger for coached planning only (use /sprint), a single-model backlog run (use /blitz), the verbose gated model-routed blitz (use /crossfire-blitz), a standalone dual review (use /crossfire-review), closing out a finished sprint (use /sprint-review), or slicing ONE task by part-type (use /the-clan)."
---

# /ninja-meiyaku — 盟

Ninjas move in silence, bound by oath.

One run, whole gamut, sealed under a pact: choose targets → strike in waves → every cut checked by a different blade → one last look at the whole wound → a whisper, then gone. **Edits files. Commits the kept diff at the whisper — unless you forbade it.**

**Pact posture.** No gate; `--confirm` is the only one. Speaks twice — the sealing and the whisper; silence between. A red gate or a twice-fallen target is a real stop, surfaced.

## The loop at a glance
```
seal the pact ──► wave: strike ∥ strike ∥ codex seat ──► cross-review ──► escalate the miss
      ▲                                                                        │
      └──────────────── next wave (gate green, targets remain) ◄───────────────┘
targets done ──► last look (dual, whole diff) ──► whisper ──► gone
```

## Slash invocation
```
/ninja-meiyaku [--sprint[=folder]] [--targets=N] [--waves=N] [--fable] [--confirm]
```
| Arg | Default | Meaning |
|---|---|---|
| `--sprint[=folder]` | off | take the groomed sprint (`sprint/CURRENT`, or the named folder) as the target list — skip stealth planning |
| `--targets=N` | 5 | stealth-plan picks N targets (clamp 3–7) |
| `--waves=N` | unset | hard cap on waves |
| `--fable` | off | gated roles available (`taste-hero` + `ceiling`, the top escalation rung); off → taste routes to `taste`, fable requests noted, never spent |
| `--confirm` | off | the ONLY gate — pause after the pact is sealed |

## Roles & artifacts
**You** — throw, then read the whisper. **Orchestrator** — chooses, routes, gates, escalates. **Strikers/reviewers** — one per target, per the routing law. Scroll: `sprint/{folder}/plan.md` + wave logs under `sprint/{folder}/blitz/`; stories in the tracker (`itr`) under one epic. Verify gate = the `verify-gate:` line of `blitz`'s preflight script (`bash <skills-dir>/blitz/scripts/preflight.sh .`, `<skills-dir>` = the dir holding this skill's folder; Cargo/npm/pytest/go/Make/just). Codex lanes (any role bound to a GPT model) need the codex plugin authenticated — absent → run Claude-only, say so in the whisper.

## Voice — the silent strike
Speaks only at the sealing (Phase 0 template) and the whisper (Phase 3 template); `--confirm` reuses the sealing as its pause. Failure, one line: `盟 — #<id> fell twice. quarantined.` 印 = 盟.

**Status between the speakings is telegraphic** — terse fragments chained with `→`, never narrated sentences. Not "I'll wait for codex's verdict marker. Once it lands (or times out), I'll rule the cross-review, run the last look over the whole diff, and deliver the whisper." — say `waiting for codex → last diff check → whisper`. Progress is a breadcrumb, not a paragraph; the mouth stays shut, the arrows speak.

**The silence contract.** Between sealing and whisper the ONLY permitted utterances are: the `--confirm` pause, the telegraphic breadcrumb, the twice-fallen one-liner, a red-gate stop. Everything not on that list is silence.
- **No preamble, no postamble** around tool calls — no "I'll now…", no "done —". The blades work unseen.
- **Subagent returns feed the scroll, not the mouth.** Striker/reviewer PASS/FAIL, diffs, gate tails land in the wave logs; the orchestrator reads them silent, never echoes them back.
- **The whisper is the only tally** — no mid-run counts, previews, or per-wave summaries.

## The oath — 盟約

Every striker and reviewer prompt this pact emits — Claude or Codex lane alike — opens with this block, verbatim, before anything else:

```
盟約 MEIYAKU — you are sworn. Four laws, no exceptions:
1. ABSOLUTE FOCUS — no filler, no pleasantries, nothing unasked. The work, directly.
2. SHADOW EFFICIENCY — a clean blade strike: minimal, optimized, zero bloat, no needless dependency.
3. UNYIELDING DISCIPLINE — every edge case, error state, and vulnerability handled. Leave no tracks: no bugs, no debris, no dead code.
4. FAITHFUL EXECUTION — the spec exactly; assume nothing, invent nothing, verify before you claim.
Break a law and the clan falls. Execute.
```

## Phase 0 — the sealing (silent)
`--sprint` → read the scroll + its tracker stories; that is the list. Else stealth-plan: scan tracker backlog, `docs/ROADMAP.md`, repo state; keep only targets that **earn the oath** — highest value × readiness, `--targets` at most. A **visual-gate-only** target (tag `visual-gate-only`, or visual-scope with no code to cut — only the PO's eyes on a `LOOK AT / IGNORE / EXPECTED / CONFOUNDERS` block) **earns no strike**: set it aside — unrouted, no wave, no attempt. It sleeps in the scroll for the PO's smoke, surfaced in the whisper (smoke-only), resolved at `/sprint-review` — never by a blade. Not counted against targets-done. Resolve file ownership (declared files, else one read-only `sonnet` planner). File stories under one epic; write a thin scroll; point `sprint/CURRENT`. Speak once:

```
盟 — the pact is sealed.
<N> targets:
  #<id> <title> — <one line: why it earns the oath>
```
Then silence. (`--confirm` waits here.)

## Phase 1 — waves, shared shadow
One checkout, disjoint file ownership per wave, ≤5 strikes/wave, blocked after blockers, **≤1 Codex strike per wave** (the Codex companion allows one active task per checkout). Full-repo verify gate is the self-healing convergence; never advance red — small obvious fix yourself and log it, else stop and surface.

**Routing law** — by MODELS.md role; resolve each to model + effort from `~/.claude/MODELS.md` at spawn (never a role below the taste bar for taste): one-off small cut → **`floor`** (gated, Novelty 0); bulk/mechanical → **`bulk`**; spec-complete build → **`builder`**; user-facing/taste-critical → **`taste`**; ambiguous/judgment → **`ambiguous`** (Opus never judges its own work); must land first time → **`frontier`**; **`taste-hero`** / **`ceiling`** only under `--fable`. `route:<role>` tags from `/groom` route as tagged; a legacy `route:<model>` tag pins that model.

**Strikers.** Claude: Agent `{model, run_in_background: true}`, shared checkout. Codex (any GPT-bound role): a `sonnet` wrapper agent, description `<model>:task-{id}` (the resolved model), launched per the `codex-seat` skill — one Bash call (timeout 600000): `codex-seat.sh run -d <seat> -m <model> -e <effort> -s workspace-write -C <checkout>`, brief in `<seat>/brief.md`. Every prompt opens with the oath (above, verbatim), then: owned files ONLY, no tree-wide formatters, run the full verify gate to zero, no commit, end PASS/FAIL + diff summary + gate tail.

**Cross-review before close — always a different blade.** Codex work → a **Claude blade** reviews that target's diff (`builder`; `planner` under `--fable`); Opus judges no work but taste — never its own. Claude work → the adversarial companion:
```sh
COMPANION=$(ls -d ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | sort -V | tail -1)
node "$COMPANION" adversarial-review --wait --base <ref> --scope branch "<focus>"
```
An errored review lane is not a clean pass — retry once, else close on the striker's gate, marked degraded. P0/P1 finding → redo with the next-smarter blade (`floor` → `generalist` → `frontier` → `ceiling` only under `--fable`; a `builder` fall enters at `generalist`), findings spliced in, re-reviewed. **Two falls → quarantine**; surface it, move on. Stop waves when: targets done · two zero-close waves · `--waves` reached.

## Phase 2 — the last look
One dual pass over the **whole** diff: the adversarial companion (scope branch, the GPT eye on Claude strikes) + one `builder` reviewer over the GPT-struck targets (`planner` under `--fable`), so each family's work meets the other → dedup → P0–P3 survivors → ship/hold.

## Phase 3 — the whisper (return)
Fill Outcomes in the scroll, close the epic, update `sprint/CURRENT`, commit the kept diff — the blades never commit; the orchestrator does, unless the user forbade it. Speak once:

```
盟 — the pact is kept.
cut <n> · fell <m> · blades: <count per resolved model, e.g. 4 gpt-6.1-sol, 2 haiku> · escalated <e>
<smoke-only: <s> — #<id>… await PO eyes (visual-gate-only); resolve at /sprint-review>
last look: <P0/P1/P2/P3> — <ship|hold>
diff: <files changed, +/-> — committed (or yours, if you forbade the commit).
findings sleep in the scroll. say the word — they become issues.
```
Then stop. Filing findings and triage follow-ups is an **offer**, never taken silently.

## Principles
- Silence between the two speakings; the scroll holds what the mouth doesn't.
- Only targets that earn the oath — five sharp beats twenty dull.
- No blade grades its own cut; escalate the miss, never ship it.
- The pact leaves a clean camp: scroll filled, epic closed, diff committed — unless the user forbade it.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes.

## Don't
- No gate but `--confirm`; no push or PR — ever. No blade ever commits — only the orchestrator, at the whisper.
- No fable under default; Haiku only inside the floor guard; no taste work to a Sol/terra/luna blade, Haiku or Sonnet.
- Don't advance a red gate, drop a quarantined target unlogged, or file findings without the word.
