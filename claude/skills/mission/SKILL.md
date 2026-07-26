---
name: mission
description: "Lean, self-contained delivery for greenfield or existing projects: select a project tracker, build the smallest runnable end-to-end slice before decomposing more work, finish concrete remaining issues, verify the real user path, review the whole diff once, and commit the kept result. Trigger: `/mission`, \"run a mission\", \"build this as a mission\", \"take this from brief to working\", or \"form and execute a dependency chain\"."
---

# /mission — working software first

Turn a brief into a working, verified result. Greenfield is normal: create the
scaffold, establish a real gate, and ship the core path before expanding it.

Mission is self-contained. Never invoke, recommend, compare with, or rely on
another skill or slash command. Shell tools, Git, project issue trackers,
isolated agents, and an already-available independent model CLI are tools, not
workflow dependencies.

## Invocation

```text
/mission [brief] [--tracker auto|local|itr|beads|github]
         [--verify "command"] [--resume]
```

No token or dollar budget exists inside this skill: the model cannot meter or
enforce one. Obey an external hard limit when the caller provides it, but never
invent budget arithmetic, burn thresholds, or funding decisions.

## Non-negotiable shape

```text
inspect → choose tracker → one issue → WRITE THE CORE SLICE
        → run + observe → file only proven remaining gaps
        → finish → whole-diff review → run + observe → commit → report
```

Before the first production-code line, do only:

1. read the brief and relevant repository guidance;
2. inspect the worktree, manifests, entry points, and tracker markers;
3. select the tracker;
4. record one issue for the core slice.

Do not write a contract, plan tree, premise file, assumptions register, facts
ledger, council brief, digest, debrief, roadmap, or speculative issue backlog.
Do not spawn a planner, red team, reviewer, or research agent before code.

## Tracker selection

Honor `--tracker` when supplied. Otherwise detect existing project state:

| Marker | Tool |
|---|---|
| `.itr.db` and `itr` on PATH | `itr` |
| `.beads/` and `bd` on PATH | `bd` |
| GitHub remote and authenticated `gh` | GitHub Issues |
| existing `MISSION.md` | local |

If exactly one is present, use it. If several or none are present, ask one
concise question: which tracker should Mission use? Offer detected choices plus
`local`. If interaction is unavailable and the brief did not choose, stop
before writing.

Read the selected tracker's `--help` before mutating it. Reuse matching open
work when present. Do not initialize, install, authenticate, or migrate an
external tracker without explicit selection. For `local`, maintain this compact
file:

```md
# Mission: <outcome>
- [ ] M1 Core slice — <observable acceptance>
- [ ] M2 <only after M1 proves this gap exists>
```

Tracker state records work; Git and the runnable artifact prove completion.

## 1 — Inspect and name the core

Inspect narrowly with `rg`, `rg --files`, manifests, entry points, tests, and
repository instructions. Preserve unrelated dirty work. If required files
overlap ambiguous user changes, ask before editing; never stash or discard them.
Initialize Git only for a truly greenfield directory.

Reduce the brief to one sentence:

> A user can `<primary action>` and observe `<primary consequence>`.

That sentence is M1. It must cross the real entry point. A scaffold, spinning
primitive, placeholder page, debug API, counter, or unit test is not the core
slice unless the brief explicitly asks for it.

Examples:

- game: launch it, control the character, perform the signature action, see and
  hear its consequence;
- UI: open it, complete the primary interaction, observe the resulting state;
- CLI: invoke the real command, exercise its primary operation, inspect output;
- service: call the public boundary and observe the returned or persisted result.

Ask about product choices only when different answers materially change M1 and
the brief supplies no safe interpretation. Do not interrogate for preferences
that can be changed after the slice works.

## 2 — Build the core slice directly

The orchestrator implements M1 in the current checkout. Do not delegate it.

For greenfield work:

- choose the lightest conventional scaffold that fits the brief;
- prefer standard-library or already-cached dependencies;
- create only files needed to run, verify, and understand the slice;
- include normal error handling, but do not design extension points for
  hypothetical future work.

As soon as the entry point exists, run it. Establish `--verify` or derive the
gate from commands that now exist in the project. A command becomes a gate only
after it has actually run and its exit semantics judge the stated property.
Build, lint, and unit tests judge those properties only; they do not prove the
user experience.

