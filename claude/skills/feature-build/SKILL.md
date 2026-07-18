---
name: feature-build
description: "Coached workflow to build one feature end-to-end — Understand → Plan (with file touch-list) → Implement → Verify — with optional `--strict` graded-review iteration until A-grade. More than a task, less than a sprint: no epic, goal, or ceremony. Trigger: `/feature-build`, \"build this feature\", \"implement X end-to-end with tests\". NOT for a sprint's worth of stories (use /sprint) or an existing backlog (use /blitz)."
---

# feature-build

The coached, **non-sprint** implementation workflow. Reach for it when the work is more than a one-off task but doesn't warrant a sprint's ceremony (goal, epic, Definition of Done, review). It's interactive — surface the plan before writing code.

| invocation | effect |
|---|---|
| `/feature-build <request \| spec path>` | run the four phases on a request or a `spec-writer` doc |
| `--strict` | add the discover-standards → graded-review → iterate loop |
| `--blitz` | after planning, file the tasks as `itr` issues and hand execution to `/blitz` |

## Where it sits

- one task → just do it (file it with `itr` if you want a record)
- **one feature → small set → `feature-build` (this)**
- mid-size & parallelizable → `feature-build --blitz` (plans, then `/blitz` executes the waves)
- a sprint's worth → `/sprint` → `/blitz` → `/sprint-review`
- autonomous & large → `/overdrive` or `/proof-campaign`

## Phases

**Announce: Phase 0 — Understand.** Read the request (or the `spec-writer` doc). Map the codebase with `kgr` (fall back to grep): where does this slot in, what does it touch, what patterns already exist? Restate the intent and detect the verify gate the way `/blitz` does (Cargo / npm / pytest / go / Make / …).

**Announce: Phase 1 — Plan.** Produce an implementation plan + an **explicit owned-file list** + ordered tasks. For anything non-trivial, do it in two passes: high-level parent tasks → confirm with the user → expand into sub-tasks. **Surface the plan and wait** — this is the coached gate. If the work splits into independent, parallelizable pieces and is mid-size, offer `--blitz`: file the tasks as `itr` issues with declared file ownership and hand off to `/blitz`.

**Announce: Phase 2 — Implement.** Make minimal, targeted changes that follow the discovered patterns; preserve existing behavior unless the change requires otherwise. Work the task list in dependency order.

**Announce: Phase 3 — Verify.** Run the verify gate (tests/lint/build). Fix until green. Report what ran and what passed — don't claim done on an unrun gate.

### `--strict` mode

Wrap Phases 1–3 in a quality loop (condensed from the strict-feat workflow):

1. **Discover patterns** — frameworks, conventions, test setup, lint config from the actual repo.
2. **Generate standards** — a short project-specific standards list grounded in what you found (not ideals).
3. **Implement** against those standards.
4. **Graded review** — score the change A–F. Severity weighting: Critical −2 grades, High −1, Medium −½, Low −⅓ per 3. Output issues with location + exact fix.
5. **Iterate** Steps 3–4 until **≥ A-**. Cap at 5 rounds, then escalate to the user. Prefer minimal fixes over rewrites.

## Principles

- **Understand before coding** — never assume the stack or the patterns.
- **Coached, not autonomous** — the plan is approved before implementation; that's the line vs `/overdrive`.
- **Minimal diff, matched patterns** — new code should look like it was always there.
- **Verified or it isn't done** — green gate before you call it complete.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. Once the Phase 3 gate is green, commit the work.

## Don't

- Don't sprint-ify — no epics, sprint goals, DoD, or `/sprint-review`. That's `/sprint`'s job; use it when the work is that big.
- Don't create bespoke scaffolding directories.
- Don't over-engineer a small feature into a framework.
