# claude/archived — retired Claude primitives

Primitives that are no longer installed. `install.sh` links only `claude/skills`,
`claude/agents`, `claude/commands` and `claude/workflows`, so nothing under this
folder reaches `~/.claude` or a project's `.claude/`, and no session loads it.

They are kept, unedited, for reference: each file is the text its replacement was
built from. Layout mirrors the installed roots: `claude/archived/skills/<name>/`.

| Archived | Date | Replaced by | Codex port |
|---|---|---|---|

## Where the replacements live

The replacements are Claude Code mods (function-hook plugins). They are **not in
this repo**: they sit in `~/.claude/dev-mods/` on the machine that built them and
load through `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`. A machine
without those mods has neither the skill nor its replacement; restore the skill
there (below) or copy the mod folders across.

## Rules

- Move, don't delete, and don't edit what you move:
  `git mv claude/skills/<name> claude/archived/skills/<name>`, then add its row above.
- Drop the skill's `claude skills <name>` line from `PLATFORM_ONLY.tsv`. If a Codex
  port stays behind, declare it there as `codex skills <name>`.
- Restore with the reverse `git mv`, then put the `PLATFORM_ONLY.tsv` lines back
  the way they were and run `./validate-skills.sh`.
- A name may live in one place only. `validate-skills.sh` §8 fails when the same
  name is under `claude/skills` and under `claude/archived/skills` or
  `claude/wip/skills`.
- Unfinished drafts go to `claude/wip/`, not here.
