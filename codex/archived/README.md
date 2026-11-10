# Retired Codex primitives

These payloads were removed from active discovery on 2026-11-06. They are
preserved for history, selective reference, and explicit experiments, not as
alternative workflows to run automatically. Nothing in this directory is an
installed skill or registry provider.

[manifest.json](manifest.json) lists every retired primitive and its replacement.
[../FLEET.md](../FLEET.md) describes the current operating model and migration.

- `skills/`: twelve former workflows, with their original resources intact.
- `agents/`: seventeen former role prompts, available as on-demand references.
- `commands/`: the audit-summary alias, consolidated into the active audit command.
- `references/`: legacy sprint, review, and roadmap schemas, retained for reading
  old artifacts rather than requiring that ceremony for new work.

Archived relative links may describe their original installed layout. Follow
current active skill contracts when using a historical checklist. In particular,
the retired backend-security and changelog roles should use the active
[security method](../skills/security-audit/SKILL.md) and
[release-note method](../skills/changelog/SKILL.md).

Gauntlet's deterministic image tools remain under `skills/gauntlet/assets/`.
Their preservation does not endorse automatic score-driven iteration, model
routing, commits, or transcript collection. Use them only for an explicitly
scoped experiment after checking the current environment and requirements.

Restoring a primitive requires moving it back deliberately, updating the active
registry and this manifest, reconciling platform-only/parity metadata, and
validating discovery. Do not place the same primitive in both roots.
