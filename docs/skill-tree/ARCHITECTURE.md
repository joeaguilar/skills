# Skill Tree — Architecture

**Status:** Draft for review · **Date:** 2026-06-11 · **Rev. 3:** 2026-07-25
**Companion docs:** [VISION.md](VISION.md) · [UX.md](UX.md) · [ROADMAP.md](ROADMAP.md)

**Rev. 3 changes §3, §4, and §7:** the global home becomes a real directory of managed
**copies** alongside untouched unmanaged skills; `dist/` and the home-symlink toggle are
retired. §§1–2 and 5–6 are unaffected — notably §5's dual live/degraded bridge is confirmed
as specified.

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

## 3. Manifest (v2) — the intent record *(rev. 3)*

Two scopes, one schema. The manifest is **desired state plus ownership**: `apply` reconciles
the filesystem to it, and anything it does not name is unmanaged and untouchable.

**Global — `~/.claude/primitives.json`** (per-machine state; not committed, not in this repo).
The single canonical path for global scope — no fallback chain, no candidate list:

```json
{
  "version": 2,
  "platform": "claude",
  "scope": "global",
  "library": "/Users/josefaguilar/AI_Projects/skills",
  "managed": {
    "skills": {
      "blitz":  { "mode": "copy", "baseline": "sha256:…", "installedAt": "2026-07-25T00:00:00Z", "localOverride": false },
      "sprint": { "mode": "copy", "baseline": "sha256:…", "installedAt": "2026-07-25T00:00:00Z", "localOverride": true }
    },
    "agents":    { "primitive-architect.md":   { "mode": "copy", "baseline": "sha256:…", "installedAt": "…" } },
    "commands":  { "primitive-audit.md":       { "mode": "copy", "baseline": "sha256:…", "installedAt": "…" } },
    "workflows": { "sprint-blitz-review.js":   { "mode": "copy", "baseline": "sha256:…", "installedAt": "…" } }
  },
  "providers": { "issue-tracker": "itr" }
}
```

**Per-project — `.claude/project-primitives.json`** (committable; the shareable reproduction
recipe). Same shape, `"scope": "local"`, plus the enabled/provider selections the explorer
already writes. Payload copies under `.claude/skills/` are gitignored in the target project;
the manifest is the thing you commit.

**Schema notes**

