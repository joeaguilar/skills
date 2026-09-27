---
name: spec-writer
description: "Use to turn a feature idea or project brief into a grounded spec with testable acceptance criteria and an implementation outline. Do not use to implement an already-defined change or plan a full sprint backlog."
---

# Spec Writer

Produce the smallest spec that resolves the decisions needed to build the ask.
Read the brief, repository guidance, and relevant entry points before drafting.
Reuse requirements and decisions already settled in the conversation.

Ask about unknowns only when the answer changes scope, behavior, or acceptance.
Use the available Codex user-input tool for simple choices; ask directly for
nuanced decisions. Continue independent research while an answer is pending.
Routine reversible implementation choices can be stated as assumptions.

The spec should explain:

- the user problem and intended observable outcome;
- requirements and explicit non-goals;
- acceptance criteria, including relevant failure paths;
- affected interfaces, data, and real repository areas;
- material risks, dependencies, and unresolved decisions;
- a dependency-ordered implementation outline with verification.

Scale depth to the change. Do not invent metrics, estimates, a technology
migration, or future architecture to fill a template. Distinguish evidence from
proposals and mark new files as proposed rather than existing.

Save to the project's spec location, defaulting to `docs/specs/<short-name>.md`,
when asked to write a spec. Use conversation output for a discussion-only ask.
Update an existing requested spec in place instead of producing competing copies.
Finish with the artifact and any decisions still needed. When a next workflow is
useful, suggest an available `$feature-build`, `$sprint`, or `$roadmap` according
to scope; do not launch implementation merely because the spec is finished.
