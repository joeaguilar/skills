---
name: bootstrap-project-docs
description: "Use only when the user asks to bootstrap the repository's full AGENTS.md, CODEX.md, SOUL.md, GOSPEL.md, APOSTLE.md, CONTRIBUTING.md, and README.md memory scaffold. Do not use for ordinary documentation edits, a single missing file, or updates to an existing scaffold unless requested."
---

# Bootstrap Project Docs

Use this skill to create the standard project-memory documentation scaffold in a repo.

## Workflow

1. Confirm the target directory. Default to the current working directory.
2. Run `scripts/bootstrap_project_docs.py <target-dir>`.
3. Use `--force` only when the user explicitly wants existing scaffold files overwritten.
4. Review the script output and mention which files were created or skipped.
5. If project-specific facts are already known, add them after the scaffold exists.

## Script

Run from the skill directory or pass the absolute script path:

```bash
python3 scripts/bootstrap_project_docs.py /path/to/repo
```

Options:

- `--force`: overwrite existing scaffold files.
- `--project-name NAME`: set the README heading.

The script creates:

- `AGENTS.md`: required agent entrypoint, read order, knowledge map, and documentation growth rule.
- `CODEX.md`: thin pointer to `AGENTS.md` so Codex-specific tools land on the canonical entrypoint.
- `GOSPEL.md`: hard rules, hierarchy, and documentation workflow.
- `SOUL.md`: agent operating identity.
- `APOSTLE.md`: user preferences and product-owner expectations.
- `CONTRIBUTING.md`: coding style and contribution mechanics.
- `README.md`: project status and links to the docs.

## Rules To Preserve

- `AGENTS.md` is the required starting point for every future agent session; `CODEX.md` only redirects there, so durable knowledge never lives in `CODEX.md`.
- Important project knowledge must be saved in the appropriate repo document.
- Use this precedence when knowledge could fit more than one place:
  1. `GOSPEL.md` for hard rules, constraints, workflows, and always/never behavior.
  2. `APOSTLE.md` for user preferences, decision style, priorities, taste, and product-owner expectations.
  3. `SOUL.md` for the agent's repo-specific operating identity.
  4. `AGENTS.md` for condensed navigation, current project state, and links to deeper docs.
- Core memory files should stay under 5000 lines.
- When a core file gets too large, move a coherent section into a focused document, leave a cliffnote summary in the original file, and link to the new document.
- Supporting docs such as `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, `docs/RUNBOOK.md`, `docs/GLOSSARY.md`, `docs/RESEARCH.md`, and `docs/ASSETS.md` should be created only when they have real content.
