#!/usr/bin/env python3
"""Bootstrap the AGENTS/SOUL/GOSPEL/APOSTLE project documentation scaffold."""

from __future__ import annotations

import argparse
from pathlib import Path
from textwrap import dedent


def clean(text: str) -> str:
    return dedent(text).strip() + "\n"


def docs(project_name: str) -> dict[str, str]:
    return {
        "AGENTS.md": clean(
            """
            # AGENTS.md

            This is the required starting point for every agent session in this repo.

            ## Read Order

            1. Read this file first.
            2. Read [GOSPEL.md](GOSPEL.md) for hard project rules.
            3. Read [APOSTLE.md](APOSTLE.md) for the user's preferences and working style.
            4. Read [SOUL.md](SOUL.md) for the agent's repo-specific operating identity.
            5. Read [CONTRIBUTING.md](CONTRIBUTING.md) before making code changes.
            6. Read linked docs only when the current task needs that deeper context.

            ## Knowledge Map

            - [GOSPEL.md](GOSPEL.md): rules, workflows, constraints, and always/never behavior.
            - [APOSTLE.md](APOSTLE.md): user preferences, priorities, taste, and product-owner expectations.
            - [SOUL.md](SOUL.md): agent behavior, communication style, uncertainty handling, and context preservation.
            - [CONTRIBUTING.md](CONTRIBUTING.md): coding style, test expectations, formatting, review standards, and contribution mechanics.
            - [README.md](README.md): project overview, setup, run, and test instructions.
            - [CLAUDE.md](CLAUDE.md): thin pointer to this file so Claude Code lands on the canonical entrypoint.

            ## Documentation Growth Rule

            Core memory files must stay concise and navigable. No core file should exceed 5000 lines.

            When a section grows too large:

            1. Move the detailed material into a focused document.
            2. Leave a short cliffnote summary in the original file.
            3. Link from the original file to the new document.
            4. Keep the original file useful as first-pass context.

            Allowed extraction targets include:

            - `docs/ARCHITECTURE.md` for system design, module boundaries, and data flow.
            - `docs/DECISIONS.md` or `docs/adr/NNN-title.md` for durable technical/product decisions.
            - `docs/ROADMAP.md` for milestones, phases, and deferred direction.
            - `docs/BACKLOG.md` or an issue tracker for pending tasks and bugs.
            - `docs/RUNBOOK.md` for operational commands and troubleshooting.
            - `docs/GLOSSARY.md` for domain vocabulary.
            - `docs/RESEARCH.md` for external references and investigations.
            - `docs/ASSETS.md` for asset inventory, licenses, prompts, and style constraints.

            Create these files when they have real content, not as empty bureaucracy.

            ## Current Project State

            The project has not been defined yet. This repository currently contains the collaboration and documentation workflow scaffold.
            """
        ),
        "CLAUDE.md": clean(
            """
            # CLAUDE.md

            The required agent entrypoint for this repository is [AGENTS.md](AGENTS.md). Read it first.

            This file exists only as a thin pointer so Claude Code lands on the canonical entrypoint. Do not store project memory here — keep durable knowledge in `AGENTS.md` and the documents it links.
            """
        ),
        "GOSPEL.md": clean(
            """
            # GOSPEL.md

            This file contains the rules as they have been written for this project.

            ## Documentation Rules

            - Everything important discussed about the project must be saved in the appropriate repo document.
            - Use this precedence when knowledge could fit more than one place:
              1. `GOSPEL.md` for hard rules, constraints, workflows, and always/never behavior.
              2. `APOSTLE.md` for user preferences, decision style, priorities, taste, and product-owner expectations.
              3. `SOUL.md` for the agent's operating identity in this repo.
              4. `AGENTS.md` for condensed navigation, current project state, and links to deeper docs.
            - `AGENTS.md` is the required starting point for every future agent session.
            - Core memory files should never exceed 5000 lines.
            - When a core file approaches bloat, extract a coherent section into its own document, summarize it in place, and link to the new document.
            - Do not create supporting docs before they have real content.

            ## Core Files

            - `SOUL.md`: the agent.
            - `GOSPEL.md`: the rules.
            - `APOSTLE.md`: the user.
            - `AGENTS.md`: everything an agent needs to know first.
            - `CLAUDE.md`: thin pointer to `AGENTS.md` for Claude Code.
            - `CONTRIBUTING.md`: coding style and contribution mechanics.
            - `README.md`: project overview and setup.

            ## Working Rules

            - Prefer durable written context over relying on chat memory.
            - Keep project memory concise enough to remain useful in active context.
            - Preserve important second- and third-degree knowledge in linked documents when it no longer belongs in first-pass context.
            """
        ),
        "SOUL.md": clean(
            """
            # SOUL.md

            This file describes the agent's repo-specific operating identity.

            ## Role

            Claude is the engineering agent for this repository. The agent should preserve context, make pragmatic implementation choices, and keep the project documentation accurate as decisions are made.

            ## Operating Expectations

            - Read `AGENTS.md` first in future sessions.
            - Respect `GOSPEL.md` as the source of hard project rules.
            - Treat `APOSTLE.md` as the source of user preferences and product-owner expectations.
            - Update documentation when project knowledge becomes durable.
            - Keep communication direct, specific, and action-oriented.
            - Ask for alignment when rules, ownership, or expectations are ambiguous enough that guessing would create future confusion.

            ## Context Preservation

            When a conversation creates durable knowledge, place it in the right file before relying on memory. Keep summaries compact and link to deeper documents when needed.
            """
        ),
        "APOSTLE.md": clean(
            """
            # APOSTLE.md

            This file describes the user's preferences, priorities, and working style for this repository.

            ## Known Preferences

            - The user wants project knowledge saved into explicit repo documents.
            - The user prefers `AGENTS.md` as the required agent entrypoint because it keeps active context compact while linking to deeper knowledge.
            - The user agrees with the documentation hierarchy in `GOSPEL.md`.
            - The user wants coding style stored in `CONTRIBUTING.md`.
            - The user wants documentation to grow by extraction: move large sections into focused documents, summarize them in the original file, and link to the new document.

            ## Product Expectations

            The actual project has not been defined yet.
            """
        ),
        "CONTRIBUTING.md": clean(
            """
            # CONTRIBUTING.md

            This file holds coding style and contribution mechanics for the project.

            ## Current Status

            The project stack has not been chosen yet. Add concrete commands and conventions once the project is defined.

            ## Coding Style

            - Prefer the existing style of the codebase once code exists.
            - Keep changes focused on the task at hand.
            - Avoid unrelated refactors unless they are required to complete the work safely.
            - Add abstractions only when they remove real complexity, reduce meaningful duplication, or match an established project pattern.
            - Keep comments concise and useful; explain non-obvious reasoning rather than restating code.

            ## Testing

            - Add or update tests when behavior changes.
            - Scale test coverage with risk and blast radius.
            - Record the canonical test commands here once the stack exists.

            ## Review Standard

            - Prioritize correctness, maintainability, and clear user-facing behavior.
            - Surface assumptions and risks explicitly.
            - Keep documentation in sync with durable decisions.
            """
        ),
        "README.md": clean(
            f"""
            # {project_name}

            The project has not been defined yet.

            This repository currently contains the collaboration and documentation workflow scaffold.

            ## Documentation

            - [AGENTS.md](AGENTS.md): required starting point for agents.
            - [CLAUDE.md](CLAUDE.md): thin pointer to `AGENTS.md` for Claude Code.
            - [GOSPEL.md](GOSPEL.md): project rules and documentation workflow.
            - [APOSTLE.md](APOSTLE.md): user preferences and product-owner expectations.
            - [SOUL.md](SOUL.md): agent operating identity.
            - [CONTRIBUTING.md](CONTRIBUTING.md): coding style and contribution mechanics.
            """
        ),
    }


def bootstrap(target: Path, project_name: str, force: bool) -> tuple[list[str], list[str], list[str]]:
    target.mkdir(parents=True, exist_ok=True)
    created: list[str] = []
    skipped: list[str] = []
    overwritten: list[str] = []

    for name, content in docs(project_name).items():
        path = target / name
        existed = path.exists()
        if existed and not force:
            skipped.append(name)
            continue
        path.write_text(content, encoding="utf-8")
        if existed:
            overwritten.append(name)
        else:
            created.append(name)

    return created, skipped, overwritten


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", nargs="?", default=".", help="Repository directory to bootstrap.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing scaffold files.")
    parser.add_argument("--project-name", help="README heading. Defaults to the target directory name.")
    args = parser.parse_args()

    target = Path(args.target).expanduser().resolve()
    project_name = args.project_name or target.name
    created, skipped, overwritten = bootstrap(target, project_name, args.force)

    print(f"Target: {target}")
    if created:
        print("Created: " + ", ".join(created))
    if overwritten:
        print("Overwritten: " + ", ".join(overwritten))
    if skipped:
        print("Skipped existing: " + ", ".join(skipped))
    if not created and not overwritten and not skipped:
        print("No files changed.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
