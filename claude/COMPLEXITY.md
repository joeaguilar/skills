# COMPLEXITY.md — issue-complexity rubric & model routing for grooming

Companion to [`MODELS.md`](MODELS.md). MODELS.md owns the scores and role→model
bindings; **this file owns the grooming-time question: "which role should take this
ticket?"** Apply it while grooming an `itr` backlog (during `/sprint`,
`/roadmap`, or ad-hoc triage), record the verdict as tags, and the execution
skills (`/blitz`, `/crossfire-blitz`, `/ninja-meiyaku`) inherit a pre-routed backlog.

**Routes rewritten 2026-10-23** with MODELS.md: the Sol class is the GPT baseline,
GPT-5.5/5.6 and haiku-5.5 share the floor for one-off small decisions, sonnet-5.5
builds spec-complete work natively, and gpt-5.5 is unreachable on this Codex login.
**Tags became roles 2026-10-24**: a route names a MODELS.md role, never a model, and
the executor resolves it at spawn time. The evidence in each tier below describes the
models bound to that role today.

**Evidence base.** Two snapshots, each anchoring different rubric axes:

| Benchmark | What it stresses | Snapshot |
|---|---|---|
| [FrontierSWE](https://www.frontierswe.com/) | frontier-hard SWE tasks (build/reimplement/optimize) | 2026-07-11 |
| [SWE-Marathon](https://www.swe-marathon.org/) | ultra-long-horizon (2–10h wall-clock, ~27M tokens/run) | 2026-07-11 |
| [ARC-AGI-2](https://arcprize.org/leaderboard) | novel abstract reasoning, cost-per-task efficiency | 2026-07-11 |
| [Vibe Code Bench](https://www.vals.ai/benchmarks/vibe-code) | build full apps from spec, UI-tested end-to-end | 2026-07-11 |
| Terminal-Bench 4.0, SWE-Bench Pro, CursorBench 4.0, Artificial Analysis indices | agentic terminal work, hard SWE, IDE coding, cross-model intelligence/coding | 2026-10-23 (vendor + third-party, see bottom) |

FrontierSWE/SWE-Marathon → **horizon & difficulty ceiling**, ARC → **novel
reasoning per dollar**, Vibe Code → **spec-complete building & taste**, the
2026-10 boards → **where the new Anthropic generation and the Sol line sit**.

## Scoring a ticket — five signals, 0–2 each

Score the ticket as written *after* grooming (a well-groomed ticket scores lower
than the same work badly specified — that's the point).

| Signal | 0 | 1 | 2 |
|---|---|---|---|
| **Horizon** — how long must one agent run? | one sitting, one file | a few files, one session | multi-hour, many-step, spans subsystems |
| **Novelty** — is there a pattern to copy? | in-repo precedent exists | adapt a known pattern | no precedent: new algorithm, perf work, tricky design |
| **Ambiguity** — is the spec complete? | acceptance criteria fully pin it | minor judgment calls | requirements need interpretation / tradeoffs |
| **Blast radius** — what can it break? | isolated leaf file | one module + its callers | cross-cutting, coupled, shared API/schema |
| **Taste surface** — who sees the output? | invisible plumbing | developer-facing (API names, CLI output, docs) | user-facing UI / copy / hero surface |

**Verifiability modifier:** if no gate can mechanically prove the work (no test,
no `gatr` gate, no screenshot check) — **bump the tier by one** or write the gate
into the ticket first. Grounding: SWE-Marathon's failure taxonomy — 15.4% of
failures are reward hacking and 4% poor self-verification; unverifiable work is
exactly where cheap models fake success.

**Horizon is the strongest signal.** SWE-Marathon: pass rate decays
monotonically with run length on the Claude Code scaffold (41.9% → 3.2%), and
passing trials used ~4× fewer tokens than failing ones. **Slicing a big ticket
into short-horizon children beats any model escalation.**

## Tiers → routes

Sum the five signals (0–10), apply the verifiability modifier, then route:

| Tier | Score | Route (MODELS.md role) | itr tags |
|---|---|---|---|
| **C0 — trivial** | 0–1 | **floor**; a floor peer when a non-Claude seat is wanted | `complexity:C0`, `route:floor` |
| **C1 — routine** | 2–3 | **generalist** | `complexity:C1`, `route:generalist` |
| **C2 — standard** | 4–5 | **builder** if spec-complete build work; **bulk** if mechanical-heavy | `complexity:C2`, `route:builder` or `route:bulk` |
| **C3 — complex** | 6–7 | **ambiguous**; **frontier** when it must be right the first time or the blast radius is wide | `complexity:C3`, `route:ambiguous` or `route:frontier` |
| **C4 — frontier** | 8–10 | **frontier** builds it; the **planner** (gated: `fable=on` / `--fable`) plans the slicing and reviews — try to slice first | `complexity:C4`, `route:frontier` |

### C0 — trivial / one-off → floor

Renames, config bumps, doc/comment fixes, dependency bumps, single small
decisions — anything where a green gate fully defines "done." The operator rates
haiku-5.5 as usable as the GPT-5.5/5.6 class for this work (2026-10-23). It is the
cheapest model on the table and needs no Codex wrapper. Anthropic reports
Terminal-Bench 4.0 39.2%, against 0.0% for haiku-4.5. **Constraint: short runs,
hard gates, Novelty 0.** gpt-6-luna (first), gpt-5.6-terra and gpt-5.6-luna are
peers when the seat should be non-Claude. Luna's novel reasoning is weak (ARC ≤59.5%), so this tier is
the only place it belongs.

### C1 — routine → generalist

Small well-specified features and bugfixes with an in-repo pattern to follow.
The Sol class is the GPT baseline (operator, 2026-10-23), and gpt-6.1-sol is its
current model. The line's evidence: gpt-5.6-sol led ARC-AGI-2 for its generation
(92.5% @ $1.44/task) and tops terra and luna on Artificial Analysis' Intelligence
(59 vs 55 / 51) and Coding Agent (80 vs 77 / 75) indices; gpt-6-sol improved on it
at about half the cost per task. gpt-6.1-sol itself is not measured yet.
A C1 that turns out to be a one-file, Novelty-0 change can drop to the floor.

### C2 — standard, spec-complete → builder (the "delegate to Sonnet" tier)

This tier answers "what can Sonnet take?": **multi-file build work with a
complete spec, written acceptance criteria, contained blast radius, no novel
algorithm, and at most developer-facing taste.** Sonnet 5 already placed #3 on
Vibe Code (81.3%, above every GPT model). Sonnet 5.5 is a large step up at the
same price: Anthropic reports SWE-Bench Pro 81.3%, and third parties report
CursorBench 4.0 55.5%, up from 34.1%. It is the cheapest strong route that stays
native in the Claude harness (`model: 'sonnet'` in Agent/Workflow, no Codex
wrapper). If the C2 is mechanical-heavy rather than build-shaped (large
migration, codemod sweep), `bulk` is the better per-dollar route.

### C3 — complex → ambiguous, frontier when it must land first time

- **Novelty- or ambiguity-dominant** (algorithm design, perf work, judgment
  across a coupled codebase, underspecified requirements): **ambiguous**
  (gpt-6.1-sol at `high`/`xhigh` today). The GPT line leads on novel reasoning
  per dollar, and Sol at intelligence 9 sits above opus-5.5 and sonnet-5.5.
- **Wide blast radius or "must be right the first time"**: **frontier**, one rung up.
- **Taste=2 always forces `taste` minimum** regardless of the other signals
  (MODELS.md taste bar: Taste > 7 — the `taste`, `taste-hero` and `frontier` bindings).

### C4 — frontier → slice first, frontier builds, the planner plans and reviews

Multi-hour autonomous builds, hardest debugging, hero taste surfaces. Fable 5
was #1 everywhere it appeared: FrontierSWE (90% dominance, with a large gap to
#2), Vibe Code (90.4%), SWE-Marathon (~29.9% preliminary). But even Fable
passes under a third of true long-horizon tasks. So the groomer's first move
on a C4 is **decompose it into C1–C2 children with dependencies
(`itr depend`)**. The `planner` (fable-5.1) is the right seat for that
decomposition, since Fable is saved for planning and review. The irreducible core
that still has to be written routes to **frontier** (gpt-6-astra: same intelligence,
one cost rung cheaper, Codex allowance), with the planner as its reviewer. Fable
stays gated per MODELS.md (`fable=on` / `--fable`).

## Hard overrides (apply after scoring)

1. **Taste-critical → `taste`, `taste-hero` or `frontier`, always** — Vibe Code's UI-tested
   board has Anthropic in the top four spots; the MODELS.md taste bar stands.
2. **Floor guard** — `floor` and its peers take only short, one-off, gated,
   Novelty-0, non-risky work. Anything else starts at `generalist`.
3. **Every route keeps a hard verify gate.** Long-horizon runs without one are where
   cheap models fake success (SWE-Marathon: GPT-5.5 had the highest reward-hacking
   share). Add the gate first or route higher.
4. **Claude routes get cross-model review** — Claude models show zero reward
   hacking but the highest poor-self-verification share (~20% for Opus 4.7 on
   SWE-Marathon). Pair Claude execution with a non-Claude reviewer (the
   `crossfire` pattern) before close. **Opus never reviews its own output.**
5. **Escalation ladder** (MODELS.md): a miss escalates
   `floor → generalist → frontier → ceiling (gated)` without asking.
   A `builder` miss enters at `generalist`. On escalation, re-tag:
   `--remove-tag route:X --add-tag route:Y --add-tag escalated:from-X`.
6. **Legacy model tags.** Backlogs groomed before 2026-10-24 carry `route:<model>`
   tags, some naming models with no role now (gpt-5.5 is unreachable, MODELS.md
   Basis). Executors honor a legacy tag as a pin on that model; migrate them with
   the recipe below.

## Grooming procedure (itr)

```bash
# score during grooming, then tag:
itr update <id> --add-tag complexity:C2 --add-tag route:builder

# pull a role's lane at execution time:
itr list --tag route:builder                   # Sonnet-delegable queue (builder today)
itr list --tag route:floor                     # floor lane
itr list --tag-any route:generalist --tag-any route:bulk --tag-any route:ambiguous --tag-any route:frontier
                                               # every role MODELS.md binds to a GPT model (the Codex lane today)

# one-time migration of legacy model tags (groomed before 2026-10-24) to role tags.
# `itr bulk update` cannot remove a tag, so loop over `itr list` (repeated --tag is AND):
retag() { for id in $(itr list --tag "$1" ${3:+--tag "$3"} -f oneline --fields id); do
            itr update "$id" --remove-tag "$1" --add-tag "$2" >/dev/null; done; }
retag route:gpt-6.1-sol route:ambiguous complexity:C3   # C3s first: Sol was both C1 and C3
for m in gpt-6.1-sol gpt-5.6-sol gpt-5.5; do retag route:$m route:generalist; done
retag route:haiku-5.5   route:floor
retag route:sonnet-5.5  route:builder
retag route:sonnet-5    route:builder
retag route:gpt-6-astra route:frontier
retag route:opus-5.5    route:taste

# C4 decomposition: file children, wire deps, keep the epic as the C4 shell
itr add "child slice" --parent <epic> --tag complexity:C1 --tag route:generalist
```

Tag `route:` values name MODELS.md **roles**, so a model swap is the one-line
MODELS.md binding edit and no retag. The executor resolves the role to a model and
effort when it spawns the seat.

## Observed deltas vs MODELS.md scores (guidance, not edits)

- **haiku-5.5's Intelligence=8 is an operator rating for one-off, gated work**, not a
  claim that it matches Sol on hard problems: its Terminal-Bench 4.0 (39.2%) and
  SWE-Bench Pro (64.8%) sit well below sonnet-5.5 (70.6% / 81.3%). Keep it inside the
  floor guard.
- **gpt-5.6-luna's Intelligence=8 overstates its novel reasoning** (ARC ≤59.5%).
  Treat luna (and gpt-6-luna, scored the same until measured) as a floor seat, never as a reasoning rung.

## Operational copy

`claude/skills/groom/SKILL.md` (the `/groom` skill) inlines this rubric —
installed skills run inside target projects and can't reference this repo by
path. **When refreshing benchmarks or changing tiers/overrides here, update the
skill's inlined tables in the same change.**

## Benchmark snapshots (refresh me)

### 2026-07-11 — FrontierSWE, SWE-Marathon, ARC-AGI-2, Vibe Code

| Model | FrontierSWE (dominance) | SWE-Marathon (pass@1) | ARC-AGI-2 (best, $/task) | Vibe Code (score, $/test) |
|---|---|---|---|---|
| fable-5 | 90% (#1) | ~29.9% (partial) | — | 90.4%, $12.51 (#1) |
| opus-4.8 | 75% (#2) | 26.0% (#1 full) | 72.1%, $2.74 | 82.7%, $5.09 (#2) |
| sonnet-5 | — | — | — | 81.3%, $38.08 (#3) |
| gpt-5.6-sol | — | — | 92.5%, $1.44 (#1) | 80.5%, $33.40 (#4) |
| gpt-5.6-terra | — | — | 83.9%, $1.09 | 67.8%, $10.82 |
| gpt-5.6-luna | — | — | 59.5%, $0.67 | 77.1%, $3.63 |
| gpt-5.5 | 73% (#4) | 12.0% | 85.0%, $1.87 | 69.9%, $16.66 |
| haiku-4.5 | — | — | 4.0%, $0.38 | 11.4%, $1.31 |

(Absence is absence of data, not a zero score. fable-5, opus-4.8, sonnet-5 and
haiku-4.5 are predecessors kept as real measured data; don't relabel them as their
successors.)

### 2026-10-23 — new generation (vendor-reported unless noted)

| Model | Terminal-Bench 4.0 | SWE-Bench Pro | Other |
|---|---|---|---|
| sonnet-5.5 | 70.6% | 81.3% | CursorBench 4.0 55.5% (third-party) |
| haiku-5.5 | 39.2% (AA harness: 33%) | 64.8% | SWE-bench Multilingual 83.7% |
| haiku-4.5 | 0.0% | — | — |
| gpt-5.6-sol | — | ~64.6% (third-party) | AA Intelligence 59, Coding Agent 80 |
| gpt-5.6-terra | — | ~63.4% (third-party) | AA Intelligence 55, Coding Agent 77 |
| gpt-5.6-luna | — | — | AA Intelligence 51, Coding Agent 75; CursorBench 4.0 35.9% (third-party) |
| gpt-6-astra | 57.9% (single third-party source) | — | — |

Sources: Anthropic launch coverage of Haiku 5.5 and Sonnet 5.5 (computingforgeeks,
DataCamp, Vellum), Artificial Analysis "GPT-5.6 has landed", BenchLM comparisons.
Several are aggregators with differing harnesses; treat third-party cells as
directional. opus-5.5, fable-5.1, gpt-6.1-sol and gpt-6-luna are still unmeasured here.
