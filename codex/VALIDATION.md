# Codex Skills Validation

Snapshot: 2026-05-29, current working tree under `codex/`.

## Checks

- `git status --short codex` reports `?? codex/`; this tree is untracked in the local worktree, not git-staged.
- Current system skills from `/Users/goldboy/.codex/skills/.system` are present under `codex/skills/.system`:
  `imagegen`, `openai-docs`, `plugin-creator`, `skill-creator`, `skill-installer`.
- `diff -qr` reports no differences between each current system skill source and its `codex/skills/.system/<name>` copy.
- Repo-root skills with `SKILL.md` are all represented under `codex/skills`:
  `alignment`, `blitz`, `itr`, `kgr`, `overdrive`, `roadmap`, `shell-prompt`, `sprint`, `sprint-review`, `story-style`.
- Each converted non-system skill currently has `agents/openai.yaml`.
- All current `codex/skills/**/SKILL.md` files have frontmatter with `name` and `description`.
- Current search found no `~/.claude/skills`, `AskUserQuestion`, or Claude-only tool API names in `codex/skills`. Remaining `CLAUDE.md` mentions are project-instruction-file fallbacks, not Claude skill paths or tool calls.

## Findings

- Non-system converted skills are not full directory copies:
  `roadmap/ROADMAP_SKILL_BRIEF.md` is omitted, `shell-prompt/README.md` is omitted, and `shell-prompt/append-prompt.sh` is relocated to `codex/skills/shell-prompt/scripts/append-prompt.sh`.
  The relocation is reflected in the converted shell-prompt `SKILL.md`; the omitted docs/brief should be either intentional or copied/documented.

## Recommended Fixes

1. Decide whether converted non-system skills must preserve auxiliary source files. If yes, copy the omitted roadmap brief and shell-prompt README, or document that Codex output intentionally keeps only runtime-relevant assets.
