# Skill Tree — Vision

**Status:** Draft for review · **Date:** 2026-06-11 · **Source:** /alignment session (PO: Goldboy)
**Rev. 2 (same day):** second alignment replaced the one-way global migration with a reversible per-platform `adopt`/`reset` toggle — see decisions #19–22.
**Rev. 3 (2026-07-25):** the global installer is re-specified around **managed vs unmanaged** skills living side by side in a real `~/.claude/skills` directory, with managed skills **copied** rather than linked. Rev. 2's `dist/` + home-symlink mechanism is retired — see decisions #23–28.
**Companion docs:** [ARCHITECTURE.md](ARCHITECTURE.md) · [UX.md](UX.md) · [ROADMAP.md](ROADMAP.md)

## The problem

1. **Context bloat.** All Claude skills are globally symlinked, so every session in every
   directory carries every skill description in its context — including domain advisors and
   sprint machinery that most sessions never touch. *(Rev. 3: the library was 32 skills when
   this was written and is **68** today — the problem has doubled since.)*
2. **All-or-nothing installation.** `install.sh` links whole roots. There is no way to give one
   project `itr` + `kgr` + `sprint` and another project nothing.
3. **The tree is decorative.** The explorer already renders a prerequisite-checked skill tree,
   but clicking Enable only writes a manifest no other tool reads. Nothing is actually installed.
4. **There is nowhere to put a skill of your own.** *(rev. 3)* Because `~/.claude/skills` is
   itself a symlink into this repo, a hand-written skill dropped into the home lands in the
   library's working tree and appears in `git status`. An unmanaged skill cannot currently exist.
5. **The home can destroy the library.** *(rev. 3)* Every path *through* a managed symlink
   resolves into `claude/skills/`. Verified on macOS: `rm -rf ~/.claude/skills/<id>/` — with a
   trailing slash — deletes the source directory outright, and `rm ~/.claude/skills/<id>/SKILL.md`
   deletes the real library file. Housekeeping in the home must never be able to reach the library.

## The vision

**Skills are enabled per project through a skill tree, and enabling one really installs it.**

- Out of the box nothing changes: the global home carries every skill, exactly as today.
  **Adopting** the system re-points the home at a small **always-on core** of conversational
  skills; everything workflow-, stack-, or domain-shaped is then enabled per project, so
  context cost is only paid where the skill is used. **Reset** restores the old world
  instantly — adoption is a toggle, not a migration.
- Each project is a **fresh run** — roguelike. You open the tree on a new repo at tier 0 and
  build it up, or apply a saved **loadout** for your standard opening build.
- Clicking Enable on an unlocked node **materializes a real symlink** into the project's
  `.claude/skills/` immediately. The unlock burst is honest: the skill exists when the
  particles land.
- The dependency graph is the progression system. `overdrive` is expensive because it truly
  requires five capabilities below it — the tree makes that cost visible (in nodes *and* in
  always-on tokens) instead of hiding it.
- Gamification is **informational, not buzzword**: context-weight budgets, branch completion,
  cross-project adoption scoreboards. Every game surface answers a real question.

### A day in the life (end state)

```
$ cd ~/new-project && claude
> /skill-tree
  → bridge starts, browser opens the constellation for this project (all nodes dark)
  → apply loadout "Core Dev" — itr, kgr, sprint, blitz, sprint-review unlock in
    sequence, bursts marching up the tree; build readout: "5/24 · ~1.4k always-on tokens"
  → click overdrive (locked) → "Unlock chain" → the autonomy branch ignites
  → back in Claude: next session in this project has exactly those skills, nothing else
```

## Principles

1. **The filesystem is the truth.** The manifest records intent; `apply` reconciles; the UI
   never claims a skill is enabled unless its payload is actually on disk.
2. **The library is never *exposed* — it is written only on purpose.** *(rev. 3 — replaces
   "canonical source, linked everywhere")* Managed skills are **copied** into the home, so no
   ordinary operation there can reach `claude/skills/`. Exactly one named command (`promote`)
   writes back, deliberately and reviewably; everything else reads. The distinction is the
   whole point: symlinks give an *ambient* write path and no review step, while a copy plus a
   promote gesture gives a review step and no ambient path. The cost is drift, and drift is
   *managed* (§4 update semantics), not avoided by aliasing.
