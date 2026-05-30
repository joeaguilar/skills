# Agent Guide

This repository holds two parallel skill trees — the **Claude** sources under `claude/skills/` and the **Codex** ports under `codex/skills/` — plus a unified root installer. The two trees are intentionally worded differently per platform (see Editing Rules); they are not byte-identical copies.

## Directory Map

- `claude/skills/<skill>/`: the **Claude** skill sources (`alignment`, `blitz`, `itr`, `kgr`, `overdrive`, `roadmap`, `shell-prompt`, `sprint`, `sprint-review`, `story-style`). Treat these as the originals.
- `codex/`: Codex-compatible output tree and tooling. Codex-specific wording lives here, not in the Claude sources.
- `codex/skills/`: installable Codex skill payloads — converted local skills + `.system` copies of current Codex system skills.
- `codex/PARITY.tsv`: per-skill baseline (claude `SKILL.md` blob each Codex port was reconciled against). Used by `validate-skills.sh` to flag stale ports.
- `codex/backups/`, `codex/registry/`, `codex/explorer/`, `codex/scripts/`: backups, skill-tree registry + capability metadata, the static explorer UI, and operational scripts.
- `install.sh`: unified installer — symlinks `~/.claude/skills → claude/skills` and/or `~/.codex/skills → codex/skills`.
- `validate-skills.sh`: cross-tree parity + drift validator (calls `codex/scripts/validate-codex-skills.sh`).
- `CLAUDE.md` / `AGENTS.md`: project guides for Claude / Codex agents. `COMPRESSION.md`: skill-compression method. `statusline.sh`: shell helper. `backups/`: install backups (gitignored).
- `.claude/`: local Claude settings. Do not rely on this for Codex behavior.

## Editing Rules

- The two trees are **parallel ports, not copies**. Codex skills are reworded for Codex: replace Claude-only tool names (`AskUserQuestion`, `subagent_type`, `run_in_background`, `SendMessage`) with Codex-native user-input and subagent/background-session language, and prefer `AGENTS.md` / `CODEX.md` for Codex repo instructions. Do not paste Claude wording into `codex/skills/`.
- A skill's behavior change starts in `claude/skills/<skill>/`. When the Codex port needs the same change, edit `codex/skills/<skill>/` in Codex wording, then refresh that skill's line in `codex/PARITY.tsv` (`git hash-object claude/skills/<skill>/SKILL.md`).
- Run `./validate-skills.sh` after touching either tree; it flags any skill present in one tree but not the other, and any Codex port whose Claude source moved past its `PARITY.tsv` baseline. Treat staleness warnings as actionable review items: re-port the Codex skill first, then update `PARITY.tsv`; never silence drift by refreshing the hash alone.
- Do not edit `codex/backups/` or `backups/` unless the task is backup maintenance.
- Keep `codex/registry/skill-tree.yaml` and `codex/registry/skill-tree.json` in sync when changing skill tree metadata.
- Keep skill enablement state out of `codex/skills/`; project state belongs in `.codex/project-skills.json` inside the target project.
- Preserve the separation between canonical skill payloads and UI state. The explorer should never rewrite `SKILL.md`.

## Key Commands

Install / link skill trees into the agent homes (dry-run by default; `--apply` to act):

```bash
./install.sh claude            # ~/.claude/skills -> claude/skills
./install.sh codex --apply     # ~/.codex/skills  -> codex/skills (backs up the real dir first)
./install.sh both --apply
```

Validate both trees (parity, drift, frontmatter, codex deep checks):

```bash
./validate-skills.sh
```

Validate only the Codex skills and registry:

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

Install the Codex skills globally (prefer the root `./install.sh codex`; the lower-level codex-only script still works):

```bash
./install.sh codex            # preview
./install.sh codex --apply    # apply
# legacy equivalent: codex/scripts/link-codex-skills.sh [--apply]
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
