---
name: forge-change
description: "Deliver ONE bounded change in unfamiliar or coupled code end to end: read-only reconnaissance, map-guided implementation, verification, adversarial diff review, narrow repair, re-verification, and one repository-compliant local commit. Trigger: `/forge-change`, \"research this, build it, review it, fix it, and commit it\", or \"take this unfamiliar change all the way to a hardened commit\". NOT for research-only work, review-only work, a routine known-file edit, a multi-ticket sprint/backlog, or any request that does not authorize a commit."
---

# /forge-change — map it, make it, break it, temper it, seal it

Take one change from unfamiliar ground to one hardened local commit. Compose the
read-only map discipline of scout-strike with the adversarial verdict discipline
of shadow-duel; keep implementation, repair, verification, and commit ownership
in one bounded run.

This is a composed delivery workflow, not a Dojo blade. Before acting, read
`../scout-strike/SKILL.md` and `../shadow-duel/SKILL.md` completely. Their scout,
challenger, and judging contracts apply. This wrapper overrides their
`never commit` rule only for the orchestrator's final gate; scouts, strikers,
challengers, and proposers never commit.

## Invocation

```text
/forge-change <task> [--scouts=N] [--challengers=N] [--confirm]
```

| Argument | Default | Meaning |
|---|---:|---|
| `<task>` | — | One bounded code, config, test, or documentation change. |
| `--scouts=N` | `3` | Read-only terrain slices; clamp to 2–5 and omit filler slices. |
| `--challengers=N` | `2` | Independent adversarial diff reviews; clamp to 1–3. |
| `--confirm` | off | Pause once after the terrain map and before the first write. |

Explicit invocation authorizes one local commit for the scoped change. It never
authorizes push, pull-request creation, release, deployment, history rewriting,
or touching unrelated work.

## Workflow

```text
Preflight ... frame bar + git baseline + verify gate
Scout ....... read-only slices → one usable terrain map
Write ....... focused map-guided patch + tests
Verify ...... narrow checks → normal repository gate
Duel ........ challengers attack the scoped diff; judge every strike
Temper ...... repair real wounds → verify → at most one more duel
Seal ........ inspect staged candidate → one compliant local commit
```

## Phase 0 — Preflight

1. Restate the task, acceptance bar, non-goals, and evidence needed to call it
   complete. Reject an unbounded task; use a sprint workflow for multiple
   independent work items.
2. Read repository instructions. Discover the required test/lint/build gate,
   tracker rules, generated-file rules, commit identity, message format, and
   attribution trailers.
3. Record `BASELINE_SHA` and `git status --short`. Require a Git repository with
   an existing baseline commit. Never initialize Git, stash, reset, clean,
   switch branches, or rewrite history automatically.
4. Preserve pre-existing work. If an existing changed path overlaps the likely
   strike or ownership cannot be proven disjoint, stop before writes. Otherwise
   record those paths and never edit or stage them.
5. Resolve scout/challenger counts. With `--confirm`, pause only after Phase 2.

## Phase 1 — Scout read-only

Split the unknown terrain into 2–5 real slices by subsystem, layer, entry point,
or question. Run scouts concurrently when agents are available; otherwise make
separate read-only passes. Scouts may read, search, trace, and run safe inspection
only. They do not edit, create, format, generate, install, or commit.

Capture from each scout: terrain with paths and references, strike-relevant
facts, hazards, unresolved unknowns, and confidence. A failed scout makes the
map thinner; do not retry merely to fill a quota.

## Phase 2 — Fuse the map

Fuse all scout reports into one terrain map. Reconcile conflicts and name dark
spots. The map must identify where the patch belongs, the conventions it must
follow, the coupling it may disturb, and the tests that should prove it.

No usable map means stop with the fog; never write blind. If `--confirm` is set,
show the map, planned file boundary, and verification bar, then wait once.

## Phase 3 — Write from the map

Implement the smallest coherent change that clears the bar. Hand the fused map
to any striker and assign disjoint files. Add or update tests that prove the
behavior. Verify only dark spots that the implementation must rely on; do not
restart broad reconnaissance or widen scope because the map exposed tempting
adjacent work.

Agents may edit their owned files but never stage or commit. The orchestrator
owns integration and all Git state changes.

## Phase 4 — Verify the candidate

Run the narrowest meaningful checks first, then the repository's normal gate
when practical. Use the mandated durable gate runner when repository or user
instructions require one.

If a failure is inside mapped scope, repair it before review. If it exposes new
terrain, return to a focused scout/map pass before editing there. If the required
gate cannot become green within scope, stop: no duel and no commit.

## Phase 5 — Duel the diff

Set the artifact under test to the scoped working-tree diff plus new files, the
terrain map, and the acceptance bar. Run 1–3 independent challengers, blind to
each other, read-only. Give each one attack angle when useful: behavior and edge
cases; integration and regressions; tests, errors, security, and operations.

Each challenger returns one strongest concrete strike or `no kill`, with proof,
severity (`fatal`, `wound`, `scratch`, or `miss`), and confidence. Style taste is
not a strike unless it violates the bar or repository rules.

Judge every strike against the bar. Concrete counterexamples beat confident
reasoning. Discard vague and off-bar attacks; never launder an unanswered fatal
strike into a caveat.

## Phase 6 — Temper the patch

Repair each real fatal or wound narrowly while preserving what already works.
Fix scratches only when the value is clear and the change stays in scope. After
any repair, rerun the narrow checks and normal gate.

Run at most one additional challenger round when a fatal/wound landed or the
repair changed a risky boundary. Stop early when a full round lands no meaningful
strike. Stop as `BROKEN` when a fatal strike cannot be repaired within scope or
when the verification gate remains red. A broken patch never reaches commit.

## Phase 7 — Seal one commit

Commit only when all conditions hold:

- the required verification gate is green;
- the verdict is `HOLDS`, or `HOLDS WITH CAVEATS` only when every caveat is an
  explicit non-goal that does not weaken the acceptance bar;
- `git status --short` contains only recorded pre-existing paths and declared
  strike-owned paths; and
- no unresolved fatal or wound remains.

Then:

1. Update required tracker/artifact state.
2. Stage only explicit strike-owned paths; never use broad staging.
3. Inspect `git diff --cached --stat`, `git diff --cached`, and
   `git diff --cached --check`. Ensure no pre-existing user path is staged.
4. Follow repository identity, Conventional Commit, subject-length, issue-link,
   and attribution-trailer rules. The orchestrator creates exactly one local
   commit.
5. Confirm `HEAD` advanced from `BASELINE_SHA`, the index is clean, and all
   pre-existing user changes remain untouched. If a hook fails or modifies the
   candidate, stop and report it; never amend automatically.

## Deliver

Report the terrain facts that shaped the patch, the implementation, the deepest
duel strike and repair, verification evidence, verdict and remaining caveats,
and commit SHA/subject. Do not push, open a PR, deploy, or claim universal proof.

## Guardrails

- One bounded change, one orchestrator, one final local commit.
- Scouts and challengers are always read-only; worker agents never commit.
- The strike stays narrower than the scout map.
- Verification must be green before and after repairs.
- A verdict is evidence bounded by the attacks run, not proof for all time.
- User work is preserved; no stash, reset, clean, amend, rebase, or force-push.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes.
