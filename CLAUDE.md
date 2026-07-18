# CLAUDE.md

## What this is

The **canonical source for two parallel installable primitive distributions**: Claude payloads under `claude/` and Codex payloads under `codex/`. Skills remain the main primitive type, with `agents/`, `commands/`, and `workflows/` now managed as first-class roots. A root `install.sh` symlinks selected roots into global agent homes or local project folders.

Author **Claude** primitives in `claude/<primitive>/`; don't hand-edit installed copies under `~/.claude` or a target project's `.claude` directory. The Codex tree is a **separate, intentionally reworded port** — same intent, Codex phrasing (see "Two ports" below), not a byte copy.

## Layout

```
skills/                         (repo root)
├── install.sh                  unified installer: ./install.sh <claude|codex|both> [--apply]
├── validate-skills.sh          cross-tree parity + drift check
├── claude/skills/<skill>/SKILL.md     the Claude skill sources (10 skills)
├── claude/agents/  claude/commands/   optional Claude primitive roots
│                                      (commands/ also holds imported legacy commands)
├── claude/workflows/                  optional Claude-only primitive root: deterministic
│                                      multi-agent orchestration scripts (the Workflow tool).
│                                      No Codex counterpart — the Workflow tool doesn't exist
│                                      there, so this root is exempt from parity checks.
├── claude/settings.json               canonical ~/.claude/settings.json (config primitive)
├── claude/MODELS.md                    source of truth for the cost/intelligence/taste table + role bindings
├── claude/COMPLEXITY.md                grooming rubric: ticket complexity signals → tier → model route (benchmark-grounded)
├── claude/scripts/models.sh           `table` (inject the live table) + `check` (drift gate, wired into validate-skills.sh §6)
├── PLATFORM_ONLY.tsv                   intentional one-tree-only primitives (parity exemptions)
├── codex/
│   ├── skills/<skill>/SKILL.md + agents/openai.yaml   Codex ports
│   ├── agents/  commands/             optional Codex primitive roots
│   ├── skills/.system/                Codex system skills (Codex-only)
│   ├── PARITY.tsv                      per-skill reconcile baseline (drift check)
│   ├── registry/  explorer/  scripts/  backups/
├── CLAUDE.md  AGENTS.md  COMPRESSION.md  statusline.sh  .gitignore
```

Global installs link roots such as `~/.claude/skills`, `~/.claude/agents`, `~/.claude/workflows`, `~/.codex/skills`, and `~/.codex/commands`. Local installs link the same roots into a target project's `.claude/` or `.codex/` directory. Skills produce artifacts **in target repos** (`itr` backlog, `sprint/{folder}/plan.md`, `STORY_STYLE.md`, `docs/ROADMAP.md`), never here.

## The skills

**Sprint suite — coached, human-in-the-loop (verbose by design):** `sprint` (plan), `blitz` (parallel-wave execution), `sprint-review` (review/triage), `roadmap` (`docs/ROADMAP.md`), `story-style` (`STORY_STYLE.md`).
**Autonomous / multi-agent execution:** `overdrive` (condenses sprint+blitz+sprint-review into one hands-off loop — **caveman-compressed**, see below), `proof-campaign` (roadmap-bounded, evidence-first campaign), `rolling-campaign` (chains proof campaigns back-to-back across fresh contexts via an external headless driver), `dual-blitz` (two isolated blitz lanes for two main agents), `run-the-rivers-dry` (maximum-autonomy completion mode). `fastlane` is the **router** — it scans the project (read-only `claude/skills/fastlane/scripts/fastlane-scan.sh`) and recommends the safest fast workflow among these before execution, then hands off.
**Standalone:** `itr` (file issues), `kgr` (codebase graph), `alignment` (stress-test a plan), `shell-prompt` (zsh prompt).
**The Dojo — orchestration-primitive family (autonomous, ninja-voiced, caveman register):** `fan-of-agents`, `hundred-blades`, `shadow-duel`, `first-blood`, `splitting-blade`, `the-clan`, `relay`, `whetstone`, `scout-strike`, `drawn-steel`, `pre-mortem` — each a self-contained "blade" that slices a problem a different way. **`claude/DOJO.md` is the rack (catalog + composition) and the forge (authoring contract); composition lives there, never in a blade's body.**

