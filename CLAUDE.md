# CLAUDE.md

## What this is

The **canonical source for Claude Code skills** — the directory that takes over `~/.claude/skills`.
Author skills **here**; don't hand-edit copies under `~/.claude` (this repo is the upstream they sync from).

Each top-level directory is one skill, holding a `SKILL.md` (plus any helper scripts it ships).
A skill is a Markdown file with YAML frontmatter the harness reads to decide *when to fire* and a body it loads into context *to run*.

## Layout

```
<skill>/SKILL.md     one directory per skill (frontmatter + body)
COMPRESSION.md       caveman-compression method (read before shrinking a skill)
statusline.sh        Claude Code statusline script (not a skill)
codex/               Codex-compatible export of the same skills (see below)
.gitignore           ignores .DS_Store and *.bak local-sync backups
```

## The skills

**Sprint suite — coached, human-in-the-loop Scrum (verbose by design):**
- `sprint` — spec / `/plan` / conversation → groomed `itr` Sprint backlog (planning only).
- `blitz` — execute a backlog as conflict-free parallel agent *waves* (execution only; no commits).
- `sprint-review` — fill Outcomes/Demo/Retro, per-story acceptance, triage, close the epic (review only).
- `roadmap` — `docs/ROADMAP.md`, the cross-sprint map between spec and backlog.
- `story-style` — `STORY_STYLE.md`, the project's issue/ticket conventions (setup wizard).

**Autonomous:**
- `overdrive` — super-skill that condenses sprint+blitz+sprint-review into one hands-off loop (pre-plan every ticket's files → swarm → commit per wave → one visual-smoke gate). **Caveman-compressed** (see register below).

**Standalone:**
- `itr` — file issues into the project's `itr` tracker (the backlog CLI the sprint suite defers to).
- `kgr` — navigate/audit a codebase via its dependency graph instead of grep+read loops.
- `alignment` — relentlessly interview the user to stress-test a plan/design.
- `shell-prompt` — install a lightweight git-aware zsh prompt (ships `append-prompt.sh`, `README.md`).

> Skills produce artifacts **in target repos**, not here: `itr` backlog, `sprint/{folder}/plan.md`, `STORY_STYLE.md`, `docs/ROADMAP.md`, `sprint/CURRENT`. This repo only holds the skill *definitions*.

## SKILL.md conventions

- **Frontmatter** = `name:` + `description:`. The `description` is the router's signal — it must list concrete **trigger** phrases *and* explicit **"Do NOT trigger"** cases that route to a sibling skill. Mirror the density of the existing descriptions.
- **Body** = the canonical shared skeleton: title + intro, slash-invocation table, Roles & artifacts, numbered **Phases** (each `Announce: Phase N — …`), Principles, Don't. Keep terminology consistent across siblings (the sprint suite shares Scrum vocabulary on purpose).
- Skills that emit sub-agent prompts embed them verbatim; treat those as code.

## Authoring conventions

**Two verbosity registers — pick deliberately:**
- **Verbose** for coached, step-by-step, human-in-the-loop skills (`sprint`, `blitz`, `sprint-review`, `roadmap`, `story-style`). The prose *is* the product — announcements and the *why* of each gate. **Don't compress these.**
- **Caveman-compressed** for autonomous skills loaded into context every run (`overdrive`), where verbosity is pure token cost. Compress the prose "mouth"; preserve the executable "brain" (commands, thresholds, tables, schemas, guardrails) byte-for-byte. **Method: `COMPRESSION.md`.**

**Other:**
- Edit skills here; let the sync process push to `~/.claude` — don't author downstream.
- After a non-trivial skill change, sanity-check structure (fences balanced, every `--flag` referenced, phases present, thresholds/commands intact) — see the integrity checklist in `COMPRESSION.md`.

## codex/

A **Codex-compatible export** of the same skills, generated/linked from the root definitions — not a separate set to edit by hand.
- `codex/skills/` — the mirrored skills (+ a `.system` folder).
- `codex/registry/` — `skill-tree.{json,yaml}`, `capabilities.yaml`.
- `codex/explorer/` — a small web UI (`index.html`, `app.js`, `styles.css`) for browsing the tree.
- `codex/scripts/` — `link-codex-skills.sh`, `skill-tree.js`, `validate-codex-skills.sh`.
- `codex/ROADMAP.md`, `codex/VALIDATION.md`, `codex/backups/`.

**Workflow:** change the **root** skill, then re-run the codex link/validate scripts to refresh the mirror and registry. Don't edit `codex/skills/*` directly.
