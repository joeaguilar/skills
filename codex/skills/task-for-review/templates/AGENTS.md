# {{name}}

This file is the source of project facts for every coding agent. `CLAUDE.md` imports it.

## How we work

This project works in task-for-review mode: load the task-for-review skill before changing any tracked file.

In short: work is shaped so a human can review it easily. Changes are made in a worktree under `.claude/worktrees/`, in small one-line Conventional Commits, on stacked branches that each carry one idea, and each branch reaches `main` only through a reviewed PR. The main checkout is the human's, for running and testing.

## What this is

<!-- One paragraph: what the project does and who it is for. -->

## Layout

<!-- The folders a newcomer needs to know, one line each. -->

## Commands

<!-- Build, test, lint and run commands, exactly as typed. -->

## Review

- PRs are opened on: <!-- the remote and host where reviews happen -->
- Vocabulary: see `glossary.md`.
