---
name: feature-build
description: "Use to implement one feature end to end from a request or spec, with grounded file ownership and verification. Fits work larger than a small edit but smaller than a sprint or backlog campaign."
---

# Feature Build

Take one feature through understanding, implementation, and verification. Keep
the process proportional: no mandatory epic, sprint folder, grading rubric, or
tracker initialization.

Read the original request and relevant code. Find the public entry point,
dependencies, project conventions, and existing verification commands. Summarize
the intended behavior and the files likely to change. Include tests, UI wiring,
persistence/read paths, and migrations only where the feature requires them.

For a coached or plan-first request, present the concrete plan and wait for the
requested review. Otherwise proceed within established authorization; do not
ask for approval of the same scope twice. Resolve a material product ambiguity
before its dependent implementation while continuing independent work.

Build in coherent increments that keep the real user path runnable. Preserve
existing edits and patterns. If the file set or feature scope changes, update
the plan and check ownership before writing. Use delegation only when authorized
and independently useful; a feature does not inherently require a swarm.

Run checks appropriate to the changed behavior, then the project's required
gate. Exercise the actual entry point; a data write alone does not prove that a
UI, loader, or consumer reads it. For visual work, inspect the running result
with the tools available. Distinguish unavailable verification from a pass.

Review the final diff against the original request. Fix demonstrated omissions
and regressions, avoiding unrelated cleanup. `--strict` means stronger evidence
and review of material risks, not repeated subjective letter grades. If the user
requests `--blitz`, prepare bounded tasks and use the available backlog executor;
do not create an unrequested tracker merely to satisfy this flag.

Finish with what changed, verification, and any remaining limitation. Follow the
user's and repository's commit policy; this skill adds no automatic release,
deployment, push, or next-feature action.
