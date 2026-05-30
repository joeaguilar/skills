# Skills Primitive Repository

This repo stores two parallel installable primitive trees:

- `claude/`: Claude-native skills, agents, commands, and config payloads.
- `codex/`: Codex-native ports, Codex system skill copies, registry tooling,
  explorer UI, and Codex install helpers.

The two sides are related, but they are not copies. They use different wording
because Claude and Codex have different tool names, runtime assumptions, and
loading behavior.

## What Humans Should Know

This repository is the source of truth for primitive payloads. Installed
directories such as `~/.claude/skills`, `~/.codex/skills`, `~/.agents/skills`,
and project-local `.claude/` or `.codex/` directories should be treated as
linked or generated install state.

The important rule is side ownership:

- Ask Claude to work on Claude-owned files: `claude/**`, Claude-facing docs, and
  Claude install/config behavior.
- Ask Codex to work on Codex-owned files: `codex/**`, Codex-facing docs, and
  Codex install/registry behavior.
- Shared root files such as `install.sh`, `validate-skills.sh`,
  `PLATFORM_ONLY.tsv`, `README.md`, `AGENTS.md`, and `CLAUDE.md` should change
  only when the shared contract needs to change.

When the same behavior belongs on both sides, let one agent make its native
change first, then ask the other agent to port the intent in its own wording.
Do not expect byte-for-byte parity.

## Repository Map

- `claude/skills/`: Claude skill sources.
- `claude/agents/`, `claude/commands/`: Claude primitive roots.
- `claude/settings.json`: canonical Claude config payload for the optional
  `config` primitive.
- `codex/skills/`: Codex skill ports plus `.system` Codex system skills.
- `codex/agents/`, `codex/commands/`: Codex primitive roots.
- `codex/registry/`: primitive metadata, capabilities, dependencies, and
  provider routing.
- `codex/explorer/`: static Claude/Codex primitive installer UI.
- `codex/scripts/`: Codex validation, registry, and install helper scripts.
- `codex/PARITY.tsv`: Claude source blob baselines for Codex skill ports.
- `PLATFORM_ONLY.tsv`: intentional one-side-only primitive declarations.
- `install.sh`: unified global/local primitive linker.
- `validate-skills.sh`: cross-tree validator.
- `AGENTS.md`: Codex agent instructions.
- `CLAUDE.md`: Claude agent instructions.

## Quick Start

Preview a global Codex install:

```bash
./install.sh codex --all-primitives
```

Apply it:

```bash
./install.sh codex --all-primitives --apply
```

Preview a global Claude install:

```bash
./install.sh claude --all-primitives
```

Apply it:

```bash
./install.sh claude --all-primitives --apply
```

Install into a project instead of a user home:

```bash
./install.sh codex --local /path/to/project --all-primitives --apply
./install.sh claude --local /path/to/project --all-primitives --apply
```

Dry-run is the default. Pass `--apply` only when you want to change symlinks or
back up existing installed directories.

## Codex Skill Loading

Codex currently uses two skill roots in this setup:

- `~/.codex/skills/.system` for bundled/system skills.
- `~/.agents/skills` for local custom skills.

Use the Codex helper when the custom skills under `~/.agents/skills` need to be
refreshed from this repo:

```bash
codex/scripts/link-agent-skills.sh
codex/scripts/link-agent-skills.sh --apply
```

The helper links only non-system skills from `codex/skills` and backs up stale
installed directories under `codex/backups/`.

## Validation

Run the full cross-tree check before committing meaningful changes:

```bash
./validate-skills.sh
```

Run Codex-only checks after touching `codex/`:

```bash
codex/scripts/validate-codex-skills.sh
node --check codex/scripts/skill-tree.js
node --check codex/explorer/app.js
```

Validate only the primitive registry:

```bash
node codex/scripts/skill-tree.js validate
```

## Primitive Registry

The Codex registry is capability-first. Primitives provide and require
capabilities such as `issue-tracker`, `code-graph`, `sprint-planning`, and
`primitive-audit`. This lets future tools provide the same capability without
forcing higher-level workflows to depend on one specific primitive name.

Useful commands:

```bash
node codex/scripts/skill-tree.js status --project /path/to/project
node codex/scripts/skill-tree.js enable itr --project /path/to/project
node codex/scripts/skill-tree.js provider primitive-audit auto --project /path/to/project
```