3. **Full transparency.** Every locked node is visible with its full requirements. Discovery
   is the point; mystery hurts a tool.
4. **Strict unlocks, honest escape hatch.** Prerequisites gate enables. Walking the tree is
   the default; "Unlock chain" is an explicit, visible cascade — never silent.
5. **Platform-neutral, Claude proves it.** The registry, engine, and UI are built for both
   platforms; v1 only flips Claude installs. Codex enables its side on its own terms.
6. **Game feel serves information.** Spectacle is welcome (it is a requirement), but every
   persistent surface — weights, scoreboards, achievements — must carry real signal.
7. **Unmanaged is sacred.** *(rev. 3)* The installer acts only on entries the manifest records
   as managed. Anything else in the home — a hand-written skill, a vendored one, a scratch
   experiment — is invisible to every flow: not installed, not refreshed, not removed, not
   reported as drift. Absence from the manifest is the whole safety property, so the failure
   mode of a lost or corrupt manifest is "touches nothing," never "assumes ownership."

## Decision record (from the alignment session)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Install posture | Default: all skills global (today's setup). Adopting flips to lean global core + per-project tree — reversible, per platform *(refined by #19–22)* |
| 2 | Global core | 8 conversational skills: alignment, spec-writer, code-wizard, code-roast, spicy-code-roast, emoji-translator, changelog, shell-prompt (+ the new `skill-tree` launcher = 9) |
| 3 | v1 vehicle | Evolve the existing explorer |
| 4 | Enable action | Instant install via local bridge server; static-server mode degrades to manifest + CLI |
| 5 | Gating | Strict; explicit "Unlock chain" action per locked node |
| 6 | Disable rules | Warn + cascade-disable dependents after one confirmation; tree never inconsistent |
| 7 | Portability | **Superseded by rev. 3 (#23):** symlink-default is retired for the global home. Manifest stays committable/shareable; `update` with diff (pull/keep) becomes the norm rather than an opt-in |
| 8 | Ownership | Promote explorer/, registry/, tree CLI to repo root as platform-neutral infra (Codex reviews the move) |
| 9 | Tree design | Claude drafts edges/capabilities for the ~20 unmodeled skills; PO reviews (table in ARCHITECTURE.md) |
| 10 | v1 primitive scope | Skills only; agents/commands stay whole-root global until v2 |
| 11 | Platform scope | Platform-neutral build, Claude-first enablement, Codex handoff section in docs |
| 12 | Global migration | **Superseded by rev. 2:** adopt/reset ships in Phase 1; adoption is an at-will personal action, not a roadmap milestone |
| 13 | Launch | `skill-tree serve` CLI + thin global `/skill-tree` skill that opens the tree for the current project |
| 14 | Loadouts | Named, user-level state, cinematic sequential apply; ships with built-in "Core Dev" |
| 15 | Meta store | `~/.config/skill-tree/` — project index, loadouts, achievements, stats; apply auto-registers projects |
| 16 | Context weight | v1 feature: per-node always-on/on-trigger token estimates + chain cost + project build total |
| 17 | Phasing | v1 = installs + feel + loadouts + weights + migration; v1.5 = scoreboard + achievements; v2 = agents/commands + Codex |
| 18 | Feel | Keep and deepen the constellation aesthetic (PoE web / FFX sphere grid / civ tech tree sensibility); full spectacle on unlock; roguelike per-project; achievements galore but surface-level |
| 19 | Global mechanism *(rev. 2)* | **Superseded by #24.** Was: re-point the home symlink between canonical and `dist/<platform>/skills` |
| 20 | Managed-dir contents *(rev. 2)* | **Superseded by #23.** Was: per-skill symlinks back to canonical, "drift impossible" |
| 21 | Adopt scope *(rev. 2)* | **Superseded by #26.** Its premise — "no backup ceremony needed since canonical is never modified" — is false: canonical *is* reachable through a managed link (problem #5) |
| 22 | Adopt surface *(rev. 2)* | CLI-only action in v1; the explorer's global view displays adopted vs default state honestly (in-UI toggle button is a v1.5 candidate) |
| 23 | Materialization *(rev. 3)* | Managed skills are **copies**, not symlinks. Chosen specifically so that deleting or editing an installed skill cannot propagate into `claude/skills/`. This makes refresh/"behind" detection meaningful rather than vacuous — a linked skill can never be stale, and can never be protected |
| 24 | Home layout *(rev. 3)* | `~/.claude/skills` is a **real directory** holding managed copies and unmanaged user skills side by side. `dist/` is retired; the home is no longer a symlink at any point |
| 25 | Ownership record *(rev. 3)* | `~/.claude/primitives.json` is the single canonical manifest for the global scope — desired state plus per-skill provenance (`baseline` hash, `installedAt`). Not in the manifest ⇒ unmanaged ⇒ untouched. One path, no fallback chain |
| 26 | Destructive-op policy *(rev. 3)* | Uninstall **moves** to `~/.claude/.primitive-backups/<ts>/`, never deletes. The engine refuses to touch any path that is not manifest-managed *and* baseline-matching without explicit confirmation, and never resolves a path through a symlink |
| 27 | Refresh *(rev. 3)* | `refresh` is explicit and on demand; `status` reports how many managed skills are behind, and `serve` surfaces that count on load as a suggestion — never an automatic rewrite of the user's home |
| 28 | UI apply surface *(rev. 3)* | Both modes ship: `serve` (live apply via localhost bridge) is the primary path, with static/`file://` mode auto-detected and degrading to manifest + copy-the-command banner. Confirms decision #4 |
| 29 | Reconcile on drift *(rev. 3)* | When an installed skill differs from its record, offer three actions in this fixed order: **`keep`** (leave it alone — **the default**, so accidental overwrites are impossible), **`pull`** (replace from `claude/skills`), and **`promote`** (write the local version into the library) **listed last, because it is the only one that can reach the source**. Supersedes the v2 non-goal on upstreaming |
| 30 | Promote guards *(rev. 3)* | `promote` writes the library **working tree only** — never stages, commits, or pushes; refuses on a dirty target path or an unconfirmed conflict; scoped to one skill directory; no bulk mode. The human reviews a normal `git diff` and decides. This yields an update path *from* `~/.claude/skills` without ever exposing the library *to* it |

## Success criteria

- Once adopted, a fresh repo session carries **only the global core** (~9 skill
  descriptions) until skills are deliberately enabled — measurable context reduction vs
  today's 68 — and `reset` provably restores the all-skills world.
- *(rev. 3)* A hand-written skill placed in `~/.claude/skills` survives install, uninstall,
  refresh, and `install.sh --apply` **byte-for-byte**, and is never listed as drifted.
- *(rev. 3)* `rm -rf ~/.claude/skills/<managed-id>/` — trailing slash and all — leaves
  `claude/skills/<id>` untouched. This is a test, not an aspiration.
- *(rev. 3)* A skill can be edited in the home, exercised in a live session, and promoted back
  into the library — and the result is a plain unstaged `git diff` under `claude/skills/<id>/`
  and nothing else: no commit, no other path written, and no way to have done it by accident.
- `/skill-tree` → enabled chain → **next Claude session in that project routes to those
  skills** with zero manual file work.
- Enabling `overdrive` from a cold project is one "Unlock chain" click and feels like an event.
- A committed manifest reproduces the same skill set via one `apply` on another checkout.
- The PO keeps using it because it's fun — the tool gets opened even when nothing needs installing.

## Non-goals (v1)

- Managing agents/commands primitives (v2).
- Codex-side enablement (Codex's call, on their timeline).
- ~~Pushing drifted copies back upstream (manual for now; candidate for v2).~~ **Promoted into
  v1 by rev. 3 (#29)** — `promote` is the reconcile flow's third option, fenced by ARCHITECTURE
  §4. Still a non-goal: *automatic* or bulk upstreaming, and anything that commits for you.
- Public/multi-user anything. This is a localhost personal tool.
