# Sprint-1

**Sprint Goal:** Let humans switch the primitive tree UI between Claude and Codex, and between Local and Global, so manifest state, preview paths, provider routing, and markdown source inspection are independent for all four platform/scope combinations.

**Epic:** itr#2
**Created:** 2026-05-30
**Story style:** itr agent-info + AGENTS.md side ownership

## Non-Goals

- Do not materialize symlinks from the UI in this sprint.
- Do not implement `plan-install` / `apply-install` CLI yet.
- Do not add new primitive types beyond the existing registry-driven tabs.

## Definition of Done

- UI exposes a Claude/Codex platform selector beside Local/Global scope.
- Enabled primitive state and provider selections are persisted independently for `claude:local`, `claude:global`, `codex:local`, and `codex:global`.
- Manifest preview uses the selected platform/scope and registry `manifest_paths`.
- Selected primitive path and Markdown Explorer source use the selected platform's payload path when available.
- Existing type tabs for skills, agents, and commands still work.
- Verify gate passes: `./validate-skills.sh && node --check codex/scripts/skill-tree.js && node --check codex/explorer/app.js`.

## Sprint Backlog

| ID | Title | Priority | Risk | Files |
|---|---|---|---|---|
| itr#3 | Add platform selector and independent UI state | high | med | `codex/explorer/index.html`, `codex/explorer/styles.css`, `codex/explorer/app.js` |

## Spillover

- M5 planner CLI.
- M6 apply CLI.
- M7 UI install workflow.
- M8 custom primitive types.

## Open Assumptions

- Browser UI remains read-only with respect to payload materialization in this sprint.
- Global install apply remains CLI-mediated in a later milestone.

## Outcomes

_Pending._

## Demo

_Pending._

## Retro

_Pending._
