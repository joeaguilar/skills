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

| ID | Result | Notes |
|---|---|---|
| itr#3 | Accepted | Added Claude/Codex platform switching, independent platform/scope manifest state, platform-specific manifest labels, and platform-specific Markdown Explorer source loading. |

**Completion:** 1/1 stories accepted, 0 quarantined, 0 carryover.

**Goal achievement:** yes. The primitive tree can now distinguish Claude vs Codex and Local vs Global for the M4 read-only manifest workflow.

## Demo

Serve from the repository root so both `codex/` and `claude/` payloads are reachable:

```bash
python3 -m http.server 8765
```

Open:

```text
http://127.0.0.1:8765/codex/explorer/
```

Smoke covered:

- Initial state shows `Codex` + `Local`.
- Enabling `itr` in `codex:local` does not enable it in `claude:local`.
- `claude:local` manifest path renders `.claude/project-primitives.json`.
- `claude:global` manifest path renders `~/.claude/primitives.json`.
- `codex:global` manifest path renders `~/.codex/primitives.json`.
- Selecting `itr` in Claude mode loads `claude/skills/itr/SKILL.md`.

## Retro

Retro required because the execution arm timed out after producing valid edits.

What worked:

- The scoped sprint kept M4 small enough for one wave.
- The browser smoke test caught the important serving detail: Claude markdown only loads when the explorer is served from the repo root, not from inside `codex/`.
- The verify gate stayed fast and deterministic.

What did not:

- The arm produced valid edits but did not return before timeout, so the orchestrator had to verify, close the issue, and shut it down.

Action items:

- For single-arm UI work, use a shorter monitoring interval and take over after a green verify gate if the arm is stalled.
- Document repo-root serving as the expected smoke path when testing cross-platform markdown loading.