Exercise M1 end to end through the public path. For visual or experiential work,
capture and inspect the rendered result. When taste is the controlling
criterion and no executable discriminator exists, show the slice to the
operator and require an explicit decision before expanding it; silence is not
approval.

If M1 fails, use the observed failure to make a focused correction. If the
correction is not supported by new evidence or still does not make M1
observable, stop and report the concrete blocker. Do not respond by creating
infrastructure, research, councils, or more issues.

Commit the verified core slice unless the operator forbade commits. Follow the
repository's identity, message, and trailer rules.

## 3 — Finish only demonstrated gaps

After M1 works, compare the running slice with the brief. File only concrete
missing behaviors that can now be demonstrated against it. Each issue needs:

- one user-visible or externally observable result;
- the files it is expected to own;
- its direct blockers, if any;
- an exact verification command where one genuinely judges the result;
- the runtime observation required beyond that command.

An edge requires evidence: an explicit requirement, a compile/runtime
dependency, or a demonstrated RED-before/GREEN-after relationship. Shared
themes, architectural preference, and imagined reuse do not create edges.

Work directly by default. Delegate only when ready issues are genuinely
independent, own disjoint files, and parallel execution clearly saves time.
Never spawn planning agents, council agents, or one reviewer per issue. A lane
agent receives one issue, its owned files, the current runnable slice, and the
qualified checks. It does not commit or broaden scope.

Integrate ready work without waiting on unrelated work. After each integration,
run the qualified checks and exercise the affected public behavior. Close the
tracker issue only after both its artifact and observation exist.

Do not automatically retry an unexplained failure. Reproduce it, correct it
when the evidence identifies a cause, or stop with the failing command and
observation. New findings enter the tracker only when they block the brief or
are confirmed defects in changed behavior.

## 4 — One last look

When the brief appears satisfied, use one fresh independent reviewer over the
whole kept diff. Prefer a different already-available model or provider; do not
install or authenticate one. Give it only:

- the original brief;
- the diff;
- commands already proven to run;
- runtime evidence from the public path.

Ask for concrete mismatches, regressions, or untested claimed behavior.
Reviewer opinion is evidence to investigate, not a gate. Reproduce each
material finding. Fix confirmed failures; record unconfirmed suggestions
without expanding the mission. Do not start a review/rework loop.

Run the full qualified gate once more, then repeat the original M1 action and
every user-visible behavior added after it. For visual work, inspect fresh
captures from the integrated result.

## 5 — Close

Commit the kept diff unless commits were forbidden. Close completed tracker
items and leave unresolved confirmed work open. Do not push, open a PR, begin
another mission, or generate retrospective documents.

Report only:

```text
MISSION COMPLETE|INCOMPLETE
shipped: <user-visible result>
verified: <commands and runtime observations>
review: <confirmed findings fixed; unresolved blockers>
tracker: <closed/open items>
commit: <sha, or "uncommitted by request">
```

`COMPLETE` requires the public path to satisfy the brief, all claimed checks to
pass, and no confirmed blocker to remain. Tracker status alone never proves it.

## Resume and intervention

`--resume` reads repository guidance, Git history/status, the selected tracker,
and the runnable artifact. Re-run the established gate and public smoke before
continuing. Do not reconstruct ceremony or create recovery documents.

Plain operator instructions take effect at the next safe boundary:

- `freeze` — finish the active edit, leave the tree runnable, stop;
- `cancel` — stop, preserve verified work, mark unfinished tracker items;
- `change <statement>` — revise M1 or remaining acceptance before more work;
- `status` — report shipped, verified, active, blocked, next.

## Hard prohibitions

- No references to other skills or slash commands.
- No token estimates, budget ledgers, burn councils, or guessed thresholds.
- No pre-code document production beyond one tracker item.
- No dormant-until-terminal user experience.
- No speculative architecture, issues, dependencies, or abstractions.
- No agent that exists only to plan, deliberate, vote, or restate evidence.
- No per-link reviewer multiplication.
- No success claim based only on tests, builds, counters, tracker state, or
  model judgment.
- No destructive Git, push, PR, or automatic next mission.
