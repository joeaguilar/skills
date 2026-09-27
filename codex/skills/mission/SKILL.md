---
name: mission
description: "Use to take a project brief to a working result by building the smallest runnable core first, then finishing demonstrated gaps. Suitable for greenfield and existing projects; not a planning-only or speculative backlog workflow."
---

# Mission

Make the user's core action work early, then finish the brief. Use this sequence
as a guide, not a requirement to create process artifacts:

`inspect → runnable core → observe → finish demonstrated gaps → verify → report`

## Find and build the core

Read the original brief, repository guidance, manifests, entry points, and worktree
state. Express the core as: “A user can <action> and observe <consequence>.” A
scaffold or test harness is not the core unless that is what the user asked for.

Honor an explicit tracker choice. Otherwise use the established project tracker
when useful; a small local checklist is sufficient when no tracker is configured.
Do not pause solely to choose bookkeeping, initialize an external service, or
create a speculative backlog. Required project/tool skills still apply.

Build the core directly in the current workspace. For greenfield work, choose a
conventional scaffold that fits the brief and establish a runnable entry point.
Ask only about unresolved decisions that materially change that result. Keep
existing user edits intact. Routine recoverable failures call for diagnosis and
a supported correction, not an automatic stop or more planning machinery.

Run the real entry point as soon as it exists. Derive the verify gate from
commands that actually work in the project. Inspect runtime behavior as well as
build/test results. If acceptance explicitly depends on the user's judgment,
show the concrete result and keep that verdict pending until received.

## Finish the brief

Compare the running core with the original requirements. Track concrete missing
behaviors with their acceptance, direct dependencies, affected files, and checks.
Keep speculative architecture and unrelated findings out of the implementation.

Work directly by default. If delegation is authorized and ready pieces have
disjoint write scopes, assign each worker its bounded task and evidence needed.
Inherit the session's model settings unless the user or project specifies a
different model. Workers report outside-scope failures rather than fixing each
other's files. Integrate and verify without waiting on unrelated work.

Review the complete diff against the brief. An independent reviewer is useful
when available, authorized, and justified by complexity; lack of one does not
block a small task. Reproduce material findings, fix confirmed failures, and run
the final qualified checks plus the original core action again. Do not replace
evidence with critic scores or an arbitrary number of review rounds.

## Finish or resume

Report the observable result, checks performed, unfinished requirements, tracker
state when used, and commit state. Follow existing commit policy. Completion
requires the brief and required acceptance to pass, not merely an empty tracker.

`--resume` reconstructs progress from guidance, git state, the tracker/checklist,
and the running artifact; verify the current state before continuing. A status
request gets a brief answer while work continues. A stop/cancel request stops
promptly and preserves current work. Do not create token budgets or durable
goals unless the user explicitly requests them.
