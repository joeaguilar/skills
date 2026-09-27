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
| gpt-6-astra | 3 | 9 | 9 |
| gpt-6-sol | 5 | 9 | 7 |
| gpt-5.6-terra | 6 | 8 | 5 |
| gpt-5.6-luna | 7 | 8 | 4 |
| gpt-5.5 | 9 | 8 | 5 |
| haiku-4.5 | 7 | 3 | 5 |
| sonnet-5 | 5 | 5 | 7 |
| opus-5.5 | 7 | 8 | 8 |
| fable-5.1 | 2 | 9 | 9 |

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

**Score history (2026-09-13, gpt-6-astra added).** OpenAI shipped GPT-6 Astra on
2026-09-03 and it is now the `~/.codex/config.toml` default. Independent numbers put
it **level with fable-5 on intelligence** (Artificial Analysis Intelligence Index tied;
Coding Agent Index 67.0 vs 67.2; Astra ahead on Terminal-Bench 4.0 59% vs 52% and on
computer use, Fable ahead on Humanity's Last Exam and long-context recall) → **9**.
List price is identical to Fable ($10/$50 per MTok) but Astra uses far fewer tokens
per task (~$1.67 vs $3.76 on reasoning benchmarks) and runs on the Codex plan
allowance, at 2.5× the sol rate → **cost 3** (one rung cheaper than Fable, two dearer
than sol). No published UI/UX taste benchmark; reviewers put its front-end work
"level with or slightly behind" Fable and Opus 5 and it wins on professional
artifacts (BenchCAD 95.9% vs 84.3%) → **taste 8**, clearing the `> 7` bar. It is the
first OpenAI model rated **Critical** for cyber under the Preparedness Framework —
offensive-security tasks are declined; do not route red-team work to it. Reachable
only via Codex (`codex exec -m gpt-6-astra`). Effort: `low`…`xhigh` (`none` is
rejected; `max` is Responses-API only).

**Score history (2026-09-22, generation swap, operator-dictated).** Three successors
replace their predecessors in every routing role, and the old names leave the Scores table:
- **gpt-6-sol replaces gpt-5.6-sol.** The Codex generalist with more taste than 5.6-sol
  (Codex's own catalog now lists 5.6-sol as the "older coding model") → **5 / 9 / 7**.
  Taste 7 still does **not** clear the `> 7` bar, so sol is still not a taste rung.
- **opus-5.5 replaces opus-5.** The Opus-quality output you expect, closer to fable-5 than
  opus-5 was → intelligence **8** (up from 7), taste **8**. List price dropped to $4/$20
  per MTok (from $5/$25), but thinking can't be turned off and its default effort is
  `medium` → cost stays **7**. It keeps the `taste` role. It is still not a non-taste
  escalation rung (intelligence 8 is level with gpt-5.5 and below sol/astra), and **Opus
  still never judges its own work**. That rule carries over from opus-5 and matches the
  global reviewer ≠ writer rule.
- **fable-5.1 replaces fable-5.** A frontier-class model with high taste, and the same
  $10/$50 list price as fable-5 → **2 / 9 / 9**. **Save it for planning and review.** It
  does not write code. It keeps the gated `taste-hero` rung and the top of the escalation
  ladder, and takes the new `planner` role.
- **gpt-6-astra: taste 8 → 9.** It is now rated high-taste with excellent writing. It
  ties fable-5.1 on intelligence and taste at one cost rung cheaper, so it is the
  high-quality writer and fable-5.1 is the planner/judge.

**Availability (2026-09-26, operator-dictated): gpt-6-sol is unavailable.** On this
machine's Codex login, `codex exec -m gpt-6-sol` fails with "The 'gpt-6-sol' model is not
supported when using Codex with a ChatGPT account." It keeps its Scores row so skills that
name it stay legal, but it holds **no routing role** until that changes. Its seats fall
through: the cheap cross-model reviewer becomes gpt-5.6-terra (gpt-5.5 when terra wrote
the work), and the escalation ladder skips its rung. gpt-5.5, gpt-5.6-terra, gpt-5.6-luna,
and gpt-6-astra answered `codex exec` the same day. To restore sol, delete this paragraph
and the "unavailable" marks below, then re-add it to the reviewer row and the ladder.

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
| taste | opus-5.5 | user-facing / taste-critical default (taste must be > 7) |
| taste-hero | fable-5.1 | hero / flagship taste surface — gated (`fable=on` / `--fable`) |
| planner | fable-5.1 | planning / spec / decomposition seats. Fable's standing job is plan + review, not writing code, so spend it here and on the reviewer seat |
| computer-use | gpt-5.6-terra | Codex real-UI runtime verification (the `codex-computer-use` skill) |
| reviewer | *cross-model* | any review / critique / judge seat — **never the model that wrote the work**. If Codex (astra/terra/gpt-5.5) or opus-5.5 wrote it → fable-5.1, or for cheap passes gpt-5.6-terra (gpt-5.5 when terra wrote it). If a Claude model wrote it → gpt-6-astra when quality matters, gpt-5.6-terra otherwise. (gpt-6-sol is unavailable — see Availability) |
| codex-default | gpt-5.5 | default `-m` for `codex exec` (pass it explicitly — config.toml may differ) |
| never | haiku-4.5 | never used, any role |

**Escalation ladder (non-taste)** — cheapest rung first, escalate a miss without asking
until the fable rung (gated): `gpt-5.5 → gpt-5.6-terra → gpt-6-astra → fable-5.1`.
(The gpt-6-sol rung between terra and astra is skipped while sol is unavailable.)
(gpt-6-astra sits one rung below Fable: same intelligence, one rung cheaper, and it
spends Codex allowance rather than Fable budget, so reach it before Fable for code.)
(opus-5.5 is not a non-taste escalation rung. Its intelligence 8 is level with gpt-5.5
and below the sol/astra rungs, and Opus never judges its own work. It remains the
`taste` rung.)

**Routing priority when axes conflict / for anything that ships:** intelligence > taste
> cost. Cost is a tie-breaker only. No Codex generalist (terra/sol/luna/gpt-5.5) or
sonnet-5 clears the taste bar (> 7); gpt-6-sol's taste 7 still falls short. Taste work goes
to opus-5.5, gpt-6-astra, or fable-5.1.

## Reach — how to invoke each model

| Model | Reach |
|---|---|
| gpt-6-astra | Codex — `codex exec -m gpt-6-astra` (top Codex rung; high-taste code/prose writer + cross-model judge) |
| gpt-6-sol | **Unavailable** — `codex exec -m gpt-6-sol` is rejected on this Codex login (ChatGPT account); no routing role until that changes (see Availability) |
| gpt-5.6-terra | Codex — `codex exec -m gpt-5.6-terra` (default generalist) |
| gpt-5.6-luna | Codex — `codex exec -m gpt-5.6-luna` (cheaper terra-peer) |
| gpt-5.5 | Codex — `codex exec -m gpt-5.5` (agents default; pass `-m` explicitly — `~/.codex/config.toml` currently defaults to **gpt-6-astra at effort ultra**, so a bare `codex exec` runs the most expensive Codex model at its most expensive effort, not gpt-5.5) |
| sonnet-5 | Agent/Workflow `model: 'sonnet'` |
| opus-5.5 | Agent/Workflow `model: 'opus'` (`claude-opus-5-5`) |
| fable-5.1 | Agent/Workflow `model: 'fable'` (`claude-fable-5-1`) |

Codex generalists (gpt-5.5, gpt-5.6-*, gpt-6-*) are reachable **only via Codex** — the
Agent/Workflow `model:` param takes Claude models only. Inside workflows/subagents,
wrap Codex in a thin `sonnet` agent whose Bash call is `codex exec -m <model>`, and
label the wrapper with the real worker (`gpt-5.6-terra:...`) so the roster shows which
Codex model actually ran. See the `crossfire-blitz` skill for the full mechanics.

## Codex effort & invocation rules

Pin `-c model_reasoning_effort="…"` on **every** `codex exec` — a bare invocation
inherits `~/.codex/config.toml`, which may name a level the target model rejects
(gpt-5.5 hard-fails on `ultra`/`max`; config.toml currently says `ultra`) or a level
these rules don't grant.

| Model | Allowed effort | `ultra` | Invocation rule |
|---|---|---|---|
| gpt-6-astra | `low` / `medium` / `high` / `xhigh` (`high` is the standing default; `none` is rejected) | `max` / `ultra` (ultra = automatic task delegation) — **only if the user requested it, and only in a solo subagent run**; never inside a parallel wave/fan-out | top rung — route for code that must be right the first time, for high-taste prose, and as the cross-model judge of Claude output; 2.5× sol per token, so not for bulk waves. Declines offensive-security work (Critical cyber rating) |
| gpt-6-sol | `low` / `medium` / `high` / `xhigh` (`medium` is the standing default) | `max` / `ultra` — **only if the user requested it, and only in a solo subagent run**. That means one Codex lane with nothing else in flight, never inside a parallel wave/fan-out | **unavailable — do not route** (see Availability); when restored: escalation rung + cheap cross-model reviewer |
| gpt-5.6-terra | `medium` / `high` / `xhigh` (`high` is the standing default) | **Only use `ultra` if the user requested it, and only in a solo subagent run** — one Codex lane, nothing else in flight; never inside a parallel wave/fan-out | default generalist — free to route |
| gpt-5.6-luna | `medium` / `high` / `xhigh` | no ultra lane — work that seems to need luna-at-ultra routes to terra instead (sol is unavailable) | **Automated workflows only** (a router assigned it — a `route:` tag, a cost-sensitive C1 batch). **Never self-invoke**: don't pick luna on your own initiative, and never for risky or Novelty ≥ 1 work |
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
