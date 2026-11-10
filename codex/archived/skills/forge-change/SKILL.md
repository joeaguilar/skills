---
name: forge-change
description: "Use only when the user explicitly invokes $forge-change or clearly asks Codex to take one bounded change in unfamiliar or coupled code through read-only reconnaissance, implementation, verification, adversarial code review, repair, re-verification, and one repository-compliant local commit. Do not use for research-only or review-only work, a routine known-file edit, a multi-ticket sprint/backlog, or any request that does not authorize a commit."
---

# Forge Change

Take one unfamiliar change from terrain map to one hardened local commit. Compose
the reconnaissance discipline of `scout-strike` with the adversarial verdict
discipline of `shadow-duel`, then own the repair, verification, and commit seam.

Before acting, read `../scout-strike/SKILL.md` and
`../shadow-duel/SKILL.md` completely. Their scout, challenger, and judging
contracts apply. This wrapper overrides their no-commit boundary only for the
orchestrator's final gate; scouts, strikers, challengers, and repair workers
never commit.

## Invocation contract

```text
$forge-change <task> [--scouts=N] [--challengers=N] [--confirm]
```

- Default to 3 scouts; clamp to 2–5 and omit filler slices.
- Default to 2 challengers; clamp to 1–3.
- Use `--confirm` for one pause after the terrain map and before writes.
- Treat explicit invocation as authorization for one scoped local commit only.
  Never infer authorization to push, open a PR, release, deploy, or rewrite
  history.

## Workflow

```text
Preflight → Scout read-only → Fuse map → Implement → Verify
          → Duel diff → Repair → Re-verify → Seal one commit
```

## 1. Preflight

1. Restate the task, acceptance bar, non-goals, and evidence required. Route
   multiple independent work items to a sprint/backlog workflow.
2. Read `AGENTS.md`, `CODEX.md`, and scoped repository instructions. Discover
   required test/lint/build gates, tracker rules, generated files, commit
   identity, message format, and attribution trailers.
3. Record `BASELINE_SHA` and `git status --short`. Require a Git repository with
   an existing baseline commit. Never initialize Git, stash, reset, clean,
   switch branches, or rewrite history automatically.
4. Preserve pre-existing work. Stop before writes if any existing changed path
   overlaps the likely strike or disjoint ownership cannot be proven. Otherwise
   record those paths and never edit or stage them.

## 2. Scout read-only

Split the unknown terrain into 2–5 real slices by subsystem, layer, entry point,
or question. Use independent Codex subagents when the slices can run safely in
parallel; otherwise perform separated read-only passes. Scouts may read, search,
trace, and run safe inspection only. They do not edit, create, format, generate,
install, stage, or commit.

Capture terrain with paths/references, strike-relevant facts, hazards, unknowns,
and confidence. A failed scout makes the map thinner; do not manufacture or
retry slices merely to reach the requested count.

## 3. Fuse the map

Produce one reconciled terrain map identifying where the patch belongs, the
conventions it must follow, coupling it may disturb, and tests that should prove
it. Mark unresolved dark spots.

Stop if the map is not usable; never edit blind. With `--confirm`, show the map,
planned file boundary, and verification bar, then wait once.

## 4. Implement from the map

Make the smallest coherent change that clears the bar. Hand the fused map to any
implementation subagent and give multiple workers disjoint file sets. Add or
update tests that prove the behavior. Verify only dark spots the implementation
must rely on; do not restart broad reconnaissance or widen scope for adjacent
work discovered by scouts.

Subagents may edit owned files but never stage or commit. The main Codex agent is
the sole integrator and committer.

## 5. Verify the candidate

Run the narrowest meaningful checks first, then the repository's normal gate
when practical. Use `gatr` when its durable-log contract applies or repository
instructions require it.

Repair in-scope failures before review. If verification exposes unmapped
terrain, return to a focused scout/map pass before editing there. If the required
gate cannot become green within scope, stop without a duel or commit.

## 6. Duel the diff

Set the artifact under test to the scoped working-tree diff plus new files, the
terrain map, and the acceptance bar. Run 1–3 independent, read-only challenge
passes, blind to each other when subagents are used. Useful angles are behavior
and edge cases; integration and regressions; tests, errors, security, and
operations.

Each challenger returns one strongest concrete strike or `no kill`, proof,
severity (`fatal`, `wound`, `scratch`, or `miss`), and confidence. Style taste is
not a strike unless it violates the bar or repository rules.

Judge each strike against the bar. Concrete counterexamples beat confident
reasoning. Discard vague/off-bar attacks. Never downgrade an unanswered fatal
strike to a caveat.

## 7. Repair and re-verify

Repair real fatal/wound strikes narrowly while preserving what works. Fix a
scratch only when its value is clear and the change stays in scope. Rerun narrow
checks and the normal gate after every repair set.

Run at most one additional challenger round when a fatal/wound landed or repair
changed a risky boundary. Stop early after a clean round. Return `BROKEN` and do
not commit when a fatal strike cannot be repaired in scope or verification stays
red.

## 8. Seal one commit

Commit only when:

- the required verification gate is green;
- the verdict is `HOLDS`, or `HOLDS WITH CAVEATS` only when every caveat is an
  explicit non-goal that does not weaken the acceptance bar;
- status contains only recorded pre-existing paths and declared strike-owned
  paths; and
- no fatal or wound remains unresolved.

Then update required tracker/artifact state, stage only explicit strike-owned
paths, inspect the cached stat and diff, and run `git diff --cached --check`.
Ensure no pre-existing user path is staged. Follow repository identity, commit
message, issue-link, and attribution rules. Create exactly one local commit.

Confirm `HEAD` advanced from `BASELINE_SHA`, the index is clean, and pre-existing
user changes remain untouched. If a hook fails or modifies the candidate, stop
and report it; never amend automatically.

## Deliver

Report the terrain facts that shaped the patch, implementation, deepest duel
strike and repair, verification evidence, verdict/caveats, and commit SHA and
subject. Do not push, open a PR, deploy, or claim the verdict is universal proof.

## Guardrails

- Keep one bounded change, one main committer, and one final local commit.
- Keep scouts and challengers read-only; never let subagents commit.
- Keep the strike narrower than the scout map.
- Require green verification before and after repair.
- Preserve user work: no stash, reset, clean, amend, rebase, or force-push.
