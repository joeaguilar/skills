---
name: groom
description: Complexity-score an itr backlog and route each issue to the cheapest capable model class (haiku-5.5 / gpt-5.6-sol / sonnet-5.5 / gpt-6-astra / opus-5.5 / fable-5.1) by tagging it `complexity:CN` + `route:<model>`. Trigger when the user types /groom, or asks to "groom the backlog by complexity", "complexity-score the backlog", "which tickets can go to Sonnet/GPT/Opus", "route the backlog to models", "assign models to tickets", or "triage issues by difficulty". Do NOT trigger for filing new issues (use the itr skill), sprint planning/grooming a spec into stories (use /sprint), executing the routed backlog (use /blitz or /crossfire-blitz), or reprioritizing/closing issues.
---

# groom — complexity-score and model-route an itr backlog

Read the open `itr` backlog, score every candidate issue on five complexity
signals, assign a tier (C0–C4), and tag it with `complexity:CN` +
`route:<model>` so execution can pull pre-routed lanes. Tags are the only
write; this skill never executes work, files stories, or changes priority.

The rubric is benchmark-grounded (FrontierSWE, SWE-Marathon, ARC-AGI-2, Vals
Vibe Code Bench — snapshot 2026-07-11; Terminal-Bench 4.0, SWE-Bench Pro and the
Artificial Analysis indices — snapshot 2026-10-23): frontier boards anchor the
difficulty ceiling, ARC anchors novel-reasoning-per-dollar, Vibe Code anchors
spec-complete building and taste. Routes follow the 2026-10-23 rules: the Sol
class is the GPT baseline, haiku-5.5 and the GPT-5.6 models share the floor for
one-off small decisions, and gpt-5.5 is unreachable.

## Invocation

| Invocation | Behavior |
|---|---|
| `/groom` | score every open, not-yet-scored issue (no `complexity:` tag) |
| `/groom <id> [<id>…]` | score only the named issues |
| `/groom --re` | re-score issues even if already tagged (replaces tags) |
| `/groom --dry` | print the scored table; write no tags |

## Roles & artifacts

- **Claude** — groomer: scores, routes, tags, reports. Autonomous; borderline
  calls resolve by the bump-up rule, not by asking per issue.
- **User** — Product Owner: reads the grooming table, overrules any row by
  re-running `/groom <id>` with direction or editing tags directly.
- **Artifacts** — tags on existing issues (`complexity:CN`, `route:<model>`);
  the grooming table in chat. Nothing else is created or mutated.

## The rubric

Score each issue **as written** on five signals, 0–2 each:

| Signal | 0 | 1 | 2 |
|---|---|---|---|
| **Horizon** | one sitting, one file | a few files, one session | multi-hour, spans subsystems |
| **Novelty** | in-repo precedent to copy | adapt a known pattern | no precedent: new algorithm, perf work, tricky design |
| **Ambiguity** | acceptance criteria pin it fully | minor judgment calls | requirements need interpretation / tradeoffs |
| **Blast radius** | isolated leaf file | one module + its callers | cross-cutting, coupled, shared API/schema |
| **Taste surface** | invisible plumbing | developer-facing (API names, CLI output, docs) | user-facing UI / copy / hero surface |

**Verifiability modifier:** if no gate can mechanically prove the work (no
test, no verify command, no screenshot check), bump the final tier by one —
or note the missing gate on the issue so it can be specified in.

Sum (0–10) → tier → route:

| Tier | Score | Route | Tags |
|---|---|---|---|
| **C0 trivial** | 0–1 | haiku-5.5 (gpt-5.6-terra or luna when the seat should be non-Claude) | `complexity:C0`, `route:haiku-5.5` |
| **C1 routine** | 2–3 | gpt-5.6-sol at `medium` (the Sol-class baseline) | `complexity:C1`, `route:gpt-5.6-sol` |
| **C2 standard** | 4–5 | sonnet-5.5 if spec-complete build work; gpt-5.6-sol if mechanical-heavy | `complexity:C2`, `route:sonnet-5.5` |
| **C3 complex** | 6–7 | gpt-5.6-sol at `high`/`xhigh` (the `ambiguous` role); gpt-6-astra when it must be right the first time or the blast radius is wide | `complexity:C3`, `route:gpt-5.6-sol` |
| **C4 frontier** | 8–10 | recommend decomposition first (fable-5.1 plans the slicing, gated); the irreducible core goes to gpt-6-astra, with fable-5.1 reviewing | `complexity:C4`, `route:gpt-6-astra` |

**Hard overrides (apply after scoring, absolute):**

1. Taste surface = 2 → opus-5.5 minimum, whatever the total. Only opus-5.5,
   gpt-6-astra and fable-5.1 clear the taste bar; the Sol/terra/luna models,
   haiku-5.5 and sonnet-5.5 do not.