## The workflows

`claude/workflows/*.js` are deterministic Workflow-tool scripts, not skills — they orchestrate fixed phases of `agent()`/`parallel()`/`pipeline()` calls rather than being interpreted by the main loop. Distinct from the sprint suite in that they trade the coached, per-story human touch for scripted repeatability, but they can still gate on a human: a script that must pause for approval simply stops and `return`s after the gated phase, and the caller resumes it later with `Workflow({scriptPath, resumeFromRunId, args})` — unchanged prior `agent()` calls cache-hit instantly, so only the newly-unlocked phase runs live. `sprint-blitz-review` is the first: it executes an already-groomed `itr` sprint backlog wave-by-wave (implement → adversarial review → repair → verify → commit), pausing for a smoke test after each wave and again before the closing sprint-review synthesis.

**Composed delivery workflows:** `forge-change` owns one explicit higher-order chain—read-only scout → focused implementation → adversarial duel → repair → verification → one local commit. It is not a blade, so the Dojo blade rule against sibling references and commits does not apply to its wrapper body.

## SKILL.md conventions

- **Frontmatter** = `name:` + `description:`. The `description` is the router's signal — list concrete **trigger** phrases *and* explicit **"Do NOT trigger"** routing to siblings. Mirror the density of the existing descriptions.
- **Body** = shared skeleton: title + intro, slash-invocation table, Roles & artifacts, numbered **Phases** (`Announce: Phase N — …`), Principles, Don't. Keep terminology consistent across siblings.

## Two ports, two registers

**Claude vs Codex (per-platform wording).** Codex ports are reworded for Codex (no `AskUserQuestion`, "Codex subagent", `AGENTS.md`/`CODEX.md` instead of `CLAUDE.md`). That difference is intentional — `validate-skills.sh` checks *set parity and drift*, not content equality. Edit Claude skills in `claude/skills/`; when a change needs to reach Codex, port it in `codex/skills/` (Codex wording) and refresh that skill's line in `codex/PARITY.tsv`.

**The porting contract** (enforced by `codex/scripts/validate-codex-skills.sh`): every non-`.system` Codex skill needs an `agents/openai.yaml` alongside its `SKILL.md`, and the validator flags these Claude-isms as non-Codex references — `.claude/skills`, `AskUserQuestion`, `subagent_type`, `run_in_background`, `SendMessage`. Replace them with Codex-native user-input / subagent / background-session wording when porting.

**Intentional divergence (`PLATFORM_ONLY.tsv`).** Parity is the default, but the two trees may legitimately diverge in **both** directions — Claude carries legacy/native commands not yet ported, and Codex carries skills Claude can't run (e.g. image generation). Declare any such one-tree-only primitive in the repo-root `PLATFORM_ONLY.tsv` (`platform  root  name`) and `validate-skills.sh` exempts it from the parity check (agents/commands payloads listed there also skip the frontmatter lint, since they're imported as-is). To **graduate** a primitive to parity, add its peer in the other tree and delete its line from `PLATFORM_ONLY.tsv` — the validator then enforces parity for it again.

**Verbose vs caveman (per-skill density) — pick deliberately:**
- **Verbose** for coached, step-by-step skills (`sprint`, `blitz`, `sprint-review`, `roadmap`, `story-style`). The prose *is* the product. Don't compress.
- **Caveman-compressed** for autonomous skills loaded every run (`overdrive`). Compress prose; preserve commands/thresholds/tables/guardrails byte-for-byte. Method: **`COMPRESSION.md`**.

## Working here

