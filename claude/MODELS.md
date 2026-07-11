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
| gpt-5.5 | 9 | 7 | 5 |
| haiku-4.5 | 7 | 3 | 5 |
| sonnet-5 | 5 | 5 | 7 |
| opus-4.8 | 7 | 7 | 8 |
| fable-5 | 2 | 9 | 9 |

## Roles → model

Skills route by **role**, not by model name — so a model swap changes only the lines
below, not the ~40 prose sites that reference a role. ("Route bulk work to **the
generalist**" never changes when terra replaces gpt-5.5.)

| Role | Model | Meaning |
|---|---|---|
| generalist | gpt-5.6-terra | the default Codex generalist Claude spins up when needed |
| bulk | gpt-5.6-terra | bulk / mechanical implementation, migrations, data transforms |
| floor | gpt-5.5 | cheapest floor for the most trivial mechanical work |
| ambiguous | opus-4.8 | judgment-heavy but not user-facing |
| taste | opus-4.8 | user-facing / taste-critical default (taste must be > 7) |
| taste-hero | fable-5 | hero / flagship taste surface — gated (`fable=on` / `--fable`) |
| computer-use | gpt-5.6-terra | Codex real-UI runtime verification (the `codex-computer-use` skill) |
| codex-default | gpt-5.6-terra | default `-m` for `codex exec` |
| never | haiku-4.5 | never used, any role |

**Escalation ladder (non-taste)** — cheapest rung first, escalate a miss without asking
until the fable rung (gated): `gpt-5.6-terra → gpt-5.6-sol → opus-4.8 → fable-5`.

**Routing priority when axes conflict / for anything that ships:** intelligence > taste
> cost. Cost is a tie-breaker only. No Codex generalist (terra/sol/luna/gpt-5.5) or
sonnet-5 clears the taste bar (> 7) — taste work is opus-4.8 or fable-5.

## Reach — how to invoke each model

| Model | Reach |
|---|---|
| gpt-5.6-sol | Codex — `codex exec -m gpt-5.6-sol` (smart escalation rung) |
| gpt-5.6-terra | Codex — `codex exec -m gpt-5.6-terra` (default generalist) |
| gpt-5.6-luna | Codex — `codex exec -m gpt-5.6-luna` (cheaper terra-peer) |
| gpt-5.5 | Codex — `~/.codex/config.toml` default; `codex exec` with no `-m` |
| sonnet-5 | Agent/Workflow `model: 'sonnet'` |
| opus-4.8 | Agent/Workflow `model: 'opus'` |
| fable-5 | Agent/Workflow `model: 'fable'` |

Codex generalists (gpt-5.5, gpt-5.6-*) are reachable **only via Codex** — the
Agent/Workflow `model:` param takes Claude models only. Inside workflows/subagents,
wrap Codex in a thin `sonnet` agent whose Bash call is `codex exec -m <model>`, and
label the wrapper with the real worker (`gpt-5.6-terra:...`) so the roster shows which
Codex model actually ran. See the `crossfire-blitz` skill for the full mechanics.

## Where these numbers are duplicated (kept honest by §6 of `validate-skills.sh`)

- `claude/skills/crossfire-blitz/SKILL.md` — the routing table (5-column, `Reached via`)
- (any future skill that inlines a scores table is checked automatically)

The check scans every `claude/skills/**/SKILL.md`, matches any Markdown table row whose
first cell is a model named above and whose next three cells are integers, and errors on
a mismatch. Partial tables are fine (a skill may list a subset of models); only the rows
that exist are compared.
