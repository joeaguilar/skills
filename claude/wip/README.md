# claude/wip — unfinished Claude primitives

Drafts that are not ready to be loaded. `install.sh` links only `claude/skills`,
`claude/agents`, `claude/commands` and `claude/workflows`, so nothing under this
folder reaches `~/.claude` or a project's `.claude/`, and no session loads it.

Layout mirrors the installed roots: `claude/wip/skills/<name>/SKILL.md`.

| Draft | Here since | State |
|---|---|---|
| `skills/heroic` | 2026-10-03 | Stub: section headings with no bodies, plus a pasted copy of `crucible`'s frontmatter. Its `assets/` (AXES.md, SCHEMAS.md) are its own drafts and differ from `crucible`'s. |

## Rules

- A draft graduates with `git mv claude/wip/skills/<name> claude/skills/<name>`,
  then `./validate-skills.sh`: it needs a Codex peer or a `claude skills <name>`
  line in `PLATFORM_ONLY.tsv`.
- A name may live in one place only. `validate-skills.sh` §8 fails when the same
  name is under `claude/skills` and under `claude/wip/skills` or
  `claude/archived/skills`.
- Retired primitives go to `claude/archived/`, not here.
