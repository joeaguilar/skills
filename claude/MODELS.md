# MODELS.md — canonical model scores & routing roles

**Single source of truth** for the cost/intelligence/taste table and the role→model
bindings that the Claude skills route by. When benchmarks move or a model is
added/renamed/retired, **edit this file, then run `./validate-skills.sh`** — the
model-table drift check (§6) flags every skill whose inline table no longer matches
the Scores table below, so a half-finished update can't ship silently.

> Data lives here; **voice lives in the skills.** This file is data-only on purpose —
> the verbose (`crossfire-blitz`) and caveman-register (`ninja-meiyaku`) skills keep their
> own prose, we don't generate it. The check only compares the *numbers*.

## Scores

Every axis: **higher = better**. `Cost` = what the user actually pays, so a higher
score means **cheaper**. `Intelligence` = how hard a problem you can hand it
unsupervised. `Taste` = UI/UX, code quality, API design, copy.

| Model | Cost | Intelligence | Taste |
|---|---|---|---|
| gpt-5.6-sol | 5 | 9 | 6 |
| gpt-5.6-terra | 6 | 8 | 5 |
| gpt-5.6-luna | 7 | 8 | 4 |
| gpt-5.5 | 9 | 8 | 5 |
| haiku-4.5 | 7 | 3 | 5 |
| sonnet-5 | 5 | 5 | 7 |
| opus-5 | 7 | 7 | 8 |
| fable-5 | 2 | 9 | 9 |

**Score history (2026-07-26, operator-dictated).** Opus 4.8 was a knowledge
level 7; **Opus 5 is a knowledge level 7** — the 2026-07-25 promotion to 8 is
reverted on operator evidence (the street-yeet A/B postmortem,
`docs/postmortem-mission-street-yeet.md`). **Opus 5 is not effective at judging
its own work** — never route review/judgment of Opus output back to Opus; the
`ambiguous` (judgment/review) role is rebound to the Codex agents default below.
**gpt-5.5 is the default for agents and keeps knowledge level 8 — it is in fact
much smarter and much more capable.** Pricing on the Opus rung is unchanged
($5/$25 per MTok, cost stays 7); taste stays **8**, so the `> 7` taste bar and
the opus-vs-fable split are unchanged. **fable-5 is still the capability
ceiling** and keeps intelligence 9 and the gated `taste-hero` rung. `opus-4.8`
is still a live model (same price, still reachable) but has **no routing role
here**; it survives only as Opus 5's refusal fallback — cyber-category refusals
on `claude-opus-5` route to `claude-opus-4-8`.

**Model names legal in skills** = the Scores table above, plus anything listed on
an allowlist line. A skill naming anything else fails `models.sh check`. Legality
deliberately does **not** come from prose mentions in this file — otherwise a
historical note like the paragraph above would silently re-legalize every stale
reference to a model we just retired. To let a non-routing model be named in a
skill, add it here on purpose:

<!-- models-allow: -->
(empty — no non-routing model may be named in a skill today)

## Roles → model

