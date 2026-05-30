# Codex Primitive Validation

Snapshot: 2026-05-30, current working tree under `codex/`.

## Checks

- Current system skills from `~/.codex/skills/.system` are present under `codex/skills/.system`:
  `imagegen`, `openai-docs`, `plugin-creator`, `skill-creator`, `skill-installer`.
- `diff -qr` reports no differences between each current system skill source and its `codex/skills/.system/<name>` copy.
- Repo-root skills with `SKILL.md` are all represented under `codex/skills`:
  `alignment`, `blitz`, `itr`, `kgr`, `overdrive`, `roadmap`, `shell-prompt`, `sprint`, `sprint-review`, `story-style`.
- Each converted non-system skill currently has `agents/openai.yaml`.
- All current `codex/skills/**/SKILL.md` files have frontmatter with `name` and `description`.
- Optional primitive roots are present for `codex/agents` and `codex/commands`.
- Current registry validates 18 primitives: 15 skills, 1 agent, and 2 commands.
- The two primitive audit commands both provide `primitive-audit`, so provider routing is covered by a real registry path.
- Registry validation rejects required capabilities with no provider unless the capability is explicitly marked external.
- The explorer supports stale port metadata from `stale`, `stalePort`, `stale_port`, `portState`, or `port_state`.
- The explorer detector scans registry primitive type roots and shows both managed and unmanaged payloads for skills, agents, commands, and future markdown-file primitive types.
- The explorer Markdown Explorer renders registry `SKILL.md` files and detected markdown payloads from the selected folder.
- Current search found no `~/.claude/skills`, `AskUserQuestion`, or Claude-only tool API names in `codex/skills`. Remaining `CLAUDE.md` mentions are project-instruction-file fallbacks, not Claude skill paths or tool calls.

## Findings

- Non-system converted skills are not full directory copies:
  `roadmap/ROADMAP_SKILL_BRIEF.md` is omitted, `shell-prompt/README.md` is omitted, and `shell-prompt/append-prompt.sh` is relocated to `codex/skills/shell-prompt/scripts/append-prompt.sh`.
  The relocation is reflected in the converted shell-prompt `SKILL.md`; the omitted docs/brief should be either intentional or copied/documented.

## Recommended Fixes

1. Decide whether converted non-system skills must preserve auxiliary source files. If yes, copy the omitted roadmap brief and shell-prompt README, or document that Codex output intentionally keeps only runtime-relevant assets.
