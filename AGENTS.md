# Agent Guide

This repository contains local agent skills and a Codex-compatible skill distribution built from them.

## Directory Map

- `alignment/`, `blitz/`, `itr/`, `kgr/`, `overdrive/`, `roadmap/`, `shell-prompt/`, `sprint/`, `sprint-review/`, `story-style/`: source skill directories. Treat these as originals.
- `codex/`: Codex-compatible output tree and tooling. Changes for Codex compatibility should normally happen here, not in the source skill directories.
- `codex/skills/`: installable Codex skill payloads. Includes converted local skills and `.system` copies of current Codex system skills.
- `codex/backups/`: snapshots of existing Codex skills taken before linking or replacement.
- `codex/registry/`: skill tree registry and capability metadata.
- `codex/explorer/`: static skill-tree UI for inspecting and enabling project skills.
- `codex/scripts/`: operational scripts for validation, global symlink install, and project skill manifests.
- `statusline.sh`: shell/statusline helper outside the Codex skill distribution.
- `.claude/`: local Claude settings. Do not rely on this for Codex behavior.

## Editing Rules

- Do not modify the source skill directories when the task is about Codex compatibility. Edit their copied versions under `codex/skills/`.
- Do not edit `codex/backups/` unless the task explicitly involves backup maintenance.
- Keep `codex/registry/skill-tree.yaml` and `codex/registry/skill-tree.json` in sync when changing skill tree metadata.
- Keep skill enablement state out of `codex/skills/`; project state belongs in `.codex/project-skills.json` inside the target project.
- Preserve the separation between canonical skill payloads and UI state. The explorer should never rewrite `SKILL.md`.

## Key Commands

Validate Codex skills and registry:

```bash
codex/scripts/validate-codex-skills.sh
```

Validate only the skill-tree registry:

```bash
node codex/scripts/skill-tree.js validate
```

Enable a skill for another project:

```bash
node codex/scripts/skill-tree.js enable itr --project /path/to/project
```

Inspect another project's skill state:

```bash
node codex/scripts/skill-tree.js status --project /path/to/project
```

Preview the global Codex skills symlink:

```bash
codex/scripts/link-codex-skills.sh
```

Apply the global Codex skills symlink:

```bash
codex/scripts/link-codex-skills.sh --apply
```

Run the visual explorer:

```bash
cd codex
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/explorer/
```

If that port is occupied, use another port and adjust the URL.

## Skill Tree Model

The skill tree is capability-first:

- Skills declare capabilities they provide, such as `issue-tracker` or `code-graph`.
- Higher skills require capabilities, not only exact skill names.
- This allows a future GitHub Issues, Linear, or Jira skill to satisfy the same `issue-tracker` dependency that `itr` satisfies today.

Important progression:

- `itr` provides `issue-tracker`.
- `kgr` provides `code-graph`.
- `sprint` requires both and provides `sprint-planning`.
- `blitz` and `sprint-review` require `sprint-planning`.
- `overdrive` requires the planning, execution, review, issue-tracker, and code-graph capabilities.

The explorer shows all skills as a full tree. Missing prerequisites render as sealed silhouettes. Satisfied prerequisites render as ready silhouettes. Enabled skills render as colored activated nodes.

## Project Selection UI

The explorer has a `DIR Project` control. In Chromium on `localhost`, it uses the File System Access API to select a project folder, read `.codex/project-skills.json`, and write updates back to that file.

Unsupported browsers fall back to local browser storage. In that mode, `Copy Manifest` can still copy the generated manifest for manual use.

## Current Validation Expectations

Before finishing changes that touch `codex/`, run:

```bash
codex/scripts/validate-codex-skills.sh
node --check codex/explorer/app.js
node --check codex/scripts/skill-tree.js
```

For UI changes, run a local server and verify the explorer in a browser. Check that:

- All 15 skills render.
- Locked future skills are visible as silhouettes.
- Enabling `itr` and `kgr` makes `sprint` available.
- Enabling `sprint` makes `blitz` and `sprint-review` available.
- `overdrive` remains visible and sealed until its required capabilities are enabled.
- The folder picker can load and save `.codex/project-skills.json` when supported.
