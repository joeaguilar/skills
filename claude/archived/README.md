# claude/archived — retired Claude primitives

Primitives that are no longer installed. `install.sh` links only `claude/skills`,
`claude/agents`, `claude/commands` and `claude/workflows`, so nothing under this
folder reaches `~/.claude` or a project's `.claude/`, and no session loads it.

They are kept, unedited, for reference: each file is the text its replacement was
built from. Layout mirrors the installed roots: `claude/archived/skills/<name>/`.

| Archived | Date | Replaced by | Codex port |
|---|---|---|---|
| `skills/whats-next` | 2026-10-03 | `whats-next` mod: a band line with the next item, the `/whats-next` pane, a `report` tool the model can call | stays, Codex-only |
| `skills/tsugi` | 2026-10-03 | `whats-next` mod: `/tsugi` | none |
| `skills/start` | 2026-10-03 | `whats-next` mod: `/start` and `Start ¤` submit this text as the prompt | none |
| `skills/ponytail` | 2026-10-03 | `ponytail` mod: `/ponytail on\|off` adds the body as a system-prompt section | stays, Codex-only |
| `skills/bootstrap-project-docs` | 2026-10-03 | `bootstrap-docs` mod: `/bootstrap-docs` writes the scaffold with no model turn | stays, Codex-only |
| `skills/git-identity-check` | 2026-10-03 | Git Pulse 0.2.0: `/git-pulse identity [path…]` | stays, Codex-only |
| `skills/queue-up-persistent` | 2026-10-03 | `queue` mod: `/queue` stages, shows, drops and clears with no model turn; `--run`, `--now` and `--drain` submit the task. Holds `QUEUE.md` (the `--queue` controls) and the `queue-up` SKILL.md as it was when it routed to them. | none |

| `skills/typo` | 2026-10-03 | One always-on line, "Typos", in the global instructions (`claude/global-CLAUDE.md`): the model has to notice a typo either way, and a skill cost a tool round trip each time | none |
| `skills/old-mission-skill-ab` | 2026-10-03 | Nothing: it is the earlier `mission` skill, kept for the 2026-07-26 A/B comparison under `artifacts/`. `mission` and `scrum` carry the work now | none |

`queue-up` itself stays installed for its in-session TodoList path only. Two more
skills gave only a part of themselves to a mod and stay installed:
`unity-bridge` (the `unity-sync` mod runs `sync` after `.cs` edits and shows the
result to the person) and `crucible` / `gauntlet` (Seat Guard 0.2.0 supplies the
route ledger's `actual` column).

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