Skills route by **role**, not by model name — so a model swap changes only the lines
below, not the ~40 prose sites that reference a role. ("Route bulk work to **the
generalist**" never changes when terra replaces gpt-5.5.)

| Role | Model | Meaning |
|---|---|---|
| generalist | gpt-5.5 | the default for agents — the Codex generalist Claude spins up when needed |
| bulk | gpt-5.5 | bulk / mechanical implementation, migrations, data transforms |
| floor | gpt-5.5 | cheapest floor for the most trivial mechanical work |
| ambiguous | gpt-5.5 | judgment-heavy but not user-facing — incl. reviews/judging of Opus output (Opus never judges its own work) |
| taste | opus-5 | user-facing / taste-critical default (taste must be > 7) |
| taste-hero | fable-5 | hero / flagship taste surface — gated (`fable=on` / `--fable`) |
| computer-use | gpt-5.6-terra | Codex real-UI runtime verification (the `codex-computer-use` skill) |
| codex-default | gpt-5.5 | default `-m` for `codex exec` (pass it explicitly — config.toml may differ) |
| never | haiku-4.5 | never used, any role |

**Escalation ladder (non-taste)** — cheapest rung first, escalate a miss without asking
until the fable rung (gated): `gpt-5.5 → gpt-5.6-terra → gpt-5.6-sol → fable-5`.
(opus-5 is no longer a non-taste escalation rung — intelligence 7 sits below the
Codex rungs, and it is not effective at judging its own work; it remains the
`taste` rung.)

**Routing priority when axes conflict / for anything that ships:** intelligence > taste
> cost. Cost is a tie-breaker only. No Codex generalist (terra/sol/luna/gpt-5.5) or
sonnet-5 clears the taste bar (> 7) — taste work is opus-5 or fable-5.

## Reach — how to invoke each model

| Model | Reach |
|---|---|
| gpt-5.6-sol | Codex — `codex exec -m gpt-5.6-sol` (smart escalation rung) |
| gpt-5.6-terra | Codex — `codex exec -m gpt-5.6-terra` (default generalist) |
| gpt-5.6-luna | Codex — `codex exec -m gpt-5.6-luna` (cheaper terra-peer) |
| gpt-5.5 | Codex — `codex exec -m gpt-5.5` (agents default; pass `-m` explicitly — `~/.codex/config.toml` currently defaults to gpt-5.6-sol, so a bare `codex exec` does NOT run gpt-5.5) |
| sonnet-5 | Agent/Workflow `model: 'sonnet'` |
| opus-5 | Agent/Workflow `model: 'opus'` |
| fable-5 | Agent/Workflow `model: 'fable'` |

Codex generalists (gpt-5.5, gpt-5.6-*) are reachable **only via Codex** — the
Agent/Workflow `model:` param takes Claude models only. Inside workflows/subagents,
wrap Codex in a thin `sonnet` agent whose Bash call is `codex exec -m <model>`, and
label the wrapper with the real worker (`gpt-5.6-terra:...`) so the roster shows which
Codex model actually ran. See the `crossfire-blitz` skill for the full mechanics.

## Codex 5.6 effort & invocation rules

Pin `-c model_reasoning_effort="…"` on **every** `codex exec` — a bare invocation
inherits `~/.codex/config.toml`, which may name a level the target model rejects
(gpt-5.5 hard-fails on `ultra`/`max`) or a level these rules don't grant.

| Model | Allowed effort | `ultra` | Invocation rule |
|---|---|---|---|
| gpt-5.6-terra | `medium` / `high` / `xhigh` (`high` is the standing default) | **Only use `ultra` if the user requested it, and only in a solo subagent run** — one Codex lane, nothing else in flight; never inside a parallel wave/fan-out | default generalist — free to route |
| gpt-5.6-sol | `medium` / `high` / `xhigh` (`medium` is the standing default) | **Only use `ultra` if the user requested it, and only in a solo subagent run** — one Codex lane, nothing else in flight; never inside a parallel wave/fan-out | escalation rung — free to route |
| gpt-5.6-luna | `medium` / `high` / `xhigh` | no ultra lane — work that seems to need luna-at-ultra routes to terra/sol instead | **Automated workflows only** (a router assigned it — a `route:` tag, a cost-sensitive C1 batch). **Never self-invoke**: don't pick luna on your own initiative, and never for risky or Novelty ≥ 1 work |
| gpt-5.5 | `none`…`xhigh` (API **rejects** `ultra`/`max`) | rejected by the API | agents default + cheapest floor — free to route |

Risky tasks (miss is costly, spec subtle, blast radius wide) never run below `high`
on a Codex model and never route to luna; if a risky task seems to demand `ultra`
mid-wave, don't sneak it in — defer the task to `sonnet` (a Claude executor) or
surface the ultra request to the user and run it as a solo lane.

## Where these numbers are duplicated (kept honest by §6 of `validate-skills.sh`)

- `claude/skills/crossfire-blitz/SKILL.md` — the routing table (5-column, `Reached via`)
- (any future skill that inlines a scores table is checked automatically)

The check scans every `claude/skills/**/SKILL.md`, matches any Markdown table row whose
first cell is a model named above and whose next three cells are integers, and errors on
a mismatch. Partial tables are fine (a skill may list a subset of models); only the rows
that exist are compared.
