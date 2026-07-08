---
name: ninja-clan
description: "Ninjas move in silence, and slice through the backlog. One stealth run of the whole gamut: choose the highest-quality targets (or take a groomed sprint via --sprint) → model-routed parallel waves with cross-model review → one last dual review of the whole diff → a whisper of a sprint review that quietly offers to file findings. Autonomous end-to-end; edits files, never commits. Trigger on `/ninja-clan`, \"send the clan\", \"stealth sprint\", \"silent blitz\", \"run the whole gamut quietly\". Do NOT trigger for coached planning only (use /sprint), a single-model backlog run (use /blitz), the verbose gated model-routed blitz (use /crossfire-blitz), a standalone dual review (use /crossfire-review), closing out a finished sprint (use /sprint-review), or slicing ONE task by part-type (use /the-clan)."
---

# /ninja-clan — 静

Ninjas move in silence, and slice through the backlog.

One run, whole gamut: choose targets → strike in waves → every cut checked by a different blade → one last look at the whole wound → a whisper, then gone. **Edits files. Never commits — the diff is yours.**

**Ninja posture.** No gate; `--confirm` is the only one. Speaks twice — the targets and the whisper; silence between. A red gate or a twice-fallen target is a real stop, surfaced.

## The loop at a glance
```
choose targets ──► wave: strike ∥ strike ∥ gpt-5.5 ──► cross-review ──► escalate the miss
      ▲                                                                        │
      └──────────────── next wave (gate green, targets remain) ◄───────────────┘
targets done ──► last look (dual, whole diff) ──► whisper ──► gone
```

## Slash invocation
```
/ninja-clan [--sprint[=folder]] [--targets=N] [--waves=N] [--fable] [--confirm]
```
| Arg | Default | Meaning |
|---|---|---|
| `--sprint[=folder]` | off | take the groomed sprint (`sprint/CURRENT`, or the named folder) as the target list — skip stealth planning |
| `--targets=N` | 5 | stealth-plan picks N targets (clamp 3–7) |
| `--waves=N` | unset | hard cap on waves |
| `--fable` | off | fable-5 available (hero taste + top escalation rung); off → taste routes to opus-4.8, fable requests noted, never spent |
| `--confirm` | off | the ONLY gate — pause after the targets are spoken |

## Roles & artifacts
**You** — throw, then read the whisper. **Orchestrator** — chooses, routes, gates, escalates. **Strikers/reviewers** — one per target, per the routing law. Scroll: `sprint/{folder}/plan.md` + wave logs under `sprint/{folder}/blitz/`; stories in the tracker (`itr`) under one epic. Verify gate auto-detected (Cargo/npm/pytest/go/Make). gpt-5.5 lanes need the codex plugin authenticated — absent → run Claude-only, say so in the whisper.

## Voice — the silent strike
Speaks only at the throw (Phase 0 template) and the whisper (Phase 3 template); `--confirm` reuses the throw as its pause. Failure, one line: `静 — #<id> fell twice. quarantined.` 印 = 静.

## Phase 0 — the choosing (silent)
`--sprint` → read the scroll + its tracker stories; that is the list. Else stealth-plan: scan tracker backlog, `docs/ROADMAP.md`, repo state; keep only targets that **earn the clan** — highest value × readiness, `--targets` at most. Resolve file ownership (declared files, else one read-only `sonnet` planner). File stories under one epic; write a thin scroll; point `sprint/CURRENT`. Speak once:

```
静 — the clan moves.
<N> targets:
  #<id> <title> — <one line: why it earns the clan>
```
Then silence. (`--confirm` waits here.)

## Phase 1 — waves, shared shadow
One checkout, disjoint file ownership per wave, ≤5 strikes/wave, blocked after blockers, **≤1 gpt-5.5 strike per wave** (the Codex companion allows one active task per checkout). Full-repo verify gate is the self-healing convergence; never advance red — small obvious fix yourself and log it, else stop and surface.

**Routing law** (never Haiku; never gpt-5.5/sonnet for taste): bulk/mechanical → **gpt-5.5**; user-facing/taste-critical → **opus-4.8**; ambiguous/judgment → **opus-4.8**; **fable-5** only under `--fable`.

**Strikers.** Claude: Agent `{model, run_in_background: true}`, shared checkout. gpt-5.5: a `sonnet` wrapper agent, description `gpt-5.5:task-{id}`, one Bash call (explicit timeout): `codex exec -C <checkout> -s workspace-write "$(cat "$PROMPT")"`. Every prompt: owned files ONLY, no tree-wide formatters, run the full verify gate to zero, no commit, end PASS/FAIL + diff summary + gate tail.

**Cross-review before close — always a different blade.** gpt-5.5 work → opus-4.8 reviewer over that target's diff. Claude work → the adversarial companion:
```sh
COMPANION=$(ls -d ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | sort -V | tail -1)
node "$COMPANION" adversarial-review --wait --base <ref> --scope branch "<focus>"
```
An errored review lane is not a clean pass — retry once, else close on the striker's gate, marked degraded. P0/P1 finding → redo with the next-smarter blade (gpt-5.5 → opus-4.8 → fable-5 only under `--fable`), findings spliced in, re-reviewed. **Two falls → quarantine**; surface it, move on. Stop waves when: targets done · two zero-close waves · `--waves` reached.

## Phase 2 — the last look
One dual pass over the **whole** diff: the adversarial companion (scope branch) + one independent opus-4.8 (fable-5 under `--fable`) reviewer → dedup → P0–P3 survivors → ship/hold.

## Phase 3 — the whisper (return)
Fill Outcomes in the scroll, close the epic, update `sprint/CURRENT`. Speak once:

```
静 — the clan is gone.
cut <n> · fell <m> · blades: <k> gpt-5.5, <j> opus<, f fable> · escalated <e>
last look: <P0/P1/P2/P3> — <ship|hold>
diff: <files changed, +/-> — yours to commit.
findings sleep in the scroll. say the word — they become issues.
```
Then stop. Filing findings and triage follow-ups is an **offer**, never taken silently.

## Principles
- Silence between the two speakings; the scroll holds what the mouth doesn't.
- Only targets that earn the clan — five sharp beats twenty dull.
- No blade grades its own cut; escalate the miss, never ship it.
- The clan leaves a clean camp: scroll filled, epic closed, tree uncommitted.

## Don't
- No gate but `--confirm`; no commit, push, or PR — ever.
- No fable under default; no Haiku anywhere; no taste work to gpt-5.5/sonnet.
- Don't advance a red gate, drop a quarantined target unlogged, or file findings without the word.
