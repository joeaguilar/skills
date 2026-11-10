---
name: sprint
description: "Use to turn agreed scope into a durable backlog for multiple sessions or contributors, with acceptance and real dependencies. Skip a single finishable feature, execution, and sprint review."
---

# Sprint planning

Produce the smallest durable breakdown that makes handoffs and dependencies
clear. Planning does not start implementation. Reuse settled requirements and
decisions; ask only about ambiguity that changes scope or acceptance.

Read the original request, project instructions, current work, and existing
tracker or plan. Use `kgr` for structural unknowns and direct reads for known
areas. Do not require a roadmap, style wizard, or tracker initialization.

Draft one outcome and necessary non-goals. Split by independently verifiable
behavior, not arbitrary story counts. Each task needs:

- observable results and relevant failure cases;
- known files, including consumers and save/read/restore paths;
- real prerequisites and shared contracts;
- verification and explicitly required human acceptance.

Mark uncertain paths rather than pretending ownership is settled. Include shared
registries, generated outputs, and directory claims. For planned parallel work,
separate conflicting writes or establish the contract first. Do not turn every
UI task into a human-only gate or infer dependencies from weak graph edges alone.

Present the breakdown. Reuse existing approval; wait only for requested review
or unresolved decisions. File approved work through `itr` when established,
following its lifecycle and duplicate checks. Otherwise use the supplied tracker
or a concise plan. Keep speculative work out of scope.

Update an existing sprint artifact rather than creating a competing plan. For
a requested new sprint, use `sprint/sprint-<N>-<date>-<slug>/plan.md` and update
`sprint/CURRENT` only when this is the intended active sprint. Retain outcome,
acceptance, task IDs, dependencies, and verification without duplicating issue
bodies. Legacy sections remain readable; no schema migration is required.

End with the plan, filed IDs, and unresolved decisions. Execution can use
`mission` or, for authorized parallel work, `blitz`. Do not launch execution
merely because planning finished.
