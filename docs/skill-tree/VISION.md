# Skill Tree — Vision

**Status:** Draft for review · **Date:** 2026-06-11 · **Source:** /alignment session (PO: Goldboy)
**Rev. 2 (same day):** second alignment replaced the one-way global migration with a reversible per-platform `adopt`/`reset` toggle — see decisions #19–22.
**Companion docs:** [ARCHITECTURE.md](ARCHITECTURE.md) · [UX.md](UX.md) · [ROADMAP.md](ROADMAP.md)

## The problem

1. **Context bloat.** All 32 Claude skills are globally symlinked, so every session in every
   directory carries every skill description in its context — including domain advisors and
   sprint machinery that most sessions never touch.
2. **All-or-nothing installation.** `install.sh` links whole roots. There is no way to give one
   project `itr` + `kgr` + `sprint` and another project nothing.
3. **The tree is decorative.** The explorer already renders a prerequisite-checked skill tree,
   but clicking Enable only writes a manifest no other tool reads. Nothing is actually installed.

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
2. **Canonical source, linked everywhere.** Symlinks into this repo are the default — edit a
   skill once, every project gets it. Copies are an explicit opt-in with managed drift.
3. **Full transparency.** Every locked node is visible with its full requirements. Discovery
   is the point; mystery hurts a tool.
4. **Strict unlocks, honest escape hatch.** Prerequisites gate enables. Walking the tree is
   the default; "Unlock chain" is an explicit, visible cascade — never silent.
5. **Platform-neutral, Claude proves it.** The registry, engine, and UI are built for both
   platforms; v1 only flips Claude installs. Codex enables its side on its own terms.
6. **Game feel serves information.** Spectacle is welcome (it is a requirement), but every
   persistent surface — weights, scoreboards, achievements — must carry real signal.

## Decision record (from the alignment session)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Install posture | Default: all skills global (today's setup). Adopting flips to lean global core + per-project tree — reversible, per platform *(refined by #19–22)* |
| 2 | Global core | 8 conversational skills: alignment, spec-writer, code-wizard, code-roast, spicy-code-roast, emoji-translator, changelog, shell-prompt (+ the new `skill-tree` launcher = 9) |
| 3 | v1 vehicle | Evolve the existing explorer |
| 4 | Enable action | Instant install via local bridge server; static-server mode degrades to manifest + CLI |
| 5 | Gating | Strict; explicit "Unlock chain" action per locked node |
| 6 | Disable rules | Warn + cascade-disable dependents after one confirmation; tree never inconsistent |
| 7 | Portability | Symlinks default; manifest is committable/shareable; `--copy` mode + `update` mode with diff (pull/keep) for drift |
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
| 19 | Global mechanism *(rev. 2)* | The toggle re-points the home symlink: default → canonical skills dir (all skills, live, zero sync); adopted → `dist/<platform>/skills` managed dir (core set only). Same pattern per platform; canonical dirs stay separate (two-ports contract intact) |
| 20 | Managed-dir contents *(rev. 2)* | Per-skill symlinks back to canonical — live-edit preserved, drift impossible. Copies remain a per-project opt-in only |
| 21 | Adopt scope *(rev. 2)* | `adopt`/`reset` paired idempotent commands, each platform toggles independently; no backup ceremony needed since canonical is never modified |
| 22 | Adopt surface *(rev. 2)* | CLI-only action in v1; the explorer's global view displays adopted vs default state honestly (in-UI toggle button is a v1.5 candidate) |

## Success criteria

- Once adopted, a fresh repo session carries **only the global core** (~9 skill
  descriptions) until skills are deliberately enabled — measurable context reduction vs
  today's 32 — and `reset` provably restores the all-skills world.
- `/skill-tree` → enabled chain → **next Claude session in that project routes to those
  skills** with zero manual file work.
- Enabling `overdrive` from a cold project is one "Unlock chain" click and feels like an event.
- A committed manifest reproduces the same skill set via one `apply` on another checkout.
- The PO keeps using it because it's fun — the tool gets opened even when nothing needs installing.

## Non-goals (v1)

- Managing agents/commands primitives (v2).
- Codex-side enablement (Codex's call, on their timeline).
- Pushing drifted copies back upstream (manual for now; candidate for v2).
- Public/multi-user anything. This is a localhost personal tool.
