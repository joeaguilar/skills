# Agent Guide

This repository holds parallel installable primitive trees for **Claude** and **Codex**. Skills live under `claude/skills/` and `codex/skills/`; additional primitive roots such as `agents/` and `commands/` may live beside them under each platform. The platform trees are intentionally worded differently where needed (see Editing Rules); they are not byte-identical copies.

## Directory Map

- `claude/<primitive>/`: **Claude** primitive sources. `claude/skills/<skill>/` holds the original skill sources (`alignment`, `blitz`, `itr`, `kgr`, `overdrive`, `roadmap`, `shell-prompt`, `sprint`, `sprint-review`, `story-style`).
- `claude/agents/`, `claude/commands/`: optional Claude primitive roots. Install them when present; skip cleanly when absent.
- `codex/`: Codex-compatible output tree and tooling. Codex-specific wording lives here, not in the Claude sources.
- `codex/<primitive>/`: installable Codex primitive payloads. `codex/skills/` contains converted local skills + `.system` copies of current Codex system skills.
- `codex/agents/`, `codex/commands/`: optional Codex primitive roots. Install them when present; skip cleanly when absent.
- `codex/PARITY.tsv`: per-skill baseline (claude `SKILL.md` blob each Codex port was reconciled against). Used by `validate-skills.sh` to flag stale ports.
- `PLATFORM_ONLY.tsv` (repo root): intentional one-tree-only primitives (`platform  root  name`), exempted from cross-tree parity in `validate-skills.sh`. Drift is legitimate in both directions — Claude carries legacy/native commands not yet ported; Codex carries skills Claude can't run (e.g. image generation). Listed agents/commands payloads also skip the frontmatter lint (imported as-is).
- `claude/settings.json`: canonical `~/.claude/settings.json`, linked by the installer's opt-in `config` primitive (Claude-only; Codex `config` is a no-op).
- `codex/backups/`, `codex/registry/`, `codex/explorer/`, `codex/scripts/`: backups, skill-tree registry + capability metadata, the static explorer UI, and operational scripts.
- `install.sh`: unified primitive installer. Global installs link roots into `~/.claude/<primitive>` and/or `~/.codex/<primitive>`; local installs link roots into a target project's `.claude/<primitive>` and/or `.codex/<primitive>`.
- `validate-skills.sh`: cross-tree parity + drift validator (calls `codex/scripts/validate-codex-skills.sh`).
- `CLAUDE.md` / `AGENTS.md`: project guides for Claude / Codex agents. `COMPRESSION.md`: skill-compression method. `statusline.sh`: shell helper. `backups/`: install backups (gitignored).
- `.claude/`: local Claude settings. Do not rely on this for Codex behavior.

## Editing Rules