- `managed` is the **ownership set**, keyed by primitive root. Its entries are the only paths
  any flow may create, modify, refresh, or remove. Anything present on disk but absent here is
  unmanaged, permanently. One selector, one engine, one manifest across all four roots — the
  primitive type is a parameter, never a separate code path (decision #31).
- **The payload unit differs by root**, and only this differs:

  | Root | Unit | Installed path | Baseline covers |
  |---|---|---|---|
  | `skills` | directory | `<home>/skills/<id>/` | the payload tree |
  | `agents` | single `.md` | `<home>/agents/<id>.md` | the file |
  | `commands` | single `.md`, optionally namespaced | `<home>/commands/[<ns>/]<id>.md` | the file |
  | `workflows` | single `.js` | `<home>/workflows/<id>.js` | the file |

- **Ownership is file-granular, not directory-granular.** A skill owns its whole directory, so
  managed and unmanaged never interleave there. Agents, commands, and workflows are flat files
  sharing one directory with the user's own, so `~/.claude/agents/` will routinely hold managed
  and unmanaged files side by side. Every rule below therefore applies per *entry*, never per
  containing directory — no flow may clear, rebuild, or "sync" a root directory as a unit.
- `mode` is `"copy"` by default and in practice always (decision #23). The field is retained
  so a future `"link"` mode is expressible, but linking is not offered for the global home —
  it reintroduces the propagation hazard the copy model exists to prevent.
- `baseline` is the hash of the **library payload tree at install/refresh time**. It is what
  makes "behind" and "locally edited" distinguishable — see §4's update table.
- `library` records which checkout a home was installed from, so a moved or missing library is
  diagnosed ("library not found at …") rather than silently treated as "everything drifted".
- No entry is ever written for a skill the flow did not itself materialize.

## 4. Apply engine (`skill-tree.js`)

New commands (existing `enable/disable/provider/status/validate` retained):

```
skill-tree.js apply     [--project PATH | --global] [--platform claude|codex]
                        [--with-deps] [--dry-run]                # dry-run default in CLI
skill-tree.js status    [--project PATH | --global]              # managed / unmanaged / behind / drifted
skill-tree.js refresh   [--project PATH | --global] [id…] [--all] [--keep|--pull]
skill-tree.js promote   [--project PATH | --global] id           # installed → library working tree (§4 guards)
skill-tree.js diff      [--project PATH | --global] id           # unified diff, installed vs library
skill-tree.js uninstall [--project PATH | --global] id…          # move to backups, never delete
skill-tree.js loadout   <list|apply NAME|save NAME> --project PATH
skill-tree.js migrate   --platform claude --global               # one-time: root symlink → overlay (§7)
skill-tree.js serve     [--port 7777] [--project PATH]
skill-tree.js build-registry                                     # yaml → json
```

**Apply semantics**
1. Load manifest + registry; resolve providers; compute prerequisite closure.
   Unmet required capability → fail with the exact missing chain, or auto-enable it with
   `--with-deps` (the CLI twin of "Unlock chain").
2. Reconcile filesystem to manifest, per primitive *(rev. 3)*:
   - **install**: recursive copy of the library payload into `<home>/skills/<id>`; record
     `baseline` = hash of the library payload tree, and `installedAt`.
   - **uninstall** (manifest entry removed, or explicit `uninstall`): move the payload to
     `~/.claude/.primitive-backups/<ts>/<id>/`, then drop the manifest entry. Never `rm -rf`.
   - **Managed** = present in the manifest's `managed` map. That is the *whole* definition —
     it is no longer inferred from a symlink target, because inference cannot distinguish a
     user's own symlink from ours. Unmanaged entries are never read, written, moved, or
     reported.
   - Nothing in any flow writes to the library. `claude/skills/` is opened read-only.
3. Register the project in the meta store (§8). Print/return the ordered list of changes
   (the bridge uses this ordering to sequence unlock animations).

**Destructive-operation policy** *(rev. 3 — decision #26)*

Four rules, each of which independently blocks the propagation class in VISION problem #5:

1. **Never delete.** Uninstall and overwrite-on-refresh both move the outgoing payload to
   `~/.claude/.primitive-backups/<ts>/` first. Recovery is always a `mv` away.
2. **Never act on the unproven.** A path is writable only if it is manifest-managed *and*
   its content hashes to its recorded `baseline`. Anything else halts with a diff and asks.
3. **Never resolve through a link.** The engine operates on real directories. Managed paths
   are `lstat`-checked; if a managed path is unexpectedly a symlink, it is reported, not
   followed. This removes the trailing-slash and write-through cases entirely.
4. **One explicit write path to the library — never an ambient one.** *(Amended rev. 3.)*
   The hazard being eliminated is *accidental* propagation: with symlinks, every `rm` and
   every editor save in the home reaches `claude/skills/` whether you meant it or not. A
   single deliberate, named, reviewable command (`promote`, below) is the opposite of that —
   it makes the library editable *from* the home without ever making it *exposed to* the
   home. Nothing else in the system writes to `claude/skills/`, and `promote` never runs
   as a side effect of `apply`, `refresh`, or anything the UI does implicitly.

**Update semantics** *(rev. 3: every managed skill is a copy, so this governs all of them —
it is no longer an opt-in path)*

| Library vs baseline | Installed vs baseline | State | Resolution |
|---|---|---|---|
| same | same | **up to date** | nothing to do |
| changed | same | **behind** | fast-forward pull (safe; the local copy has no edits to lose) |
| same | changed | **locally edited** | three-way reconcile ↓ |
| changed | changed | **conflict** | three-way reconcile ↓, with both diffs shown; `promote` requires explicit confirmation because it would discard the library's newer changes |

**Three-way reconcile** — offered whenever the installed copy differs from its record. Order
and defaults are deliberate: safest first, destructive-to-source last.

| # | Action | Effect | Notes |
|---|---|---|---|
| 1 | **`keep`** — leave the skill alone ***(default)*** | Sets `localOverride: true` and re-baselines to the current library hash, so it only re-warns on the *next* library change. Neither side is written. | The default exists to make accidental overwrites impossible: taking no action, or dismissing the prompt, always lands here. Never silently upgrades to another action. |
| 2 | **`pull`** — replace from `claude/skills` | Backs the installed payload up to `.primitive-backups/<ts>/`, re-copies from the library, resets `baseline`, clears `localOverride`. | The ordinary update. Destroys only home-side edits, and those are archived first. |
| 3 | **`promote`** — move the update *into* `claude/skills` | Writes the installed payload into the library working tree, then re-baselines the entry to the new hash so it reads as up to date. | **Listed last because it is the only action that can reach the source.** Guards below. |

**`promote` guards.** This is the system's one write path into the library, so it is fenced:

- **Working tree only, never a commit.** `promote` writes files and stops. The change lands
  as an ordinary unstaged diff for the human to review with `git diff` and commit or discard.
  The tool never stages, never commits, never pushes.
- **Refuses on a dirty target.** If `claude/skills/<id>/` already has uncommitted changes,
  `promote` halts — otherwise it would bury un-reviewed work with no way back.
- **Refuses on conflict without explicit confirmation.** In the *conflict* row the library has
  also moved; promoting would discard that. Requires a typed confirmation after showing both
  diffs.
- **Scoped to one skill's directory.** `promote <id>` may write only under
  `claude/skills/<id>/`. It cannot touch other skills, the Codex tree, or repo-level files.
- **Never bulk.** No `--all`. Each promotion is one named skill, one decision.

Net effect: you can edit a skill in `~/.claude/skills`, try it in a live session, and then
deliberately promote it back into the library — **without** the library ever being exposed to
casual modification from the home. That is precisely the property symlinks cannot provide,
since they offer the write path *always* and the review step *never*.

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
| `POST /api/update` | `{project, id, action: "keep"\|"pull"\|"promote"}` — `keep` is the default the UI preselects; `promote` is rendered last, visually separated, and requires a confirm step naming the library path it will write (§4 guards) |

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

## 7. Global scope — the managed overlay *(rev. 3; supersedes the rev. 2 adopt/reset toggle)*

**Every managed root** — `skills`, `agents`, `commands`, `workflows` — becomes a **real
directory** in which managed copies and the user's own primitives coexist. No home root is a
symlink at any level, and `dist/` is retired. This is one selector over all four roots, not a
skills feature with three later ports: the explorer already carries per-type tabs, and the
registry already models 54 primitives across types, so the type is a filter in the UI and a
parameter in the engine.

```
BEFORE (today)   ~/.claude/skills   ─→ <repo>/claude/skills     (symlink; all 68, live)
                 ~/.claude/agents   ─→ <repo>/claude/agents     (symlink; all 7)
                 ~/.claude/commands ─→ <repo>/claude/commands   (symlink; all 3)
                 └── no unmanaged primitive can exist in ANY root;
                     the home can delete the library through any of them

AFTER            ~/.claude/skills/                               (real directory)
                 ├── blitz/               managed copy  ← manifest, baseline sha256
                 └── my-experiment/       UNMANAGED     ← invisible to every flow

                 ~/.claude/agents/                               (real directory)
                 ├── primitive-architect.md  managed copy  ← manifest, baseline sha256
                 └── my-own-agent.md         UNMANAGED    ← invisible to every flow
                     ▲ managed and unmanaged FILES share this directory —
                       ownership is per entry, never per directory
```

Ownership is decided **only** by `~/.claude/primitives.json` (§3). The library is read-only
to all flows, so no operation performed in the home can reach `claude/skills/`.

**`migrate --platform claude --global [--root skills|agents|commands|workflows]`** — the
one-time conversion, idempotent, dry-run by default. Runs per root (default: all four), so a
root can be migrated and verified before the next one follows:

1. Refuse unless `~/.claude/<root>` is a symlink into a known library (already migrated →
   report and exit 0). A root that does not exist yet — `~/.claude/workflows` today — is
   created empty with no managed entries.
2. Back the root symlink up to `~/.claude/.primitive-backups/<ts>/<root>-root-symlink`.
3. Create the real directory and copy in every primitive that was reachable before, so the
   installed set is **behaviorally identical** the moment migration finishes.
4. Write the manifest marking exactly those entries managed under their root key, each with
   its `baseline` hash.
5. Print the resulting managed/unmanaged census per root.

Reversal is restoring the backed-up symlink; the library was never touched, so reversal is
lossless by construction rather than by ceremony.

**Install / uninstall / refresh** (the flows the UI drives)

| Flow | Effect on home | Effect on library |
|---|---|---|
| install `<root>/<id>` | copy library payload → `<home>/<root>/<id>`; add manifest entry + baseline | none (read-only) |
| uninstall `<root>/<id>` | move payload → `.primitive-backups/<ts>/<root>/`; drop manifest entry | none |
| refresh `<root>/<id>` | back up current payload, re-copy from library, re-baseline | none |
| any op on an unmanaged id | **refused** — "not managed; the installer will not touch it" | none |

**Refresh / "behind" detection** (requirement #3, decision #27): a managed primitive is
*behind* when its `baseline` no longer matches the library payload hash while the installed
copy still matches `baseline` — i.e. the library moved and the local copy didn't. `status`
reports the count per root; `serve` surfaces it on load as a suggestion. Refresh never runs on
its own.

**Flat-file root rules** *(the adaptation flat roots need, decision #32)*. Skills are isolated
by their own directory; agents, commands, and workflows are not, so three rules carry the
weight that directory isolation carries for skills:

1. **Install refuses to overwrite an existing unmanaged file.** If `~/.claude/agents/foo.md`
   exists and is not in the manifest, installing the library's `foo.md` halts with a name
   collision and a suggested rename. It never assumes the user's file is a stale copy of ours.
   Collisions are far likelier here than for skills, since a flat root is a single namespace.
2. **Uninstall removes exactly one file** and prunes a containing namespace directory only if
   the installer created it *and* it is now empty. A directory holding any unmanaged file is
   never removed.
3. **No root is ever reconciled as a unit.** There is no "sync the agents directory" operation
   — only per-entry install, uninstall, and refresh. This is what makes an unmanaged file's
   survival structural rather than a special case someone has to remember.

Namespaced commands (`commands/<ns>/<name>.md`) are supported by these rules; the library has
none today, so the path is specified but unexercised — the test suite covers it anyway.

**Codex note:** the same overlay applies if Codex adopts it, with `.system` always present —
`install_codex_skills` in `install.sh` is already an overlay of exactly this shape (real dir,
preserved `.system`, per-entry management), so the pattern is proven in this repo. Whether
Codex moves to copies is Codex's call (§11); nothing here writes into `~/.codex`.

**`install.sh` overlay-awareness** (the one shared edit, larger than the rev. 2 guard it
replaces): `install_root` currently replaces the target with a root symlink, which would
destroy the overlay and silently re-expose the library to home-side deletion. It must detect a
migrated root — real directory plus a valid manifest — and reconcile per-entry against the
manifest instead of re-linking, reporting managed and unmanaged counts. This applies to **all
four roots**, since `install.sh` links each of them the same way today. Re-running
`./install.sh claude --apply` on a migrated machine must be a no-op, and must never adopt an
unmanaged primitive. Roots may be migrated one at a time, so `install_root` must handle a
mixed machine — some roots overlaid, others still whole-root symlinks — without complaint.

**Out of scope:** the opt-in `config` primitive (`settings.json`, `statusline.sh`), which links
individual home *files* rather than a root. It carries a sharper version of the same hazard —
the harness itself rewrites `~/.claude/settings.json` when permissions or config change, so a
linked settings file means Claude Code writes into this git repo. Not linked on this machine
today (`~/.claude/settings.json` is a real file), so there is nothing live to fix; worth its
own decision before anyone runs `--primitive config`.

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
- *(rev. 3)* Home integrity, via `status`: every manifest entry exists on disk; every managed
  path is a real directory and not a symlink; every managed entry still exists in the library
  (a removed library skill surfaces as *orphaned*, never as a silent uninstall); and the
  unmanaged census is reported explicitly so "the installer is ignoring these" is always
  visible rather than assumed.

## 11. Codex handoff

Everything below the UI is platform-parameterized (`--platform codex`, registry
`platforms.codex`, manifest paths from `manifest_paths`). What Codex decides on their
timeline: their global-core split, their launcher equivalent (Codex wording, no
`AskUserQuestion`-style references), porting the `skill-tree` skill, and whether/when to
run `adopt` for their side (their `dist` always carries `.system`, §7). Nothing in v1
blocks on this; nothing in v1 writes into `~/.codex`.
