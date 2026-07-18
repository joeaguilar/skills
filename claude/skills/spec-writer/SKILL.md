---
name: spec-writer
description: Turn a feature idea, enhancement request, or greenfield project concept into a clear spec/PRD — context, functional + technical requirements, testable acceptance criteria, a risk table, and an ordered implementation outline — after interviewing for the unknowns. The output feeds /feature-build (build it now), /sprint (groom into an itr backlog), or /roadmap (map it across sprints). Trigger when the user types /spec-writer, or asks to "write a PRD", "spec this out", "turn this idea into requirements", "draft a spec for X", or "what would it take to build Y". Do NOT trigger for implementing/executing (use /feature-build or /blitz), for grooming an existing spec into a sprint backlog (use /sprint), for the cross-sprint map (use /roadmap), or for stress-testing an existing plan (use /alignment).
---

# spec-writer

Shape a rough idea into a spec the rest of the toolchain can consume. `spec-writer` produces the document; it does not implement. When it's done it hands off:

- small, build it now → **`/feature-build`**
- a sprint's worth → **`/sprint`** (grooms the spec into an `itr` backlog)
- spans multiple sprints → **`/roadmap`**

Works for a single feature, an enhancement, or a greenfield project concept (it scales the depth accordingly).

## Phases

**Announce: Phase 0 — Understand.** Read the README and the relevant code (prefer `kgr`, fall back to grep) to ground the spec in reality. Restate the request in your own words and classify it: *feature · enhancement · greenfield project*. Note what exists already that this touches.

**Announce: Phase 1 — Interview.** Ask the questions whose answers change the spec — don't guess. Cover the dimensions that matter for this request: scope & explicit non-goals, target users, data model, integration points, constraints (perf/security/compliance), and tech-stack choices for greenfield. Use `AskUserQuestion` for the big forks. Keep going until the unknowns that would change the design are resolved.

**Announce: Phase 2 — Draft.** Write the spec with these sections:
1. **Problem & goal** — what and why, in plain terms.
2. **Requirements** — functional and technical, each numbered.
3. **Acceptance criteria** — testable conditions (the Definition of Done lives in `/sprint`, not here).
4. **Risks** — table with severity 🔴/🟡/🟢/⚪ and a mitigation per row (security, technical, integration, operational).
5. **Implementation outline** — ordered steps with pointers to the real files/areas they touch.
6. **Open questions / assumptions** — anything still unresolved, flagged explicitly.

**Announce: Phase 3 — Write & hand off.** Save to `docs/specs/{shortname}.md` (kebab-case, ≤30 chars; respect an existing spec location if the project has one). Print the path and recommend the next step (`/feature-build` · `/sprint` · `/roadmap`).

## Principles

- **Interview before assuming.** A clarifying question now beats a wrong spec later.
- **Acceptance criteria must be testable.** "Works well" is not a criterion.
- **Cite real code.** Reference actual files/modules, not hypothetical ones.
- **No estimates or timelines** — sizing belongs to `/roadmap` and `/sprint`.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. Commit the written spec file as part of Phase 3.

## Don't

- Don't implement — that's `/feature-build`.
- Don't invent bespoke scaffolding (`/planning`, `work_summary/`, …). One spec file, clean handoff.
- Don't pad with generic best-practice boilerplate; every line should be specific to this request.
