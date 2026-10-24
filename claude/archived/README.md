# claude/archived — retired Claude primitives

Primitives that are no longer installed. `install.sh` links only `claude/skills`,
`claude/agents`, `claude/commands` and `claude/workflows`, so nothing under this
folder reaches `~/.claude` or a project's `.claude/`, and no session loads it.

They are kept, unedited, for reference: each file is the text its replacement was
built from. Layout mirrors the installed roots: `claude/archived/skills/<name>/`,
`claude/archived/agents/<name>.md`, `claude/archived/commands/<name>.md`.

The 2026-10-24 retro archived the rows dated that day. It counted use from five
months of typed prompts and a month of session transcripts on one machine: none of
them was typed, loaded or named in a prompt, and the skill list had grown past what
the harness shows (46 of 72 skills reached the model as a bare name, with no
description to route by).

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
| `skills/analytics-events`, `api-contract-designer`, `cicd-pipeline`, `data-pipeline`, `database-schema`, `docker-compose`, `microservices`, `ml-integration` | 2026-10-24 | Nothing: design-from-requirements personas imported from agents on 2026-05-30. The model designs these from the request itself | none (Codex keeps the agent forms) |
| `skills/code-wizard`, `css`, `emoji-translator`, `tdd-coach`, and `commands/tdd_process.md` | 2026-10-24 | Nothing: imported personas; `tdd_process` was `tdd-coach`'s companion | none |
| `skills/cpp-review`, `react-review`, `security-audit`, `code-audit`, `changelog`, `code-roast`, `spicy-code-roast` | 2026-10-24 | The built-in `/code-review`, `/security-review` and `/simplify` | all but `cpp-review` stay, Codex-only |
| `skills/queue-up` | 2026-10-24 | The `queue` mod and the built-in todo list | none |
| `agents/accessibility-compliance-auditor`, `api-docs-generator-role`, `cloud-cost-optimizer`, `e2e-test-architect`, `performance-test-engineer`, `user-guide-writer` | 2026-10-24 | Nothing: installed nowhere and never run; every subagent launch used a built-in type | stay, Codex-only |
| `skills/overdrive`, `mission`, `scrum`, `dual-blitz`, `ninja-meiyaku`, `run-the-rivers-dry`, `fastlane` | 2026-10-24 | The kept execution modes: `blitz` and `crossfire-blitz` (waves), `proof-campaign` and `rolling-campaign` (autonomous), `gauntlet` and `crucible` (rubric loops), `feature-build` and `forge-change` (one change). With fewer modes, the `fastlane` router has nothing to pick between | `overdrive`, `mission`, `dual-blitz`, `fastlane`, `run-the-rivers-dry` stay, Codex-only |
| `skills/groom` | 2026-10-24 | Grooming reads `~/.claude/COMPLEXITY.md` directly (the rubric `groom` inlined) | none |
| `skills/crossfire-review`, `codex-computer-use` | 2026-10-24 | `codex-seat` for a GPT reviewer seat; the built-in `/code-review` | none |
| `workflows/sprint-blitz-review.js` | 2026-10-24 | Nothing: never ran. `blitz` covers the same wave loop | none |
| `skills/plr` | 2026-10-24 | Nothing: the user retired it. The `plr` CLI was not installed on the Windows machine | stays, Codex-only |

Two more
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
