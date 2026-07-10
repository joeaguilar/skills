# Codex Primitive Validation

Snapshot: 2026-07-09, current working tree under `codex/`.

## Checks

- Current system skills from `~/.codex/skills/.system` are present under `codex/skills/.system`:
  `imagegen`, `openai-docs`, `plugin-creator`, `skill-creator`, `skill-installer`.
- System skill drift was audited against `~/.codex/skills/.system`. The repo
  keeps its enhanced `plugin-creator` copy instead of replacing it with the
  installed older copy; other system skill payloads match.
- Every repository-managed `codex/skills/**/SKILL.md` payload is represented in
  the primitive registry; validation compares the two sets directly.
- `~/.codex/skills` uses a real overlay: `.system` remains Codex-owned and
  non-system skills are linked individually. `~/.agents/skills` is treated as
  compatibility-only; duplicate names are audited and retired with dedicated
  scripts rather than loaded beside canonical providers.
- Each converted non-system skill currently has `agents/openai.yaml`.
- All current `codex/skills/**/SKILL.md` files have parseable YAML
  frontmatter with `name` and `description`.
- `codex/scripts/audit-installed-skills.sh` detects root symlinks, duplicate
  providers, and differing legacy payloads.
- Optional primitive roots are present for `codex/agents` and `codex/commands`.
- Current registry validates 54 primitives: 35 skills, 17 agents, and 2 commands.
- Codex validation enforces payload-to-registry coverage, so an installed skill
  cannot silently disappear from the explorer registry.
- The two primitive audit commands both provide `primitive-audit`, so provider routing is covered by a real registry path.
- Registry validation rejects required capabilities with no provider unless the capability is explicitly marked external.
- The explorer supports stale port metadata from `stale`, `stalePort`, `stale_port`, `portState`, or `port_state`.
- The explorer detector scans registry primitive type roots and shows both managed and unmanaged payloads for skills, agents, commands, and future markdown-file primitive types.
- The explorer Markdown Explorer renders registry `SKILL.md` files and detected markdown payloads from the selected folder.
- The browser installer is served from the repository root so the Claude and
  Codex platform switches can both load their payload markdown.
- The browser installer reads `PLATFORM_ONLY.tsv`, so Claude-only slash commands
  render as Claude platform nodes without Codex stubs.
- Current search found no `~/.claude/skills`, `AskUserQuestion`, or Claude-only tool API names in `codex/skills`. Remaining `CLAUDE.md` mentions are project-instruction-file fallbacks, not Claude skill paths or tool calls.
- Mutation-heavy skills disable implicit invocation. Codex skill descriptions
  state positive triggers and nearest exclusions, and `$skill` is the canonical
  invocation spelling.
- Claude legacy commands remain platform-specific unless they are deliberately
  ported as Codex-native commands with managed frontmatter and registry entries.
  The Codex command set currently contains the two primitive audit commands.

## Findings

- Non-system converted skills are not full directory copies:
  `roadmap/ROADMAP_SKILL_BRIEF.md` is omitted, `shell-prompt/README.md` is omitted, and `shell-prompt/append-prompt.sh` is relocated to `codex/skills/shell-prompt/scripts/append-prompt.sh`.
  The relocation is reflected in the converted shell-prompt `SKILL.md`; the omitted docs/brief should be either intentional or copied/documented.

## Recommended Fixes

1. Keep detailed schemas, prompt templates, and worked examples in routed
   `references/` files so orchestration skill bodies stay lean.
