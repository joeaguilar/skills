# Primitive Installer Roadmap

## Product Intent

Build a project primitive installer UI that treats Claude and Codex skills, agents, slash commands, and future installable roots like an unlockable capability tree. A project starts with foundational primitives, enables them deliberately, and higher-order workflows become available when their capability prerequisites are satisfied.

The explorer should feel like a tactical game interface while remaining honest infrastructure: primitives are still files, enablement is still a manifest, and install/apply steps stay reversible.

## Core Model

- `codex/skills/`, `codex/agents/`, and `codex/commands/` are installable primitive payload directories.
- `codex/registry/skill-tree.yaml` is the human-readable source of primitive dependencies, unlock rules, groups, icon metadata, and capability relationships.
- `codex/registry/skill-tree.json` is the UI/CLI-readable registry.
- `codex/registry/capabilities.yaml` defines shared capability names so dependencies can target capabilities such as `issue-tracker` instead of hard-coding `itr`.
- `.codex/project-primitives.json` is the per-project enabled-state manifest; `.codex/project-skills.json` is read as a legacy fallback.
- `codex/explorer/` is the shared Claude/Codex visual primitive installer UI. Serve the repo root and open `/` so both platform payload trees can be read.
- `codex/scripts/skill-tree.js` is the CLI bridge for listing, enabling, disabling, and writing project manifests.
- The manifest `providers` map records explicit provider choices when multiple enabled primitives provide the same capability.
- Registry entries may expose stale port state with `stale`, `stalePort`, or `portState: "stale"` for UI display.
- The installer target matrix is platform + scope:
  - Claude global: `~/.claude/primitives.json` plus selected materialized roots under `~/.claude/`.
  - Claude local: `.claude/project-primitives.json` plus selected materialized roots under the target project.
  - Codex global: `~/.codex/primitives.json` plus selected materialized roots under `~/.codex/` and the Codex custom skill root where appropriate.
  - Codex local: `.codex/project-primitives.json` plus selected materialized roots under the target project.
- Platform config is separate. The same primitive capability may install different payloads or no payload for Claude vs Codex.

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

### M4 - Platform-Aware UI

Status: built in this pass.

- Add a platform selector to the explorer (`Claude` / `Codex`) beside the existing `Local` / `Global` scope switch.
- Store UI state independently for all four platform/scope pairs:
  - `claude:global`
  - `claude:local`
  - `codex:global`
  - `codex:local`
- Make manifest preview, provider routing, path labels, and selected markdown source all respect the active platform.
- Keep platform switching read-only with respect to payload files in this milestone. The UI may write manifests, but it must not materialize symlinks yet.
- Validation:
  - Explorer can switch platform and scope without losing independent enabled/provider state.
  - Manifest paths match `manifest_paths` in the registry.
  - Claude views use Claude payload paths when a primitive has `platforms.claude.path`.
  - Codex views use Codex payload paths when a primitive has `platforms.codex.path` or `path`.

### M5 - Install Planner CLI

Status: next.

- Extend `codex/scripts/skill-tree.js` with a dry-run install planner:
  - `plan-install --platform claude|codex --scope local|global [--project PATH]`
  - Reads the selected manifest.
  - Resolves enabled primitives to source payloads.
  - Computes target materialization paths.
  - Reports create, replace-symlink, back-up-real-path, skip, and unmanaged actions.
- Add registry metadata for install behavior where the default root mapping is not enough:
  - payload kind: directory, markdown file, config file, generated manifest, or external/no-op.
  - target path override per platform.
  - install strategy: symlink by default, copy only when a primitive explicitly requires it.
- Refuse unsafe plans:
  - unknown primitive id
  - primitive enabled for a platform without a payload or explicit no-op
  - target path escaping the intended install root
  - duplicate target paths
  - destructive replacement without backup
- Validation:
  - Planner produces stable, readable dry-run output for all four platform/scope combinations.
  - Planner handles skills, agents, and commands.
  - Planner leaves disabled/unmanaged target files untouched.
  - Unit-style fixtures cover real directory targets, symlink targets, and missing source payloads.

### M6 - Install Apply CLI

Status: next.

- Add apply mode:
  - `apply-install --platform claude|codex --scope local|global [--project PATH] --apply`
  - Reuses the exact planner output.
  - Creates parent directories.
  - Symlinks or copies enabled payloads.
  - Backs up existing real files/directories before replacement.
  - Replaces only managed symlinks or paths with explicit backups.