Project enablement state belongs in the target project's platform manifest
(`.claude/project-primitives.json` or `.codex/project-primitives.json`), not in
this repo's canonical primitive roots.

## Visual Installer

Serve the primitive installer locally from the repository root:

```bash
python3 -m http.server 8765
```

Open:

```text
http://127.0.0.1:8765/
```

If port `8765` is occupied, use another port and adjust the URL:

```bash
python3 -m http.server 9876
```

```text
http://127.0.0.1:9876/
```

The root page redirects to `codex/explorer/`. Start the server from the
repository root so both platform trees are readable by relative URL:
`codex/registry/skill-tree.json`, `codex/**` payloads, and `claude/**`
payloads.

The installer shows:

- A Claude/Codex platform switch beside the Local/Global scope switch.
- Separate tabs for skills, agents, slash commands, and future primitive types.
- Platform-specific local/global state and generated primitive manifests:
  `.claude/project-primitives.json`, `.codex/project-primitives.json`,
  `~/.claude/primitives.json`, or `~/.codex/primitives.json`.
- Capability prerequisites, locked/available/enabled states, missing-provider
  state, stale-port state, and provider routing.
- The selected primitive's markdown source in the Markdown Explorer.

In Chromium on `localhost`, the browser File System Access API enables two
project-folder workflows:

- `DIR Project` selects a project, reads the active platform manifest
  (`.claude/project-primitives.json` or `.codex/project-primitives.json`, with
  legacy project-skills fallback), and saves manifest changes.
- `SC` scans the selected folder for managed and unmanaged primitives. It scans
  `skills`, `agents`, `commands`, and any future registry `primitiveTypes` roots
  across direct roots plus `codex/`, `claude/`, `.codex/`, `.claude/`, and
  `.agents/` prefixes. Skills are detected by `SKILL.md`; agents and commands
  are detected by markdown payload files.

Unsupported browsers still render the tree and manifest preview, but folder
selection and scanning fall back to browser-local state.

## UI Primitive Installer

The UI primitive installer is the browser UI plus the registry CLI:

- UI code: `codex/explorer/`
- Registry source: `codex/registry/skill-tree.yaml`
- Registry JSON used by the UI/CLI: `codex/registry/skill-tree.json`
- CLI bridge: `codex/scripts/skill-tree.js`
- Roadmap/status notes: `codex/ROADMAP.md`

Current development status:

- Built: the explorer renders the primitive tree, separates skills/agents/
  commands into tabs, shows capability locks, supports local/global scope state,
  writes project manifests where browser file access is available, and exposes
  provider routing for capabilities with multiple providers.
- Built: the explorer detects managed and unmanaged primitive payloads in a
  selected folder and renders `SKILL.md`, agent markdown, and slash-command
  markdown in the inspector.
- Built: the CLI can list, inspect, enable, disable, route providers, emit a
  manifest, and validate the registry.
- Not fully built yet: applying enabled UI state directly into materialized
  project primitive directories. That installer integration is tracked as the
  install planner work in `codex/ROADMAP.md`.

For now, use the UI/CLI to manage and inspect enablement state, then use
`install.sh` or the Codex link helpers to materialize symlinks.

## Porting Rules

For skill behavior changes:

1. Change the source side first.
2. Port the intent to the other side in that agent's wording.
3. For Codex skill ports, refresh the corresponding `codex/PARITY.tsv` line
   with:

   ```bash
   git hash-object claude/skills/<skill>/SKILL.md
   ```

For Claude-only or Codex-only primitives, use `PLATFORM_ONLY.tsv` instead of
creating an empty stub on the other side. When a primitive graduates to parity,
add the peer payload and remove its platform-only line.

## Recovery

The installer and Codex link helper back up replaced real directories before
symlinking. Backups are written under:

- `backups/` for root `install.sh` operations.
- `codex/backups/` for Codex-specific helper operations.

Do not edit backup directories unless you are intentionally restoring or
cleaning backup state.

## Agent Docs

Humans can use this README as the operational overview. Agents should follow
their side-specific instructions:

- Codex: `AGENTS.md`
- Claude: `CLAUDE.md`
