# Skill Tree — Architecture

**Status:** Draft for review · **Date:** 2026-06-11
**Companion docs:** [VISION.md](VISION.md) · [UX.md](UX.md) · [ROADMAP.md](ROADMAP.md)

System contract for the skill-tree installer: repo layout, registry data, apply engine,
bridge API, state stores, migration, and validation. Implementation-facing.

## 1. Repo layout promotion

The explorer, registry, and tree CLI graduate from `codex/**` to repo root — they are
cross-platform infrastructure (the registry already models both platforms; `PLATFORM_ONLY.tsv`
and `install.sh` set the precedent for root-level shared files).

```
skills/
├── explorer/            (from codex/explorer — UI, platform-neutral)
├── registry/            (from codex/registry — capabilities.yaml, skill-tree.yaml [source])
├── dist/                (generated, gitignored — managed lean homes per platform, §7)
├── scripts/
│   └── skill-tree.js    (from codex/scripts — CLI + bridge server)
├── install.sh           (unchanged role: bulk root linker; gains one guard, §7)
└── codex/               (keeps Codex-specific tooling: validate-codex-skills.sh, link script)
```

**Side-ownership note:** this move crosses the Claude/Codex boundary and is proposed, not
unilateral. Codex reviews and acks before Phase 0 lands. `AGENTS.md`/`CLAUDE.md` path
references update with the move. Until the ack, no `codex/**` file moves.