- Write a small install ledger per target root so future apply runs know what this installer owns.
  Candidate paths:
  - global Claude: `~/.claude/primitive-install-ledger.json`
  - local Claude: `.claude/primitive-install-ledger.json`
  - global Codex: `~/.codex/primitive-install-ledger.json`
  - local Codex: `.codex/primitive-install-ledger.json`
- Support uninstall/prune only for ledger-owned paths; never remove untracked user files.
- Keep root `install.sh` as the coarse whole-root linker. The new installer is per-primitive and manifest-driven.
- Validation:
  - Apply is idempotent after a successful first run.
  - Re-running after manifest changes adds newly enabled primitives and leaves disabled unmanaged paths alone.
  - Backups are created before replacing real files/directories.
  - `./validate-skills.sh` still passes after apply-related code changes.

### M7 - UI Install Workflow

Status: next.

- Add an installer panel to the explorer inspector:
  - active platform
  - active scope
  - project path or global target
  - enabled primitive count by type
  - install plan preview
  - copy command button
- Browser-only mode:
  - The UI writes manifests when File System Access is available.
  - The UI shows the CLI command needed to apply materialization.
  - The UI does not attempt global filesystem writes directly.
- Optional trusted local server mode:
  - A small localhost-only server can expose `plan-install` and `apply-install`.
  - The UI may call apply only after showing the exact plan and receiving explicit confirmation.
  - Server mode is off by default and documented as a development/admin workflow.
- Validation:
  - UI can plan local Codex and local Claude installs for a selected project.
  - UI can show global plans without project selection.
  - Apply buttons are disabled unless a trusted local apply backend is detected.
  - Copy-command flow works in unsupported browsers.

### M8 - Custom Primitive Types

Status: next.

- Generalize `primitive_types` beyond `skill`, `agent`, and `command`.
- Add type metadata fields:
  - `root`
  - `label`
  - `payload_kind`
  - `default_filename` when a primitive is represented by a single file
  - `markdown_renderable`
  - `installable`
- Candidate future types:
  - `config`: settings/rules/status-line payloads.
  - `rule`: agent rules or policy snippets.
  - `mcp`: MCP server definitions.
  - `plugin`: local plugin bundles.
  - `asset`: reusable templates or static assets.
- Update scanner, inspector, Markdown Explorer, registry validation, and install planner to use type metadata instead of hardcoded assumptions.
- Validation:
  - Adding a new primitive type in the registry creates a UI tab automatically.
  - Scanner detects payloads by type metadata.
  - Install planner knows whether the type is installable or manifest-only.

### M9 - Rich Project Awareness

Status: next.

- Detect project files such as `.itr.db`, `package.json`, `Cargo.toml`, `pyproject.toml`, and `STORY_STYLE.md`.
- Recommend root unlocks from actual project context.
- Mark capabilities as satisfied by external tools as well as skills.
- Add import/export for `.codex/project-primitives.json` beyond copy-to-clipboard.
- Recommend platform-specific install paths and prerequisites based on selected project state.

### M10 - Marketplace Polish

Status: later.

- Add first-class icon assets per skill.
- Add animated unlock transitions with reduced-motion support.
- Add registry version migrations.
- Add conflict detection for multiple skills that provide the same exclusive capability.
- Add a "recommended build path" for common workflows such as sprint planning, autonomous backlog clearance, and Codex customization.

## Installer Acceptance Criteria

The skill tree installer is "real" when:

- A human can pick Claude or Codex in the UI.
- A human can pick Local or Global in the UI.
- The manifest preview and install plan reflect the selected platform/scope pair.
- Skills, agents, commands, and at least one additional custom primitive type render as separate tabs.
- The CLI can dry-run and apply the selected manifest for all four platform/scope combinations.
- Applies are idempotent and reversible through backups/ledger data.
- The UI can write project manifests directly where browser support allows.
- The UI can either copy an apply command or call a trusted local apply backend.
- Unmanaged user files are never deleted or overwritten without backup.
- Claude and Codex config payloads can diverge cleanly.

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
- `dual-blitz` unlocks after `blitz` and provides `dual-blitz-orchestration`.

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