- **Install/relink:** `./install.sh claude` (or `codex`/`both`). Dry-run by default; `--apply` to act; `--restore` to roll back. Use `--all-primitives` for `skills`, `agents`, `commands`, and `workflows`; use `--local /path/to/project` for project-scoped installs. `workflows` is Claude-only — selecting it (or `--all-primitives`) for `codex` is a no-op since `codex/workflows/` doesn't exist and isn't expected to. The opt-in `config` primitive (`--primitive config` or `--primitives …,config`) links individual home files instead of a directory root — for Claude, `settings.json` + `statusline.sh` into `~/.claude/`; for Codex it is a no-op. It is **not** part of `--all-primitives`.
- **Validate after any skill change:** `./validate-skills.sh` — flags a skill present in one tree but not the other, any Codex port whose Claude source drifted past its `PARITY.tsv` baseline, and (§6) any skill whose inline model table drifted from `claude/MODELS.md`. Intentional one-tree-only primitives are exempted via `PLATFORM_ONLY.tsv` (see "Two ports"). `claude/workflows/` is exempt from cross-tree parity by design (see Layout), not via `PLATFORM_ONLY.tsv`.
- **Model values:** `claude/MODELS.md` is the single source of truth for the cost/intelligence/taste scores and the role→model bindings skills route by (bulk/generalist/taste/floor/…). Edit it, then `./validate-skills.sh` §6 names every skill table that now disagrees. Skills route by **role**, so a model swap is usually a one-line binding edit. A skill can inject the live table into its own context with `` !`claude/scripts/models.sh table` `` (dynamic context injection — re-reads MODELS.md each run, so it can't drift).
- Author Claude skills in `claude/skills/`; let `install.sh` link them — never author under `~/.claude`.

## Primitive tree (capability-first)

The primitives form a dependency graph keyed on **capabilities**, not skill names — so a future Linear/Jira skill could satisfy `issue-tracker` the way `itr` does today. Cross-type dependencies are allowed: agents can require skills, skills can require agents or commands, and commands can require skills. `itr` provides `issue-tracker`; `kgr` provides `code-graph`; `sprint` requires both and provides `sprint-planning`; `primitive-architect-agent` requires `skill-authoring`; both primitive audit commands require `primitive-architecture` and provide `primitive-audit`, so provider selection is exercised. This graph is encoded in `codex/registry/` — `capabilities.yaml` and `skill-tree.{json,yaml}` (legacy filename, primitive-aware schema), which **must be kept in sync with each other**. `codex/explorer/` is a static web UI that renders the tree with tabs for skills, agents, commands, and future types, switches between Claude/Codex platform state, can scan selected folders for managed/unmanaged primitive payloads, and renders selected markdown sources.

## codex/ tooling

A Codex-compatible export: `codex/skills/` (ports + `.system`), optional `codex/agents/` and `codex/commands/`, `codex/registry/`, `codex/explorer/`, `codex/scripts/` (`skill-tree.js` primitive registry CLI, `validate-codex-skills.sh` deep checks, `link-codex-skills.sh` legacy skills installer), `codex/PARITY.tsv`. Edit the Claude source first, then re-port into the matching Codex primitive root (Codex wording) and update `PARITY.tsv` + the registry when a skill changes. See `AGENTS.md` for the full Codex-side workflow.

```bash
node codex/scripts/skill-tree.js validate        # registry consistency
node codex/scripts/skill-tree.js status --project /path   # a project's enabled primitives
node codex/scripts/skill-tree.js provider primitive-audit primitive-audit-summary-command --project /path
node codex/scripts/skill-tree.js status --scope global    # global Codex primitive state
node --check codex/explorer/app.js && node --check codex/scripts/skill-tree.js   # after JS edits
python3 -m http.server 8765                      # serve repo-root installer at /
```

The browser installer is launched from the repo root at `http://127.0.0.1:8765/` so it can load both `claude/**` and `codex/**` payload markdown. Per-project primitive enablement lives in `.claude/project-primitives.json` or `.codex/project-primitives.json` inside the **target** project, never in canonical roots. Legacy project-skills manifests are still read for compatibility.

## Side ownership

Claude owns Claude-side files (`claude/**`, Claude-facing guidance, and Claude install/config behavior) and may edit shared repo-level files when the task requires it. Only a cross-platform edit into Codex-owned files (`codex/**` or Codex-only guidance/config) requires an explicit one-off user exception. Shared files such as `install.sh`, `validate-skills.sh`, `PLATFORM_ONLY.tsv`, and root docs are not cross-side edits; keep those changes minimal and relevant. Codex mirrors or ports its side separately in Codex wording unless the user grants that exception.