- The two platform trees are **parallel ports, not copies**. Codex skills are reworded for Codex: replace Claude-only tool names (`AskUserQuestion`, `subagent_type`, `run_in_background`, `SendMessage`) with Codex-native user-input and subagent/background-session language, and prefer `AGENTS.md` / `CODEX.md` for Codex repo instructions. Do not paste Claude wording into `codex/skills/`.
- A skill's behavior change starts in `claude/skills/<skill>/`. When the Codex port needs the same change, edit `codex/skills/<skill>/` in Codex wording, then refresh that skill's line in `codex/PARITY.tsv` (`git hash-object claude/skills/<skill>/SKILL.md`).
- For non-skill primitives, keep source roots platform-specific: edit `claude/<primitive>/` for Claude payloads and `codex/<primitive>/` for Codex payloads. Do not mix per-project install state into these canonical roots.
- **Side ownership:** Codex agents should edit Codex-owned files (`codex/**` and Codex-facing guidance such as `AGENTS.md`) and avoid changing `claude/**` unless the user gives an explicit one-off exception. When shared repo-level files must change (`install.sh`, `validate-skills.sh`, `PLATFORM_ONLY.tsv`, root docs), keep the edit minimal, state why it crosses the side boundary, and prefer a Codex-only path whenever that can solve the problem.
- Run `./validate-skills.sh` after touching either tree; it flags any skill present in one tree but not the other, and any Codex port whose Claude source moved past its `PARITY.tsv` baseline. Treat staleness warnings as actionable review items: re-port the Codex skill first, then update `PARITY.tsv`; never silence drift by refreshing the hash alone.
- **Porting a Claude-only primitive to parity** (e.g. the legacy commands under `claude/commands/` listed in `PLATFORM_ONLY.tsv`): add the reworded Codex peer in the matching root (`codex/commands/<name>.md`, Codex wording — no Claude-isms), give it the managed frontmatter, then **delete that primitive's line from `PLATFORM_ONLY.tsv`** so the validator resumes enforcing parity for it. Conversely, a genuinely Codex-only primitive (no Claude equivalent possible) gets a `codex  <root>  <name>` line added to `PLATFORM_ONLY.tsv` instead of a forced Claude stub.
- Do not edit `codex/backups/` or `backups/` unless the task is backup maintenance.
- Keep `codex/registry/skill-tree.yaml` and `codex/registry/skill-tree.json` in sync when changing primitive metadata. The filenames are legacy; the schema is now primitive-aware.
- Keep primitive enablement state out of canonical roots like `codex/skills/`, `codex/agents/`, and `codex/commands/`; local project state belongs in `.codex/project-primitives.json` inside the target project. Legacy `.codex/project-skills.json` is still read for compatibility.
- Preserve the separation between canonical primitive payloads and UI state. The explorer should never rewrite `SKILL.md`, agent markdown, or command markdown.

## Key Commands

Install / link primitive roots. Dry-run is the default; pass `--apply` to act. Existing skill-only commands still work:

```bash
./install.sh claude            # global dry run: ~/.claude/skills -> claude/skills
./install.sh codex --apply     # global apply: ~/.codex/skills -> codex/skills
./install.sh both --apply
```

Install all standard primitive roots (`skills`, `agents`, `commands`) globally, skipping optional roots that are absent:

```bash
./install.sh both --all-primitives
./install.sh both --all-primitives --apply
```

Install / link primitive roots into a target project instead of user homes:

```bash
./install.sh codex --local /path/to/project --all-primitives --apply
./install.sh claude --local . --primitive commands --apply
./install.sh both --local /path/to/project --primitives skills,agents
```

Validate both trees (parity, drift, frontmatter, codex deep checks):

```bash
./validate-skills.sh
```

Validate only the Codex primitives and registry:

```bash
codex/scripts/validate-codex-skills.sh
```

Validate only the skill-tree registry:

```bash
node codex/scripts/skill-tree.js validate
```

Enable a primitive for another project:

```bash
node codex/scripts/skill-tree.js enable itr --project /path/to/project
node codex/scripts/skill-tree.js enable primitive-architect-agent --project /path/to/project
```

Inspect another project's primitive state:

```bash
node codex/scripts/skill-tree.js status --project /path/to/project
```

Select a provider when multiple enabled primitives provide the same capability:

```bash
node codex/scripts/skill-tree.js provider primitive-audit primitive-audit-summary-command --project /path/to/project
node codex/scripts/skill-tree.js provider primitive-audit auto --project /path/to/project
```

Install Codex primitives globally (prefer the root `./install.sh codex`; the lower-level codex-only skills script still works for skills):

```bash
./install.sh codex            # preview
./install.sh codex --apply    # apply
./install.sh codex --all-primitives --apply
# legacy equivalent: codex/scripts/link-codex-skills.sh [--apply]
```

Run the visual primitive installer from the repository root:

```bash
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/
```

If that port is occupied, use another port and adjust the URL. The root page redirects to `codex/explorer/`; launch from the repo root so both `claude/**` and `codex/**` payload markdown can be loaded.

## Primitive Tree Model

The primitive tree is capability-first:

- Skills, agents, commands, and future primitive types declare capabilities they provide, such as `issue-tracker` or `code-graph`.
- Higher primitives require capabilities, not only exact primitive names.
- This allows a future GitHub Issues, Linear, or Jira skill to satisfy the same `issue-tracker` dependency that `itr` satisfies today.
- Cross-type chains are valid: agents may require skills, skills may require agents or slash commands, and slash commands may require skills.
- A required capability must have at least one provider primitive unless the capability is explicitly marked external in the registry.
- When multiple enabled primitives provide the same capability, the manifest `providers` map can select the active provider; otherwise the first enabled provider is used.
- Registry entries can surface stale port metadata with `stale`, `stalePort`, or `portState: "stale"`; the explorer displays this as a port state.

Important progression:

- `itr` provides `issue-tracker`.
- `kgr` provides `code-graph`.
- `sprint` requires both and provides `sprint-planning`.
- `blitz` and `sprint-review` require `sprint-planning`.
- `overdrive` requires the planning, execution, review, issue-tracker, and code-graph capabilities.

The explorer shows primitives as a full tree with tabs for each primitive type. Missing prerequisites render as sealed silhouettes. Satisfied prerequisites render as ready silhouettes. Enabled primitives render as colored activated nodes. The platform switch separates Claude state from Codex state, and the scope switch separates `global` user-home state from `local` project state.

## Project Selection UI

The explorer has a `DIR Project` control. In Chromium on `localhost`, it uses the File System Access API to select a project folder, read the active platform manifest (`.claude/project-primitives.json` or `.codex/project-primitives.json`, falling back to the matching legacy `project-skills.json`), and write updates back to the primitive manifest.

The `SC` scan control uses the same browser file-access model to detect managed and unmanaged primitives in the selected folder. It scans every registry primitive type root, including `skills`, `agents`, `commands`, and future `primitiveTypes` roots, across direct roots plus `codex/`, `claude/`, `.codex/`, `.claude/`, and `.agents/` prefixes. Skills are detected by `SKILL.md`; agents, slash commands, and future markdown-file primitives are detected by `.md` payloads. The inspector can render the selected registry or detected markdown payload in the Markdown Explorer.

The UI also reads repo-root `PLATFORM_ONLY.tsv` when launched from the repo root. Those entries become platform-specific UI nodes, so Claude-only slash commands are visible/selectable in Claude mode without forcing Codex stubs.

Unsupported browsers fall back to local browser storage. In that mode, `Copy Manifest` can still copy the generated manifest for manual use.

## Current Validation Expectations

Before finishing changes that touch `codex/`, run:

```bash
codex/scripts/validate-codex-skills.sh
node --check codex/explorer/app.js
node --check codex/scripts/skill-tree.js
```

For UI changes, run a local server and verify the explorer in a browser. Check that:

- The installer launches from the repo root at `http://127.0.0.1:8765/`.
- Codex shows 18 current primitives: 15 skills, 1 agent, and 2 slash commands.
- Claude platform mode hides Codex-only `.system` skills and loads Claude payload markdown.
- Claude platform mode includes Claude-only slash commands declared in `PLATFORM_ONLY.tsv`.
- Each primitive type has its own tab.
- The Claude/Codex platform switch updates path labels, markdown source, manifest path, and enabled/provider state independently.
- The Local/Global scope switch updates the manifest preview and enabled state independently.
- Locked future skills are visible as silhouettes.
- Enabling `itr` and `kgr` makes `sprint` available.
- Enabling `skill-creator` makes `primitive-architect-agent` available.
- Enabling `primitive-architect-agent` makes both primitive audit commands available.
- Enabling both primitive audit commands exposes provider routing for `primitive-audit`.
- Enabling `sprint` makes `blitz` and `sprint-review` available.
- `overdrive` remains visible and sealed until its required capabilities are enabled.
- The folder picker can load and save `.claude/project-primitives.json` and `.codex/project-primitives.json` when supported.
- The scan control displays managed and unmanaged detected skills, agents, and commands.
- The Markdown Explorer renders `SKILL.md` for skills and markdown payloads for agents/commands.