**Registry single-source:** `skill-tree.yaml` becomes the only hand-edited source;
`skill-tree.js build-registry` generates `skill-tree.json` from it. This retires the
"keep json and yaml in sync by hand" rule (the #1 standing drift hazard).

## 2. Registry coverage — draft tree design (PO review required)

~20 Claude skills lack registry entries today and only reach the explorer as bare
`PLATFORM_ONLY.tsv` nodes with no edges. Draft modeling below — **this table is the
review artifact** (decision #9). Capabilities marked **NEW** get added to
`capabilities.yaml`; capabilities marked *parity* already exist because a Codex agent
provides them — the Claude skill becomes that capability's Claude-side provider, which is
the capability-first design working as intended.

### Global core (group `core`, tier 0 — always-on at global scope, shown lit in the tree)

| Skill | Provides | Requires | Recommends | Unlocked by |
|---|---|---|---|---|
| spec-writer | spec-authoring **NEW** | — | — | — |
| code-wizard | pragmatic-coaching **NEW** | — | — | — |
| emoji-translator | emoji-translation **NEW** | — | — | — |
| changelog | changelog-curation *(parity)* | — | issue-tracker | — |

(alignment, shell-prompt, code-roast, spicy-code-roast already modeled; they re-group to `core`.)

### Coached build track (group `planning` / `autonomy`)

| Skill | Provides | Requires | Recommends | Unlocked by | Tier |
|---|---|---|---|---|---|
| feature-build | feature-building **NEW** | — | spec-authoring, issue-tracker, code-graph | — | 1 |
| proof-campaign | campaign-orchestration **NEW** | issue-tracker, product-roadmap | code-graph | roadmap | 4 |

### Quality constellation (group `quality` **NEW** — audits + stack reviewers)

| Skill | Provides | Requires | Recommends | Unlocked by | Tier |
|---|---|---|---|---|---|
| code-audit | codebase-audit **NEW** | — | code-graph | — | 2 |
| security-audit | backend-security-audit *(parity)* | — | code-graph | — | 2 |
| cpp-review | cpp-standards **NEW** | — | — | — | 1 |
| react-review | react-standards **NEW** | — | — | — | 1 |
| css | css-mastery **NEW** | — | — | — | 1 |
| tdd-coach | tdd-coaching *(parity)* | — | — | — | 1 |

### Domain advisors (group `planning`, tier 1, independent roots)

| Skill | Provides | Recommends |
|---|---|---|
| analytics-events | analytics-event-design *(parity)* | — |
| api-contract-designer | api-contract-design *(parity)* | — |
| cicd-pipeline | cicd-pipeline-design *(parity)* | docker-compose-design |
| data-pipeline | data-pipeline-design *(parity)* | database-schema-design |
| database-schema | database-schema-design *(parity)* | — |
| docker-compose | docker-compose-design *(parity)* | — |
| microservices | microservice-decomposition **NEW** | api-contract-design, database-schema-design |
| ml-integration | ml-serving-design *(parity: data-pipeline-design rec)* — provides **NEW** | data-pipeline-design |

Plus one new skill: **skill-tree** (the launcher, §6) — provides `skill-tree-ui` **NEW**,
group `core`, tier 0, global.

**New capabilities (11):** spec-authoring, pragmatic-coaching, emoji-translation,
feature-building, campaign-orchestration, codebase-audit, cpp-standards, react-standards,
css-mastery, microservice-decomposition, ml-serving-design (+ skill-tree-ui).

Node `position` values are assigned in a dedicated layout pass per UX.md (constellations by
group, radial tiers) — not hand-specified here. The 20 skills stay listed in
`PLATFORM_ONLY.tsv` (parity exemption is orthogonal); the explorer's PLATFORM_ONLY merge
already skips registry-managed entries, so no duplicate nodes.

## 3. Manifest (v2) — the per-project intent record

`.claude/project-primitives.json` (committable; the shareable reproduction recipe):

```json
{
  "version": 2,
  "platform": "claude",
  "scope": "local",
  "enabled": ["itr", "kgr", "sprint"],
  "providers": { "issue-tracker": "itr" },
  "materialization": {
    "default": "symlink",
    "overrides": {
      "sprint": {
        "mode": "copy",
        "baselineHash": "sha256:…",
        "localOverride": false,
        "copiedAt": "2026-06-11T00:00:00Z"
      }
    }
  }
}
```

Target-project hygiene: payload links/copies under `.claude/skills/` are gitignored in the
target project; the manifest is the thing you commit.

## 4. Apply engine (`skill-tree.js`)

New commands (existing `enable/disable/provider/status/validate` retained):

```
skill-tree.js apply   --project PATH [--platform claude|codex] [--scope local|global]
                      [--with-deps] [--copy id,…] [--dry-run]   # dry-run default in CLI
skill-tree.js update  --project PATH [id] [--pull|--keep]       # drift management
skill-tree.js diff    --project PATH id                          # unified diff, copy vs canonical
skill-tree.js loadout <list|apply NAME|save NAME> --project PATH
skill-tree.js adopt   --platform claude|codex                    # lean global: build dist, re-point home (§7)
skill-tree.js reset   --platform claude|codex                    # restore home symlink → canonical (all skills)
skill-tree.js serve   [--port 7777] [--project PATH]
skill-tree.js build-registry                                     # yaml → json
```

**Apply semantics**
1. Load manifest + registry; resolve providers; compute prerequisite closure.
   Unmet required capability → fail with the exact missing chain, or auto-enable it with
   `--with-deps` (the CLI twin of "Unlock chain").
2. Reconcile filesystem to manifest, per primitive:
   - symlink mode: `<project>/.claude/skills/<id>` → `<repo>/claude/skills/<id>`
   - copy mode: recursive copy; record `baselineHash` (hash of canonical payload tree)
   - disabled-but-present managed entries are removed. **Managed** = symlink pointing into
     this repo, or a copy recorded in `materialization`. Unmanaged files are never touched.
3. Register the project in the meta store (§8). Print/return the ordered list of changes
   (the bridge uses this ordering to sequence unlock animations).

**Update semantics (copies only; symlinks never drift)**

| Canonical vs baseline | Local vs baseline | Result |
|---|---|---|
| same | same | up to date |
| changed | same | fast-forward pull (auto, reported) |
| any | changed | **drift** → show diff → `pull` (overwrite local, reset baseline, clear override) or `keep` (set `localOverride: true`, re-baseline to current canonical hash so it only re-warns on the next canonical change) |

**Disable semantics:** disabling a primitive that enabled primitives require → list the
dependent subtree, confirm once, cascade-disable all of it. No flag to leave the tree
inconsistent (decision #6).

## 5. Bridge server

`skill-tree.js serve` — binds **127.0.0.1 only**, default port 7777. Serves the repo root
statically (replaces `python3 -m http.server`) plus:

| Endpoint | Purpose |
|---|---|
| `GET  /api/state?project=` | registry + manifest + **filesystem truth** (per-skill installed/mode) + context weights + meta (loadouts, stats) |
| `POST /api/enable` | `{project, id, chain}` → apply; returns ordered enabled list for animation |
| `POST /api/disable` | `{project, id, cascade}` → returns dependent list when confirmation needed |
| `POST /api/provider` | `{project, capability, id}` |
| `POST /api/loadout/apply` · `/api/loadout/save` | cinematic apply / save current set |
| `GET  /api/diff?project=&id=` | drift diff for a copied skill |
| `POST /api/update` | `{project, id, action: "pull"\|"keep"}` |

Explorer behavior: probe `/api/state` on load. Bridge present → live mode (no folder picker
needed; filesystem is truth; Enable installs). Bridge absent (plain static server) →
degraded mode: today's behavior (localStorage + File System Access manifest writing) with a
visible "pending apply — run `skill-tree.js apply`" banner. No auth: localhost, same-origin,
personal tool.

## 6. The `/skill-tree` launcher skill

New global Claude skill (`claude/skills/skill-tree/`): checks whether the bridge is up
(port probe), starts `serve` pointed at the current project if not, opens
`http://127.0.0.1:7777/explorer/?project=<cwd>`. Joins the global core (9th member);
gets a registry entry and a `PLATFORM_ONLY.tsv` line until Codex ports it.

**Known harness constraint (must be in the UX copy):** Claude Code loads the skill list at
session start. Newly enabled skills route **from the next session**, not mid-session. The
tree says so after each apply.

## 7. Global scope — the adopt/reset toggle *(rev. 2; supersedes the v1-final migration)*

Out of the box nothing changes: `~/.claude/skills` stays a symlink to the canonical
`claude/skills` — all skills, live, zero maintenance, exactly today's setup. The lean
global core is **opt-in, per platform, instantly reversible**. The toggle is just where the
home symlink points:

```
DEFAULT    ~/.claude/skills ─→ <repo>/claude/skills          (all skills, live)
ADOPTED    ~/.claude/skills ─→ <repo>/dist/claude/skills     (managed core set)
```

**`adopt --platform claude`** (idempotent)
1. Build `dist/claude/skills/` (generated, gitignored): one **relative** per-skill symlink
   back to canonical for each core-set member (the 9) — live-edit preserved, drift
   impossible, survives repo relocation.
2. Re-point the home symlink at `dist/claude/skills` (`ln -sfn`).
3. Write the global manifest `~/.claude/primitives.json` (`enabled` = core set) so the
   explorer's global scope reflects reality.
4. Record adoption state in the meta store.

**`reset --platform claude`** re-points the home symlink back to canonical (idempotent).
No backup ceremony either direction — canonical is never modified.

**Codex note:** `dist/codex/skills` must always include `.system` (the Codex installer and
harness require it); system skills are core by definition there. Whether/when Codex adopts
is Codex's call (§11) — the platforms toggle independently.

**`install.sh` adopt-awareness** (the one minimal shared edit; replaces the previously
planned marker-file guard): when the target skills symlink already points into `dist/`,
leave it alone and say so — "adopted; use `skill-tree.js reset` to revert" — instead of
silently re-pointing it to canonical and un-adopting the machine. `~/.claude/agents` and
`~/.claude/commands` stay whole-root symlinks (v1 scope).

## 8. Meta store — `~/.config/skill-tree/`

```
~/.config/skill-tree/
├── projects.json      # registered project paths (+ platform, last-applied)
├── loadouts.json      # named loadouts; ships with "Core Dev": itr, kgr, sprint, blitz, sprint-review
└── meta.json          # achievements unlocked, lifetime stats
```

Apply auto-registers projects. The scoreboard (v1.5) reads each registered project's **live
manifest** on demand — adoption stats are never stale copies. Missing/moved projects are
pruned on read.

## 9. Context weight

Per skill: `alwaysOnTokens ≈ len(description)/4` (the cost every session pays),
`onTriggerTokens ≈ len(SKILL.md body)/4`. Derived: **chain cost** = sum of always-on
weights over the transitive unmet prerequisite set (what enabling this node would really
add). Computed by the CLI/bridge from payload files, cached by mtime. Surfaced per UX.md
(node badge, inspector breakdown, project build total).

## 10. Validation & drift guards

- `skill-tree.js validate` extends to: every registry primitive's platform path exists on
  disk; json is up to date with yaml (`build-registry --check`); no dependency cycles;
  every `requires` capability has ≥1 provider on that platform.
- `validate-skills.sh` calls the above so one command still gates the repo.
- Existing parity/drift checks (`PARITY.tsv`, `PLATFORM_ONLY.tsv`) are unaffected.

## 11. Codex handoff

Everything below the UI is platform-parameterized (`--platform codex`, registry
`platforms.codex`, manifest paths from `manifest_paths`). What Codex decides on their
timeline: their global-core split, their launcher equivalent (Codex wording, no
`AskUserQuestion`-style references), porting the `skill-tree` skill, and whether/when to
run `adopt` for their side (their `dist` always carries `.system`, §7). Nothing in v1
blocks on this; nothing in v1 writes into `~/.codex`.
