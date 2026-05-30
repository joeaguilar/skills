# Codex Primitive Tree Roadmap

## Product Intent

Build a project primitive explorer that treats Codex skills, agents, slash commands, and future installable roots like an unlockable capability tree. A project starts with foundational primitives, enables them deliberately, and higher-order workflows become available when their capability prerequisites are satisfied.

The explorer should feel like a tactical game interface while remaining honest infrastructure: primitives are still files, enablement is still a manifest, and install/apply steps stay reversible.

## Core Model

- `codex/skills/`, `codex/agents/`, and `codex/commands/` are installable primitive payload directories.
- `codex/registry/skill-tree.yaml` is the human-readable source of primitive dependencies, unlock rules, groups, icon metadata, and capability relationships.
- `codex/registry/skill-tree.json` is the UI/CLI-readable registry.
- `codex/registry/capabilities.yaml` defines shared capability names so dependencies can target capabilities such as `issue-tracker` instead of hard-coding `itr`.
- `.codex/project-primitives.json` is the per-project enabled-state manifest; `.codex/project-skills.json` is read as a legacy fallback.
- `codex/explorer/` is the visual primitive tree UI.
- `codex/scripts/skill-tree.js` is the CLI bridge for listing, enabling, disabling, and writing project manifests.
- The manifest `providers` map records explicit provider choices when multiple enabled primitives provide the same capability.
- Registry entries may expose stale port state with `stale`, `stalePort`, or `portState: "stale"` for UI display.

## Milestones

### M1 - Registry and State

Status: built in this pass.

- Define all current Codex-local primitives in a dependency graph.
- Represent system skills as core utilities.
- Model dependencies by capabilities, not only skill ids.
- Support locked, available, enabled, and hidden/revealed primitive states.
- Validate required capabilities have provider primitives unless marked external.
- Expose provider candidates and selected providers in status output.
- Add a project manifest schema.

### M2 - CLI Bridge

Status: built in this pass.

- Add `codex/scripts/skill-tree.js`.
- Commands:
  - `list`
  - `status`
  - `enable <primitive>`
  - `disable <primitive>`
  - `provider <capability> [<primitive>|auto]`
  - `manifest`
- Validate missing prerequisites before enablement.
- Write `.codex/project-primitives.json` in the selected project root.

### M3 - Visual Explorer

Status: built in this pass.

- Add a self-contained web UI under `codex/explorer/`.
- Render the primitive tree as a game-like node map.
- Click primitive icons to inspect and toggle enabled state.
- Reveal higher-tier primitives as prerequisites are enabled.
- Show provided capabilities and missing prerequisites.
- Show missing-provider and stale-port states.
- Allow provider routing when multiple enabled primitives provide the same capability.
- Detect managed and unmanaged primitive payloads in selected folders across skills, agents, commands, and future primitive roots.
- Render selected `SKILL.md` and markdown primitive payloads in the inspector.
- Persist local UI state with `localStorage`.
- Render a project manifest preview.

### M4 - Installer Integration

Status: next.

- Connect enabled manifest state to materialized project primitive directories.
- Decide whether enabled primitives should be symlinked, copied, or referenced from a resolver.
- Add a dry-run/apply workflow that mirrors `link-codex-skills.sh`.
- Validate that disabled primitives are not accidentally removed from canonical payload roots.

### M5 - Rich Project Awareness

Status: next.

- Detect project files such as `.itr.db`, `package.json`, `Cargo.toml`, `pyproject.toml`, and `STORY_STYLE.md`.
- Recommend root unlocks from actual project context.
- Mark capabilities as satisfied by external tools as well as skills.
- Add import/export for `.codex/project-primitives.json` beyond copy-to-clipboard.

### M6 - Marketplace Polish

Status: later.

- Add first-class icon assets per skill.
- Add animated unlock transitions with reduced-motion support.
- Add registry version migrations.
- Add conflict detection for multiple skills that provide the same exclusive capability.
- Add a "recommended build path" for common workflows such as sprint planning, autonomous backlog clearance, and Codex customization.

## Initial Skill Progression

Foundations:

- `itr` provides `issue-tracker`.
- `kgr` provides `code-graph`.
- `alignment` provides `alignment-interview`.
- `shell-prompt` provides `shell-customization`.

Planning:

- `story-style` unlocks after `itr` and provides `story-conventions`.
- `sprint` unlocks after `itr` and `kgr`, then provides `sprint-planning`.
- `roadmap` unlocks after `story-style` and provides `product-roadmap`.

Execution:

- `blitz` unlocks after `sprint` and provides `backlog-execution`.
- `sprint-review` unlocks after `sprint` and provides `sprint-review`.

Autonomy:

- `overdrive` unlocks after `blitz` and `sprint-review`, then provides `autonomous-orchestration`.

Core utilities:

- `.system/imagegen`, `.system/openai-docs`, `.system/plugin-creator`, `.system/skill-creator`, and `.system/skill-installer` are represented as utility skills.

## Definition of Done

- Registry includes every primitive currently staged under `codex/skills`, `codex/agents`, and `codex/commands`.
- The explorer renders without network dependencies.
- The explorer works on desktop and mobile widths.
- The CLI can create/update a project manifest.
- Validation checks parse registry data and verify referenced skill paths.
- Canonical skill payloads remain separate from enablement state.
