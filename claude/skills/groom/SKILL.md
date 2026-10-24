---
name: groom
description: Complexity-score an itr backlog and route each issue to the cheapest capable MODELS.md role (floor / generalist / builder / bulk / ambiguous / frontier / taste) by tagging it `complexity:CN` + `route:<role>`. Trigger when the user types /groom, or asks to "groom the backlog by complexity", "complexity-score the backlog", "which tickets can go to Sonnet/GPT/Opus", "route the backlog to models", "assign models to tickets", or "triage issues by difficulty". Do NOT trigger for filing new issues (use the itr skill), sprint planning/grooming a spec into stories (use /sprint), executing the routed backlog (use /blitz or /crossfire-blitz), or reprioritizing/closing issues.
---

# groom — complexity-score and model-route an itr backlog

Read the open `itr` backlog, score every candidate issue on five complexity
signals, assign a tier (C0–C4), and tag it with `complexity:CN` +
`route:<role>` so execution can pull pre-routed lanes. Tags are the only
write; this skill never executes work, files stories, or changes priority.

The rubric is benchmark-grounded (FrontierSWE, SWE-Marathon, ARC-AGI-2, Vals
Vibe Code Bench — snapshot 2026-07-11; Terminal-Bench 4.0, SWE-Bench Pro and the
Artificial Analysis indices — snapshot 2026-10-23): frontier boards anchor the
difficulty ceiling, ARC anchors novel-reasoning-per-dollar, Vibe Code anchors
spec-complete building and taste. Routes name **roles** from `~/.claude/MODELS.md`
(floor, generalist, bulk, builder, ambiguous, frontier, taste). The executor resolves
each role to a model and effort when it spawns the seat, so a model swap there needs
no retag here.

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
- **Artifacts** — tags on existing issues (`complexity:CN`, `route:<role>`);
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
| **C0 trivial** | 0–1 | `floor` (a floor peer when the seat should be non-Claude) | `complexity:C0`, `route:floor` |
| **C1 routine** | 2–3 | `generalist` | `complexity:C1`, `route:generalist` |
| **C2 standard** | 4–5 | `builder` if spec-complete build work; `bulk` if mechanical-heavy | `complexity:C2`, `route:builder` or `route:bulk` |
| **C3 complex** | 6–7 | `ambiguous`; `frontier` when it must be right the first time or the blast radius is wide | `complexity:C3`, `route:ambiguous` or `route:frontier` |
| **C4 frontier** | 8–10 | recommend decomposition first (the `planner` slices it, gated); the irreducible core goes to `frontier`, with the `planner` reviewing | `complexity:C4`, `route:frontier` |

**Hard overrides (apply after scoring, absolute):**

1. Taste surface = 2 → `route:taste` minimum, whatever the total. Only the
   `taste`, `taste-hero` and `frontier` bindings clear the taste bar (Taste > 7).
2. Floor guard: `floor` takes only short, one-off, gated, Novelty-0, non-risky
   work. Anything else starts at `generalist`.
3. Every route keeps a hard verify gate; an ungated long-horizon run needs a gate
   added before it routes anywhere.
4. `builder` requires a complete spec with written acceptance criteria; if the
   spec is incomplete, the issue is Ambiguity ≥ 1 and C2 routes to `generalist` or
   the score lands C3.
5. Tags name roles, never models. With `--re`, a legacy model tag (groomed before
   2026-10-24) is replaced like any other: `route:haiku-5.5` → `route:floor`;
   `route:sonnet-5.5` / `route:sonnet-5` → `route:builder`; `route:gpt-6.1-sol` /
   `route:gpt-5.6-sol` / `route:gpt-5.5` → `route:generalist` (`route:ambiguous` on a
   C3); `route:gpt-6-astra` → `route:frontier`; `route:opus-5.5` → `route:taste`.

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
   Notes carry bump reasons, missing gates, and sub-route choices (builder vs
   bulk, frontier vs ambiguous).
2. Unless `--dry`, apply tags:
   `itr update <id> --add-tag complexity:CN --add-tag route:<role>`
   (with `--re`, remove the old `complexity:`/`route:` tags first via
   `--remove-tag`). Where a missing verify gate forced a bump, also
   `itr note <id> "groom: no verify gate specified — tier bumped; add a gate to down-tier"`.
3. For each C4, recommend a decomposition sketch (child slices + dependency
   wiring with `--parent` / `itr depend`) in the report. File children only
   if the user says yes — decomposition changes the backlog, tagging doesn't.

### Phase 4 — Summary

`Announce: Phase 4 — Summary.`

Report lane counts per route (`itr list --tag route:<role>` per lane), the
C4s awaiting decomposition, and any issues whose spec needs work before they
can be down-tiered.

## Principles

- **Horizon dominates.** Long-horizon pass rates decay monotonically for every
  model; slicing a big ticket into short-horizon children beats any model
  escalation. Prefer recommending a split over reaching for a bigger model.
- **Score the ticket as written.** A vague ticket scores high on ambiguity —
  that's a signal to fix the spec, and the fix is what down-tiers the work.
- **Bump up when torn.** Cheap-model misses waste a full run plus review.
- **Tags name roles, not models**, so a model swap is one line in
  `~/.claude/MODELS.md` and no retag.
- **Routing priority: intelligence > taste > cost.** Cost breaks ties only.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. Groom's only writes are tracker tags — when those land in a tracked file, commit them; a `--dry` run lands nothing and has nothing to commit.

## Don't

- Don't execute, claim, or close any issue — tagging only.
- Don't file new issues; C4 decomposition happens only on explicit user yes.
- Don't change priority, kind, status, or assignment.
- Don't route user-facing taste work to a role below the taste bar (`floor`,
  `generalist`, `bulk`, `builder`, `ambiguous`).
- Don't write a model name into a `route:` tag, and don't route past the floor
  guard to `floor`.
- Don't re-score already-tagged issues without `--re`.
- Don't ask permission per issue — score, tag, and report once at the end.
