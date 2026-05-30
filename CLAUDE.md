# CLAUDE.md

## What this is

The **canonical source for two parallel skill distributions**: the **Claude** skills under `claude/skills/` and the **Codex** ports under `codex/skills/`. A root `install.sh` symlinks each tree into its agent home (`~/.claude/skills → claude/skills`, `~/.codex/skills → codex/skills`).

Author **Claude** skills in `claude/skills/<skill>/`; don't hand-edit the installed copies under `~/.claude` (that path is just a symlink back here). The Codex tree is a **separate, intentionally reworded port** — same skills, Codex phrasing (see "Two ports" below), not a byte copy.

## Layout

```
skills/                         (repo root)
├── install.sh                  unified installer: ./install.sh <claude|codex|both> [--apply]
├── validate-skills.sh          cross-tree parity + drift check
├── claude/skills/<skill>/SKILL.md     the Claude skill sources (10 skills)
├── codex/
│   ├── skills/<skill>/SKILL.md + agents/openai.yaml   Codex ports
│   ├── skills/.system/                Codex system skills (Codex-only)
│   ├── PARITY.tsv                      per-skill reconcile baseline (drift check)
│   ├── registry/  explorer/  scripts/  backups/
├── CLAUDE.md  AGENTS.md  COMPRESSION.md  statusline.sh  .gitignore
```

`~/.claude/skills` and `~/.codex/skills` are symlinks created by `install.sh`. Skills produce artifacts **in target repos** (`itr` backlog, `sprint/{folder}/plan.md`, `STORY_STYLE.md`, `docs/ROADMAP.md`), never here.

## The skills

**Sprint suite — coached, human-in-the-loop (verbose by design):** `sprint` (plan), `blitz` (parallel-wave execution), `sprint-review` (review/triage), `roadmap` (`docs/ROADMAP.md`), `story-style` (`STORY_STYLE.md`).
**Autonomous:** `overdrive` — condenses sprint+blitz+sprint-review into one hands-off loop (**caveman-compressed**, see below).
**Standalone:** `itr` (file issues), `kgr` (codebase graph), `alignment` (stress-test a plan), `shell-prompt` (zsh prompt).

## SKILL.md conventions

- **Frontmatter** = `name:` + `description:`. The `description` is the router's signal — list concrete **trigger** phrases *and* explicit **"Do NOT trigger"** routing to siblings. Mirror the density of the existing descriptions.
- **Body** = shared skeleton: title + intro, slash-invocation table, Roles & artifacts, numbered **Phases** (`Announce: Phase N — …`), Principles, Don't. Keep terminology consistent across siblings.

## Two ports, two registers

**Claude vs Codex (per-platform wording).** Codex ports are reworded for Codex (no `AskUserQuestion`, "Codex subagent", `AGENTS.md`/`CODEX.md` instead of `CLAUDE.md`). That difference is intentional — `validate-skills.sh` checks *set parity and drift*, not content equality. Edit Claude skills in `claude/skills/`; when a change needs to reach Codex, port it in `codex/skills/` (Codex wording) and refresh that skill's line in `codex/PARITY.tsv`.

**Verbose vs caveman (per-skill density) — pick deliberately:**
- **Verbose** for coached, step-by-step skills (`sprint`, `blitz`, `sprint-review`, `roadmap`, `story-style`). The prose *is* the product. Don't compress.
- **Caveman-compressed** for autonomous skills loaded every run (`overdrive`). Compress prose; preserve commands/thresholds/tables/guardrails byte-for-byte. Method: **`COMPRESSION.md`**.

## Working here

- **Install/relink:** `./install.sh claude` (or `codex`/`both`). Dry-run by default; `--apply` to act; `--restore` to roll back.
- **Validate after any skill change:** `./validate-skills.sh` — flags a skill present in one tree but not the other, and any Codex port whose Claude source drifted past its `PARITY.tsv` baseline. (`overdrive`'s Codex port is currently flagged stale — pending re-port to the caveman rewrite.)
- Author Claude skills in `claude/skills/`; let `install.sh` link them — never author under `~/.claude`.

## codex/

A Codex-compatible export with its own tooling: `codex/skills/` (ports + `.system`), `codex/registry/` (`skill-tree.{json,yaml}`, `capabilities.yaml`), `codex/explorer/` (web UI), `codex/scripts/` (`link-codex-skills.sh` legacy installer, `skill-tree.js`, `validate-codex-skills.sh`), `codex/PARITY.tsv`. Edit the Claude source first, then re-port into `codex/skills/` and update `PARITY.tsv` + the registry. See `AGENTS.md` for the Codex-side workflow.
