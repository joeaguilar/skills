---
name: code-audit
description: "Use for a whole-codebase maintainability, efficiency, or technical-debt audit with prioritized evidence-backed findings. Do not substitute it for an ordinary diff review or automatically implement its recommendations."
---

# Code Audit

Establish the repository areas and concerns in scope. Map entry points, shared
modules, and build/test boundaries with an available code graph or targeted reads.
Choose areas by risk and coupling, not a requirement to read every file. State
coverage limits rather than claiming an exhaustive audit from a sample.

Investigate concrete duplication, brittle interfaces, unnecessary complexity,
performance bottlenecks, and gaps that let regressions escape. A pattern is not
a defect merely because a different abstraction is possible. Show the affected
path and consequence; measure performance claims or label them as hypotheses.

When parallel review is authorized and useful, assign disjoint read-only areas
with the same finding format. Synthesize systemic issues, deduplicate reports,
and verify material claims in the source before presenting them.

Each finding needs a location, evidence, practical consequence, proposed fix,
and a way to verify improvement. Prioritize by impact and confidence; distinguish
bugs from maintenance proposals. Do not invent percentage gains or LOC targets.

Deliver a concise prioritized report and any useful sequencing dependencies.
Use a requested/project-standard report path when writing an artifact; otherwise
report in conversation. Do not refactor code, file a backlog, or commit a report
merely because the audit found work worth doing.
