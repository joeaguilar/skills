# Codex Skill Tree Roadmap

## Product Intent

Build a project skill explorer that treats Codex skills like an unlockable capability tree. A project starts with foundational skills, enables them deliberately, and higher-order workflows become available when their capability prerequisites are satisfied.

The explorer should feel like a tactical game interface while remaining honest infrastructure: skills are still files, enablement is still a manifest, and install/apply steps stay reversible.

## Core Model

- `codex/skills/` remains the installable skill payload directory.
- `codex/registry/skill-tree.yaml` is the human-readable source of skill dependencies, unlock rules, groups, icon metadata, and capability relationships.
- `codex/registry/skill-tree.json` is the UI/CLI-readable registry.
- `codex/registry/capabilities.yaml` defines shared capability names so dependencies can target capabilities such as `issue-tracker` instead of hard-coding `itr`.
- `.codex/project-skills.json` is the per-project enabled-state manifest.
- `codex/explorer/` is the visual skill tree UI.
- `codex/scripts/skill-tree.js` is the CLI bridge for listing, enabling, disabling, and writing project manifests.

## Milestones

### M1 - Registry and State

Status: built in this pass.

- Define all current Codex-local skills in a dependency graph.
- Represent system skills as core utilities.
- Model dependencies by capabilities, not only skill ids.
- Support locked, available, enabled, and hidden/revealed skill states.
- Add a project manifest schema.

### M2 - CLI Bridge

Status: built in this pass.

- Add `codex/scripts/skill-tree.js`.
- Commands:
  - `list`
  - `status`
  - `enable <skill>`
  - `disable <skill>`
  - `manifest`
- Validate missing prerequisites before enablement.
- Write `.codex/project-skills.json` in the selected project root.

### M3 - Visual Explorer

Status: built in this pass.

- Add a self-contained web UI under `codex/explorer/`.
- Render the skill tree as a game-like node map.
- Click skill icons to inspect and toggle enabled state.
- Reveal higher-tier skills as prerequisites are enabled.
- Show provided capabilities and missing prerequisites.
- Persist local UI state with `localStorage`.
- Render a project manifest preview.

### M4 - Installer Integration

Status: next.

- Connect enabled manifest state to a materialized project skill directory.
- Decide whether enabled skills should be symlinked, copied, or referenced from a resolver.
- Add a dry-run/apply workflow that mirrors `link-codex-skills.sh`.
- Validate that disabled skills are not accidentally removed from the canonical `codex/skills` payload.

### M5 - Rich Project Awareness

Status: next.

- Detect project files such as `.itr.db`, `package.json`, `Cargo.toml`, `pyproject.toml`, and `STORY_STYLE.md`.
- Recommend root unlocks from actual project context.
- Mark capabilities as satisfied by external tools as well as skills.
- Add import/export for `.codex/project-skills.json`.

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

- Registry includes every skill currently staged under `codex/skills`.
- The explorer renders without network dependencies.
- The explorer works on desktop and mobile widths.
- The CLI can create/update a project manifest.
- Validation checks parse registry data and verify referenced skill paths.
- Canonical skill payloads remain separate from enablement state.
