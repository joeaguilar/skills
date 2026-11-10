---
name: blitz
description: "Use when the user requests parallel execution of an existing backlog with independent write scopes. Skip a single task, tightly coupled work, and planning-only requests."
metadata:
  short-description: Execute independent backlog work in verified waves
---

# Blitz

Run independent backlog work with one coordinator, explicit ownership, and a
verified integrated result. A tracker, sprint folder, or automatic commit is
not a prerequisite. Use the user's existing task source and authorization.

Optional inputs: `tracker`, `verify`, `concurrency`, `max_waves`, `time_budget`,
`repos`, and `--resume`. `--dry-run` produces a plan without writes or workers.
`--commit-waves` explicitly requests coordinator commits after verified waves;
otherwise follow existing commit policy without adding automatic commits.

## Establish executable scope

Read requested tasks and repository instructions. Record Git status and the
starting revision when available. Preserve existing edits, identify other live
writers, and resolve overlapping ownership before dispatch.

Use `scripts/preflight.sh` when a POSIX shell is available to gather facts once.
Confirm its candidate gate against the project's package manager, scripts, and
rules. Without the helper, inspect manifests directly. Missing bookkeeping is
not a blocker. Discover the verification command; ask only when the required
proof cannot be established from the project or request.

For `itr`, read its skill for the shared lifecycle contract. Otherwise use the
existing tracker or supplied task list. Do not initialize a tracker or create
an epic simply to run Blitz.

Map each ready task to acceptance, dependencies, owned files, and a meaningful
worker check. Use `kgr` for structural unknowns. Batch missing ownership research
instead of launching a planner per ticket. Verify paths and identify new files.

Files, directory claims, generated outputs, migrations, manifests, and shared
API contracts count as ownership. Tasks sharing writes run serially. Consumers
start after their required contracts exist. Never break a real dependency to
make a wave fit. If no useful parallel split exists, explain that and execute
the authorized work serially using `mission`.

## Execute and integrate

Show a compact task/ownership plan. Proceed within existing authorization;
ask only for unresolved scope, ownership, or an explicitly reserved decision.
Use the smallest useful concurrency, capped by available worker slots with one
reserved for the coordinator. Read [the worker contract](references/wave-agent-contract.md)
before dispatch. Workers report evidence; the coordinator owns integration,
tracker closure, and authorized commits.

Keep one short run record for multi-wave or resumable work: scope, baseline,
ownership, task state, verification evidence, pending acceptance, next action,
and commit SHAs. Reuse an existing sprint log; otherwise use the project's
work-log location, defaulting to `docs/work/blitz-<timestamp>.md`. Do not duplicate
task bodies or create an extra tracking epic.

Workers run targeted checks. After all writers in a wave finish, inspect the
combined diff and run the required integration gate once per affected repo.
Use `gatr` for substantial gates. Worker checks do not replace integration.
Transient failures from another active writer do not justify blindly retrying
an entire task.

Diagnose failures before retrying. Default to one focused repair per failed task
with a changed hypothesis; use a larger budget only when justified and authorized.
Assign integration repairs to one owner after conflicting writers stop. Hold
failed tasks and dependents with evidence; continue independent work only on a
verified coherent state. Never count held work as done.

Required human acceptance stays pending outside worker/retry scheduling. A UI
change alone does not imply a human gate. Where acceptance explicitly needs the
user, present the working result and evidence and preserve the open status.

## Commit, stop, or resume

For `--commit-waves`, read [commit and recovery rules](references/commits-and-recovery.md).
Otherwise leave changes for the established commit workflow. No mode implies
push, deployment, release, or permission to overwrite unrelated work.

Stop dispatch when the scoped backlog is complete, the requested budget ends,
two waves make no progress, or remaining work depends on a real blocker.
Finish active safe work before stopping and leave a precise continuation record.
Do not create token budgets or durable goals unless explicitly requested.

On resume, reconcile the record with actual Git state, tracker state, and live
ownership before trusting prior results. Recheck evidence invalidated by later
changes. Reuse completed work rather than replaying every phase.

Report delivered behavior, verification, pending/failed tasks and causes,
required acceptance, and commit state. Mark the run record `Blitz complete`
when dispatch ends, including a partial outcome; this does not mean every
requirement passed. Do not automatically start another backlog or sprint.
