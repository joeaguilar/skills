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
| gpt-6.1-sol | 5 | 9 | 7 |
| gpt-6-sol | 5 | 9 | 7 |
| gpt-5.6-sol | 5 | 9 | 6 |
| gpt-6-luna | 7 | 8 | 4 |
| gpt-5.6-terra | 6 | 8 | 5 |
| gpt-5.6-luna | 7 | 8 | 4 |
| gpt-5.5 | 9 | 8 | 5 |
| haiku-5.5 | 10 | 8 | 5 |
| sonnet-5.5 | 5 | 8 | 7 |
| opus-5.5 | 7 | 8 | 8 |
| fable-5.1 | 2 | 9 | 9 |

## Basis (2026-10-23 rewrite, operator-dictated)

The rules before this date were set against an older benchmark snapshot (see
`COMPLEXITY.md`) and a generation that has since moved. The operator reset them on
2026-10-23. Earlier score history is in git (`git log -p -- claude/MODELS.md`).

- **The Sol class is the GPT baseline.** The generalist, bulk, ambiguous and
  codex-default roles go to **gpt-6.1-sol** ("latest workhorse model for coding and
  everyday work" in the Codex catalog; reachable from CLI 0.164.0, probed 2026-10-23).
  It is not on the benchmark boards yet, so it carries gpt-6-sol's score (5 / 9 / 7)
  until it is measured. Its line earned the seat: gpt-5.6-sol led ARC-AGI-2 for its
  generation, and Artificial Analysis puts it above terra and luna on both its
  Intelligence Index (59 vs 55 / 51) and its Coding Agent Index (80 vs 77 / 75);
  gpt-6-sol improved on it at about half the cost per task.
- **GPT-5.5, GPT-5.6 (terra, luna) and the luna class are for one-off small decisions.**
  They are still good at that, so they share the `floor` role. They are not the baseline.
  **gpt-6-luna** ("fast and affordable model for easier tasks") joins the floor
  (operator, 2026-10-23). It is unmeasured, so it carries gpt-5.6-luna's score (7 / 8 / 4).
- **Anthropic's lineup took a substantial step.**
  - **haiku-5.5** replaces haiku-4.5 (which held the `never` role). The operator rates
    it as usable as the GPT-5.5 / 5.6 (luna) class, so intelligence 8. At $0.10 / $0.50
    per MTok (prompts ≤ 100K) it is the cheapest model here (cost 10), and it runs
    natively in the Claude harness with no Codex wrapper. Anthropic reports
    Terminal-Bench 4.0 39.2% (Haiku 4.5: 0.0%) and SWE-Bench Pro 64.8%. Its taste
    carries over at 5. Refusals have no server-side fallback.
  - **sonnet-5.5** replaces sonnet-5 at the same price ($2 / $10). Anthropic reports
    SWE-Bench Pro 81.3% and Terminal-Bench 4.0 70.6%, and third parties report
    CursorBench 4.0 55.5% (Sonnet 5: 34.1%). So intelligence goes 5 → 8. Cost (5) and
    taste (7) carry over; taste still does not clear the `> 7` bar.
  - **opus-5.5** and **fable-5.1** are unchanged (8 / 8 and 9 / 9). Opus still never
    judges its own work.
- **Reachability (probed 2026-10-23 on Codex CLI 0.164.0).** Reachable: gpt-6.1-sol,
  gpt-6-astra, gpt-6-sol, gpt-6-luna, gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna.
  **gpt-5.5 is unreachable**: "The 'gpt-5.5' model is not supported when using Codex
  with a ChatGPT account", and the catalog no longer lists it (last worked 2026-09-28).
  Its row stays so that skills naming it stay legal, but it holds no role; a seat that
  would have used it for a small decision uses a floor seat.
  gpt-6-sol and gpt-5.6-sol are previous Sol generations: reachable, no role.

**Model names legal in skills** = the Scores table above, plus anything listed on
an allowlist line. A skill naming anything else fails `models.sh check`. Legality
deliberately does **not** come from prose mentions in this file — otherwise a
historical note like the ones above would silently re-legalize every stale
reference to a model we just retired. To let a non-routing model be named in a
skill, add it here on purpose:

<!-- models-allow: haiku-4.5 sonnet-5 -->
haiku-4.5 and sonnet-5 (predecessors, named in history notes and retag recipes).

## Roles → model

Skills route by **role**, not by model name — so a model swap changes only the lines
below, not the ~40 prose sites that reference a role. ("Route bulk work to **the
generalist**" never changes when one Sol model replaces another.) The `route:<role>`
tags `/groom` writes (COMPLEXITY.md) name roles too, so a swap here retags nothing.
**Resolve a role at spawn time**: read its Model and Effort from this table, pass the
model (and, for a GPT model, `-e <effort>` to `codex-seat.sh`), and label the seat with
the resolved model name so the roster shows what really ran.

| Role | Model | Effort | Meaning |
|---|---|---|---|
| generalist | gpt-6.1-sol | medium | the default for agents. The Sol-class baseline |
| bulk | gpt-6.1-sol | medium | bulk / mechanical implementation, migrations, data transforms |
| floor | haiku-5.5 | medium | one-off small decisions and trivial, gated mechanical work. gpt-6-luna, gpt-5.6-terra and gpt-5.6-luna are peers (gpt-6-luna first, at `medium`); use one when the seat must be non-Claude (for example, a quick check of Claude output) |
| builder | sonnet-5.5 | default | spec-complete, multi-file build work that stays native in the Claude harness |
| ambiguous | gpt-6.1-sol | high | judgment-heavy but not user-facing, incl. reviews/judging of Opus output (Opus never judges its own work). `xhigh` for the hardest; escalate to `frontier` when the decision is final |
| frontier | gpt-6-astra | high | code that must be right the first time, a wide blast radius, the irreducible core of a C4 ticket. Never a bulk wave |
| taste | opus-5.5 | default | user-facing / taste-critical default (taste must be > 7) |
| taste-hero | fable-5.1 | default | hero / flagship taste surface — gated (`fable=on` / `--fable`) |
| planner | fable-5.1 | default | planning / spec / decomposition seats. Fable's standing job is plan + review, not writing code, so spend it here and on the reviewer seat |
| ceiling | fable-5.1 | default | top rung of the non-taste escalation ladder — gated (`fable=on` / `--fable`) |
| computer-use | gpt-5.6-terra | high | Codex real-UI runtime verification (the `codex-computer-use` skill); `frontier` may take the seat |
| reviewer | *cross-model* | per seat | any review / critique / judge seat — **never the model that wrote the work**. GPT-written → `builder` for cheap passes, `taste` when quality matters, `planner` when Fable is on. Claude-written → `ambiguous` for a standard pass, `frontier` when quality matters. Prefer the other family: the reviewer's model should be the other provider from the writer's. When that is not practical, a different model is the minimum — never the writer's own. Resolve the seat, then confirm it; if a binding swap breaks that, take the next seat listed. Opus may review GPT or Sonnet work, never its own |
| codex-default | gpt-6.1-sol | medium | default `-m` for `codex exec` (pass it explicitly — config.toml differs) |
| never | haiku-4.5 | — | retired generation; haiku-5.5 replaced it |

**Effort** is the `model_reasoning_effort` pin for a GPT binding (`-e` to `codex-seat.sh`;
the Codex effort table below lists what each model accepts) and the Agent/Workflow
`effort` for a Claude one; `default` leaves the harness default. Risky work runs a GPT
binding at `high` or above, whatever this column says.

**Floor guard.** The floor role and its peers take work that is short,
one-off, gated by a mechanical check, Novelty 0, and not risky. Anything else starts
at the generalist.

**Escalation ladder (non-taste)** — cheapest rung first, escalate a miss without asking
until the ceiling (gated). The rungs are roles:
`floor → generalist → frontier → ceiling`.
A `builder` miss enters at `generalist`. (Today the frontier rung sits one below the
ceiling: gpt-6-astra matches Fable's intelligence one cost rung cheaper and spends Codex
allowance rather than Fable budget, so it is reached before Fable for code.) The `taste`
binding is not a non-taste rung: opus-5.5's intelligence 8 is below the Sol rung.
**Taste ladder:** `taste → taste-hero` (gated).

**Routing priority when axes conflict / for anything that ships:** intelligence > taste
> cost. Cost is a tie-breaker only. Only a model whose Scores-table Taste is above 7
clears the taste bar, so taste work goes to the `taste`, `taste-hero` or `frontier`
binding — check the binding still clears the bar after any swap.

## Reach — how to invoke each model

| Model | Reach |
|---|---|
| gpt-6-astra | Codex — `codex exec -m gpt-6-astra` (top Codex rung; high-taste code/prose writer + cross-model judge) |
| gpt-6.1-sol | Codex — `codex exec -m gpt-6.1-sol` (the Sol-class baseline) |
| gpt-6-sol / gpt-5.6-sol | Codex — previous Sol generations; reachable, no role |
| gpt-6-luna | Codex — `codex exec -m gpt-6-luna` (floor peer; the first GPT floor seat) |
| gpt-5.6-terra | Codex — `codex exec -m gpt-5.6-terra` (floor peer; computer-use seat) |
| gpt-5.6-luna | Codex — `codex exec -m gpt-5.6-luna` (floor peer) |
| gpt-5.5 | **Unreachable** on this login (see Basis); no role |
| haiku-5.5 | Agent/Workflow `model: 'haiku'` (`claude-haiku-5-5`; effort default `medium`) |
| sonnet-5.5 | Agent/Workflow `model: 'sonnet'` (`claude-sonnet-5-5`) |
| opus-5.5 | Agent/Workflow `model: 'opus'` (`claude-opus-5-5`) |
| fable-5.1 | Agent/Workflow `model: 'fable'` (`claude-fable-5-1`) |

GPT models are reachable **only via Codex** — the Agent/Workflow `model:` param takes
Claude models only. Launch them with the `codex-seat` skill: a thin `sonnet` wrapper
whose Bash call runs `codex-seat.sh` (which runs `codex exec -m <model>` with the
effort pinned), labelled with the real worker (`gpt-6.1-sol:...`) so the roster shows
which GPT model actually ran. `~/.codex/config.toml` currently defaults to
**gpt-6-astra at effort xhigh**, so a bare `codex exec` runs the most expensive Codex
model.

## Codex effort & invocation rules

Pin `-c model_reasoning_effort="…"` on **every** `codex exec` — a bare invocation
inherits `~/.codex/config.toml`, which may name a level the target model rejects or a
level these rules don't grant. Supported levels below are from the Codex model catalog
(`~/.codex/models_cache.json`, fetched 2026-10-23).

| Model | Allowed effort | `max` / `ultra` | Invocation rule |
|---|---|---|---|
| gpt-6-astra | `low` / `medium` / `high` / `xhigh` (`high` is the standing default; `none` is rejected) | **only if the user requested it, and only in a solo seat** (ultra = automatic task delegation); never inside a parallel wave/fan-out | top rung — code that must be right the first time, high-taste prose, the cross-model judge of Claude output; not for bulk waves. Declines offensive-security work (Critical cyber rating) |
| gpt-6.1-sol | `low` / `medium` / `high` / `xhigh` (`medium` is the standing default; `high`+ for C3 or risky work) | **only if the user requested it, and only in a solo seat** | the baseline — free to route |
| gpt-5.6-terra | `low` / `medium` / `high` / `xhigh` (`medium` is the standing default for floor seats; `high` for computer use) | **only if the user requested it, and only in a solo seat** | floor peer + computer-use seat — free to route within the floor guard |
| gpt-6-luna | `low` / `medium` / `high` / `xhigh` (`medium` is the standing default) | `max` only if the user requested it; no `ultra` | floor peer — one-off small decisions or router-assigned batches; never risky or Novelty ≥ 1 work |
| gpt-5.6-luna | `low` / `medium` / `high` / `xhigh` | `max` only if the user requested it; no `ultra` | floor peer — one-off small decisions or router-assigned batches; never risky or Novelty ≥ 1 work |
| gpt-5.5 | — | — | unreachable; do not route (it also rejects `ultra`/`max` if it returns) |

Risky tasks (miss is costly, spec subtle, blast radius wide) never run below `high`
on a Codex model and never route to the floor; if a risky task seems to demand
`ultra` mid-wave, don't sneak it in — surface the request to the user and run it as a
solo seat.

## Where these numbers are duplicated (kept honest by §6 of `validate-skills.sh`)

- `claude/skills/crossfire-blitz/SKILL.md` — the routing table (5-column, `Reached via`)
- (any future skill that inlines a scores table is checked automatically)
- Role names: `models.sh check` also warns on any `route:<x>` tag in a skill that is
  neither a role in the Roles table nor a legal model name.

The check scans every `claude/skills/**/SKILL.md`, matches any Markdown table row whose
first cell is a model named above and whose next three cells are integers, and errors on
a mismatch. Partial tables are fine (a skill may list a subset of models); only the rows
that exist are compared.
