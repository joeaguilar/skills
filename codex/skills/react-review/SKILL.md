---
name: react-review
description: "Use to review React, TypeScript, or Next.js code for concrete correctness and runtime issues using the project's actual framework and compiler configuration. Do not impose a new stack or style system."
---

# React Review

Read the relevant package versions, build/compiler configuration, routing model,
lint rules, and local conventions before assessing the change. React Compiler
must be configured; do not assume it is active from the React version alone.
Consult [compiler installation](https://react.dev/learn/react-compiler/installation)
when that distinction affects a finding.

Trace the affected user flow. Prioritize:

- conditional hooks, stale closures, missing effect cleanup, races, and updates
  after the owning interaction has changed;
- unstable identity that loses state, incorrect keys, controlled/uncontrolled
  transitions, and state derived from outdated props;
- server/client boundaries, serialization, hydration, auth and cache scope in
  the project's actual framework; do not prescribe Server Actions for all reads;
- loading, empty, error, cancellation, and keyboard/focus behavior in changed UI;
- type escapes or null assumptions that hide a reachable failure;
- measured render/network costs and demonstrated dependency identity requirements.

Do not add or remove memoization mechanically. Check compiler coverage and the
reason identity matters. Prefer the existing state/data-fetching architecture
unless a concrete defect requires change. Coverage percentages, line limits,
hook extraction, naming, and import order follow project standards rather than
universal quotas in this skill.

Report actionable findings with file/line, failing scenario, consequence, and
minimal fix. Separate optional style suggestions from defects. Run relevant
tests or reproduce the interaction when practical; do not invent failures or
equate a green typecheck with correct runtime behavior. No edits unless requested.