2. Floor guard: haiku-5.5, gpt-5.6-terra and gpt-5.6-luna take only short,
   one-off, gated, Novelty-0, non-risky work. Anything else starts at gpt-5.6-sol.
3. Every route keeps a hard verify gate; an ungated long-horizon run needs a gate
   added before it routes anywhere.
4. Sonnet-5.5 requires a complete spec with written acceptance criteria; if the
   spec is incomplete, the issue is Ambiguity ≥ 1 and C2 routes to gpt-5.6-sol or
   the score lands C3.
5. Never route to gpt-5.5 (unreachable on this Codex login). With `--re`, retag
   any `route:gpt-5.5` issue to `route:gpt-5.6-sol` and any `route:sonnet-5` to
   `route:sonnet-5.5`.

## Phases

### Phase 0 — Inventory

`Announce: Phase 0 — Inventory.`

1. `itr stats` to confirm a database. If none, tell the user and stop — groom
   never runs `itr init` itself.
2. Gather candidates: `itr list --include-blocked -f json --fields id,title,tags`
   (or `itr get <ids> -f json` when IDs were passed). Drop issues already
   carrying a `complexity:` tag unless `--re`.
3. If zero candidates, report that and stop.

### Phase 1 — Score

`Announce: Phase 1 — Score (N issues).`

For each candidate, pull full detail (`itr get <id>`) and score the five
signals. Ground the scores in evidence, effort proportional to stakes:

- **Blast radius** — the issue's `files` list; when unclear and the work is
  non-trivial, check fan-in with `kgr refs <symbol>` / `kgr deps <file>`.
- **Novelty** — a quick search for in-repo precedent; found precedent caps
  Novelty at 1.
- **Ambiguity** — does the acceptance field actually pin the behavior, or
  just gesture at it?

Don't deep-dive obvious C0/C1 issues; spend the investigation on scores near
tier boundaries.

### Phase 2 — Route

`Announce: Phase 2 — Route.`

Apply the tier table, the verifiability modifier, then the hard overrides.
On a boundary or a genuine coin-flip, take the **higher** tier — a failed
cheap run costs more than the routing delta. Note every bump and why.

### Phase 3 — Report & tag

`Announce: Phase 3 — Report & tag.`

1. Print one grooming table: `ID | Title | H N A B T | Mod | Tier | Route | Note`.
   Notes carry bump reasons, missing gates, and sub-route choices (sonnet vs
   gpt-5.6-sol, astra vs gpt-5.6-sol).
2. Unless `--dry`, apply tags:
   `itr update <id> --add-tag complexity:CN --add-tag route:<model>`
   (with `--re`, remove the old `complexity:`/`route:` tags first via
   `--remove-tag`). Where a missing verify gate forced a bump, also
   `itr note <id> "groom: no verify gate specified — tier bumped; add a gate to down-tier"`.
3. For each C4, recommend a decomposition sketch (child slices + dependency
   wiring with `--parent` / `itr depend`) in the report. File children only
   if the user says yes — decomposition changes the backlog, tagging doesn't.

### Phase 4 — Summary

`Announce: Phase 4 — Summary.`

Report lane counts per route (`itr list --tag route:<model>` per lane), the
C4s awaiting decomposition, and any issues whose spec needs work before they
can be down-tiered.

## Principles

- **Horizon dominates.** Long-horizon pass rates decay monotonically for every
  model; slicing a big ticket into short-horizon children beats any model
  escalation. Prefer recommending a split over reaching for a bigger model.
- **Score the ticket as written.** A vague ticket scores high on ambiguity —
  that's a signal to fix the spec, and the fix is what down-tiers the work.
- **Bump up when torn.** Cheap-model misses waste a full run plus review.
- **Tags use exact model names** so a future model swap is one bulk retag:
  `itr bulk --tag route:<old> update --add-tag route:<new> --remove-tag route:<old>`.
- **Routing priority: intelligence > taste > cost.** Cost breaks ties only.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. Groom's only writes are tracker tags — when those land in a tracked file, commit them; a `--dry` run lands nothing and has nothing to commit.

## Don't

- Don't execute, claim, or close any issue — tagging only.
- Don't file new issues; C4 decomposition happens only on explicit user yes.
- Don't change priority, kind, status, or assignment.
- Don't route user-facing taste work to any GPT model except gpt-6-astra, nor to
  sonnet-5.5 or haiku-5.5.
- Don't route anything to gpt-5.5 or past the floor guard to haiku-5.5.
- Don't re-score already-tagged issues without `--re`.
- Don't ask permission per issue — score, tag, and report once at the end.
