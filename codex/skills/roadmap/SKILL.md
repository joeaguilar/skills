---
name: roadmap
description: "Use to create or revise a cross-feature roadmap when release boundaries, priorities, or dependencies need decisions. Skip routine status reports, single-feature planning, and execution."
---

# Roadmap

Maintain a concise product map: outcomes, evidence, priorities, dependencies,
and release boundaries. Read the original brief, existing roadmap, tracker,
and implementation evidence relevant to changed rows.

Preserve the project's format and manually authored content. Missing tickets
mean missing tracking evidence, not an unimplemented feature; closed tickets
alone do not prove the feature works. Mark uncertainty explicitly.

For a new map, use a small table of outcome, state/evidence, next dependency or
decision, and release scope. Add sizing only when it changes a decision. Do not
require every row to have estimates, a sprint assignment, or tracker stubs.

On updates, reconcile affected rows only. Batch straightforward evidence-backed
updates; ask about disputed scope, release tradeoffs, or contradictory evidence.
Do not repeat a per-cell interview for settled facts. Preserve legacy
`<!-- po:override -->` and manually owned cells; refresh `<!-- auto -->` cells
only with current evidence and within requested scope.

Write the requested roadmap, normally `docs/ROADMAP.md`. Create tracker issues
only when requested or required by established project process; use `itr` and
check duplicates. Updating the roadmap does not authorize implementation.

Report material scope/priority changes, evidence gaps, and the next product
decision. For a status-only question use `whats-next` instead.
