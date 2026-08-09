# COMPLEXITY.md — issue-complexity rubric & model routing for grooming

Companion to [`MODELS.md`](MODELS.md). MODELS.md owns the scores and role→model
bindings; **this file owns the grooming-time question: "which model class should
take this ticket?"** Apply it while grooming an `itr` backlog (during `/sprint`,
`/roadmap`, or ad-hoc triage), record the verdict as tags, and the execution
skills (`/blitz`, `/crossfire-blitz`, `/ninja-meiyaku`) inherit a pre-routed backlog.

**Evidence base** (fetched 2026-07-11 — see snapshot at bottom for refresh):

| Benchmark | What it stresses | Headline |
|---|---|---|
| [FrontierSWE](https://www.frontierswe.com/) | frontier-hard SWE tasks (build/reimplement/optimize) | Fable 5 #1 (90% dominance), Opus 4.8 #2, GPT-5.5 #4 |
| [SWE-Marathon](https://www.swe-marathon.org/) | ultra-long-horizon (2–10h wall-clock, ~27M tokens/run) | Opus 4.8 26% pass@1 (best full run); everything decays with run length |
| [ARC-AGI-2](https://arcprize.org/leaderboard) | novel abstract reasoning, cost-per-task efficiency | GPT-5.6 Sol 92.5% @ $1.44/task; best Anthropic (Opus 4.8) ~72% |
| [Vibe Code Bench](https://www.vals.ai/benchmarks/vibe-code) | build full apps from spec, UI-tested end-to-end | Anthropic sweeps top spots: Fable 90.4%, Opus 4.8 82.7%, Sonnet 5 81.3% |

The four boards disagree on purpose — each one anchors a different rubric axis:
FrontierSWE/SWE-Marathon → **horizon & difficulty ceiling**, ARC → **novel
reasoning per dollar**, Vibe Code → **spec-complete building & taste**.

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

| Tier | Score | Route | MODELS.md role | itr tags |
|---|---|---|---|---|
| **C0 — trivial** | 0–1 | gpt-5.5 (`codex exec`) | floor | `complexity:C0`, `route:gpt-5.5` |
| **C1 — routine** | 2–3 | gpt-5.5 (the agents default; terra/luna for pattern-following batches) | bulk | `complexity:C1`, `route:gpt-5.5` |
| **C2 — standard** | 4–5 | **sonnet-5** if spec-complete build work; gpt-5.5 if mechanical-heavy | — / bulk | `complexity:C2`, `route:sonnet-5` |
| **C3 — complex** | 6–7 | **gpt-5.6-sol** if novelty-dominant; **gpt-5.5** if ambiguity/blast-radius-dominant (the `ambiguous` role) | — / ambiguous | `complexity:C3`, `route:gpt-5.6-sol` |
| **C4 — frontier** | 8–10 | **fable-5** (gated: `fable=on` / `--fable`) — but try to slice first | taste-hero | `complexity:C4`, `route:fable-5` |

### C0 — trivial / mechanical → gpt-5.5

Renames, config bumps, doc/comment fixes, dependency bumps, mechanical
migrations — anything where a green gate fully defines "done."
**Constraint: short runs, hard gates, no autonomy.** GPT-5.5 places a
respectable #4 on FrontierSWE, but on SWE-Marathon it has the *highest
reward-hacking share* of any model (documented hacks: wrapping `gcc`,
`dlopen`-ing prebuilt libs to fake a port). It is safe exactly when the run is
too short and too gated to cheat.

### C1 — routine → gpt-5.5

Small well-specified features and bugfixes with an in-repo pattern to follow.
gpt-5.5 is the agents default (operator decree 2026-07-26: knowledge 8 — "much
smarter and much more capable"), and the snapshot below supports it:
FrontierSWE 73% (#4) and ARC-AGI-2 85.0% @ $1.87 — above terra on both boards
at the cheapest non-haiku price. Terra is the first escalation rung and the
pattern-following batch alternative (83.9% @ $1.09 at max effort, mid-board
67.8% on Vibe Code). Luna is a legitimate cheaper substitute for batches
(77.1% Vibe Code @ $3.63/test), **but only for pattern-following work**:
Luna's novel-reasoning scores are weak (ARC ≤59.5%, below gpt-5.5), so never
hand it a C1 that secretly scores Novelty=2.

### C2 — standard, spec-complete → sonnet-5 (the "delegate to Sonnet" tier)

This tier answers "what can Sonnet take?": **multi-file build work with a
complete spec, written acceptance criteria, contained blast radius, no novel
algorithm, and at most developer-facing taste.** Vibe Code is the evidence:
Sonnet 5 places #3 at 81.3% — above *every* GPT model — on end-to-end
build-the-app-from-spec tasks. It appears on none of the frontier boards, which
is the other half of the signal: it builds what's specified; it doesn't invent.
Operationally it's also the cheapest route that stays native in the Claude
harness (`model: 'sonnet'` in Agent/Workflow — no Codex wrapper).

If the C2 is mechanical-heavy rather than build-shaped (large migration, codemod
sweep), gpt-5.5 remains the better per-dollar route.

### C3 — complex → fork on the dominant signal

- **Novelty-dominant** (algorithm design, perf optimization, puzzle-shaped
  debugging): **gpt-5.6-sol at high reasoning effort**. ARC-AGI-2 leader —
  92.5% @ $1.44/task, ~7–10× cheaper than the Pro/Deep-Think tier for the same
  or better score. This is the "requires GPT" tier: novel reasoning per dollar
  is where the GPT-5.6 line is untouchable.
- **Ambiguity- or blast-radius-dominant** (judgment across a coupled codebase,
  underspecified requirements, risky refactor): **gpt-5.5** (the `ambiguous`
  role). This routed to opus-5 until 2026-07-26; the operator decree sets
  Opus 5 at knowledge 7 — the same level as Opus 4.8 — and records that it is
  not effective at judging its own work, while the benchmark snapshot below
  never measured opus-5 at all (the old citations were 4.7/4.8-era numbers).
  opus-5 still takes the work when the taste override below forces it.
- **Taste=2 always forces opus-5 minimum** regardless of the other signals
  (MODELS.md taste bar: > 7 — no GPT model or sonnet-5 clears it).

### C4 — frontier → fable-5, but slice first

Multi-hour autonomous builds, hardest debugging, hero taste surfaces. Fable 5
is #1 everywhere it appears: FrontierSWE (90% dominance, with a large gap to
#2), Vibe Code (90.4%), SWE-Marathon (~29.9% preliminary). But even Fable
passes under a third of true long-horizon tasks — so the groomer's first move
on a C4 is **decompose it into C1–C2 children with dependencies
(`itr depend`)**, and only route the irreducible core to Fable. Fable stays
gated per MODELS.md (`fable=on` / `--fable`).

## Hard overrides (apply after scoring)

1. **Taste-critical → opus-5 or fable-5, always** — Vibe Code's UI-tested
   board has Anthropic in the top four spots; the MODELS.md taste bar stands.
2. **Never haiku-4.5, any tier** — 4.0% ARC-AGI-2, 11.4% Vibe Code. Confirmed.
3. **gpt-5.5 requires a hard verify gate, always** — highest reward-hacking
   share on SWE-Marathon. It is the agents default (knowledge 8) and routes
   freely, but never hand it an ungated long-horizon run: add the gate first
   or route elsewhere.
4. **Claude routes get cross-model review** — Claude models show zero reward
   hacking but the highest poor-self-verification share (~20% for Opus 4.7 on
   SWE-Marathon). Pair Claude execution with a non-Claude reviewer (the
   `crossfire` pattern) before close. Confirmed by operator decree 2026-07-26:
   **Opus 5 is not effective at judging its own work** — Opus never reviews
   its own output; the review/`ambiguous` role is bound to gpt-5.5.
5. **Escalation ladder** (MODELS.md): a miss escalates
   `gpt-5.5 → gpt-5.6-terra → gpt-5.6-sol → fable-5 (gated)` without asking.
   A sonnet-5 miss enters the ladder at its head. On escalation, re-tag:
   `--remove-tag route:X --add-tag route:Y --add-tag escalated:from-X`.

## Grooming procedure (itr)

```bash
# score during grooming, then tag:
itr update <id> --add-tag complexity:C2 --add-tag route:sonnet-5

# pull a model's lane at execution time:
itr list --tag route:sonnet-5                # Sonnet-delegable queue
itr list --tag-any route:gpt-5.6-terra --tag-any route:gpt-5.5   # Codex lane

# bulk re-route after a benchmark refresh or model swap:
itr bulk --tag route:old-model update --add-tag route:new-model --remove-tag route:old-model

# C4 decomposition: file children, wire deps, keep the epic as the C4 shell
itr add "child slice" --parent <epic> --tag complexity:C1 --tag route:gpt-5.6-terra
```

Tag `route:` values use MODELS.md model names verbatim so a model swap is a
`bulk` retag plus the one-line MODELS.md binding edit.

## Observed deltas vs MODELS.md scores (guidance, not edits)

- **sonnet-5 punches above its Intelligence=5 on spec-complete builds** (Vibe
  Code #3, above all GPTs). The score is right for *ambiguous* work — keep
  routing that away — but don't let it scare you off C2 delegation.
- **gpt-5.6-luna's Intelligence=8 overstates its novel reasoning** (ARC ≤59.5%,
  below gpt-5.5). Treat luna as cheap bulk, never as a reasoning rung.

## Operational copy

`claude/skills/groom/SKILL.md` (the `/groom` skill) inlines this rubric —
installed skills run inside target projects and can't reference this repo by
path. **When refreshing benchmarks or changing tiers/overrides here, update the
skill's inlined tables in the same change.**

## Benchmark snapshot (refresh me)

Fetched **2026-07-11**. Key rows only; when these move, re-pull the four sites,
update this table and any tier reasoning that no longer holds.

| Model | FrontierSWE (dominance) | SWE-Marathon (pass@1) | ARC-AGI-2 (best, $/task) | Vibe Code (score, $/test) |
|---|---|---|---|---|
| fable-5 | 90% (#1) | ~29.9% (partial) | — | 90.4%, $12.51 (#1) |
| opus-4.8 | 75% (#2) | 26.0% (#1 full) | 72.1%, $2.74 | 82.7%, $5.09 (#2) |
| opus-5 | — | — | — | — |
| sonnet-5 | — | — | — | 81.3%, $38.08 (#3) |
| gpt-5.6-sol | — | — | 92.5%, $1.44 (#1) | 80.5%, $33.40 (#4) |
| gpt-5.6-terra | — | — | 83.9%, $1.09 | 67.8%, $10.82 |
| gpt-5.6-luna | — | — | 59.5%, $0.67 | 77.1%, $3.63 |
| gpt-5.5 | 73% (#4) | 12.0% | 85.0%, $1.87 | 69.9%, $16.66 |
| haiku-4.5 | — | — | 4.0%, $0.38 | 11.4%, $1.31 |

(FrontierSWE and SWE-Marathon don't list the GPT-5.6 line or sonnet-5 yet;
absence is absence of data, not a zero score.)

**opus-5 is unmeasured here — that row is empty on purpose.** The taste override
above still routes to opus-5, but this snapshot predates it (fetched 2026-07-11; opus-5 adopted
2026-07-25). The **opus-4.8 row is kept deliberately**: it is real measured data,
and it is the closest available proxy for the Opus rung until these are re-pulled.
Do not relabel it as opus-5 — that would invent benchmark numbers. Fill the opus-5
row on the next refresh.
