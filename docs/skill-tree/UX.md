# Skill Tree — UX & Gamification

**Status:** Draft for review · **Date:** 2026-06-11
**Companion docs:** [VISION.md](VISION.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [ROADMAP.md](ROADMAP.md)

The requirement this doc serves, verbatim from the PO: *"it just feels really cool (I cannot
stress this enough) to activate skills like a skill tree."* Every surface here is judged on
two axes: does it feel powerful, and does it carry real information. Ship nothing that
scores on only one.

## 1. Visual identity

**Keep and deepen the existing constellation aesthetic.** Influences to steer the deepening:
PoE passive web (a sprawling map you read at a glance), FFX sphere grid (paths you travel),
civ tech tree (eras/tiers with visible payoff). Concretely:

- **Constellations by group.** Each group (`core`, `foundations`, `planning`, `execution`,
  `quality`, `autonomy`, `forge`) reads as a named constellation — clustered nodes, shared
  accent, faint boundary glow. The group rail doubles as a legend and completion meter.
- **Tiers as depth.** Tier 0 nodes sit near the roots/center; tier 4 (overdrive,
  proof-campaign, dual-blitz) sit at the rim — physically far, visibly expensive to reach.
- **Edges are first-class.** Dependency lines are how you *read* the tree: dim when parent
  disabled, lit when traversable, **pulsing with traveling energy** when recently used by an
  unlock. The PoE lesson: the web IS the interface.
- Global-core nodes render permanently lit with a distinct "always-on" treatment — they are
  the constellation you start with in every run.

## 2. Node states (visual contract)

| State | Meaning | Treatment |
|---|---|---|
| `enabled` | manifest says enabled AND payload on disk | full theme glow, lit edges |
| `pending` | manifest says enabled, payload missing (degraded/static mode) | glow + warning ring, "pending apply" |
| `available` | prereqs met, one click away | breathing highlight — the "you could take this" shimmer |
| `locked` | prereqs unmet | dim but **fully readable**: title, summary, requirements, weights all visible (full-transparency decision) |
| `missing-provider` | no provider exists on this platform | distinct flat/grey state, never breathing |
| `drifted` | copy differs from canonical | enabled treatment + amber drift ring |

Full transparency everywhere: no mystery nodes, no hidden tiers. Discovery means *seeing the
whole map* and wanting to reach the far edge of it.

## 3. The unlock moment

The single most important interaction. Sequence on Enable (bridge mode):

1. **Commit** — API call returns; the payload is on disk *(rev. 3: a managed copy, not a
   symlink — ARCHITECTURE §7)*. Everything after this is honest.
2. **Burst** — current particle burst, upgraded: scale with tier (tier 0 = crisp pop,
   tier 4 = screen-edge shockwave + brief camera push on the node).
3. **Edge surge** — energy travels every outgoing dependency edge; children whose prereqs
   just completed flip to `available` with a visible "ignition" shimmer — the tree shows
   you what you just made possible.
4. **Readout tick** — build status counter and token budget animate to their new values.
5. **Toast** — "`sprint` enabled · available next session" (the harness-constraint honesty,
   ARCHITECTURE §6, worded as a feature: *your next run carries this*).

"Unlock chain" on a locked node: confirmation lists the full path ("This will enable: itr →
kgr → sprint → blitz → sprint-review → overdrive · +3.1k always-on tokens"), then the chain
fires **sequentially**, each node's burst ~400ms apart, energy marching up the tree. Deep
chains are the spectacle centerpiece — enabling overdrive from cold should feel like an event.

**Disable** is deliberately unspectacular: confirm (with cascade list when dependents exist,
worded as "this collapses: sprint, blitz, overdrive"), nodes power down with a brief
de-rez, edges dim. Powering down shouldn't feel fun.

No sound in v1 (optional toggle is a v2 candidate).

## 4. Loadouts — the roguelike opening build

- Loadout picker surfaces on any project with 0 enabled skills: "Start from a loadout?"
  alongside the empty tree. Ships with **Core Dev** (itr, kgr, sprint, blitz, sprint-review).
- Applying a loadout = the cinematic: sequential chain unlock across all its nodes, same
  grammar as Unlock chain. One click, the tree ignites, ~5 seconds, new project ready.
- "Save as loadout" captures the current project's enabled set + provider choices under a
  name. Loadouts live in the meta store and list their own total context weight.

## 5. Context weight — the build budget

The currency that makes this a build game (and quantifies the bloat problem that started
this initiative):

- **Node badge:** always-on token estimate (description cost — what every session pays).
- **Inspector breakdown:** always-on vs on-trigger (body) cost, plus **chain cost** — what
  enabling this node would really add given current state ("overdrive: +180 self,
  +2.9k with its chain").
- **Build total** in the header readout: "12/24 nodes · ~3.2k always-on tokens". Updates
  with the unlock animation. Locked nodes show their chain cost on hover — you can window-shop
  expensive builds.

## 6. Tree status readout

Persistent header strip, per project: `nodes enabled / visible` · constellation completion
("Planning ✦ complete") · build token total · platform/scope. This is the at-a-glance
"character sheet" for the current run.

At **global scope** the strip states the machine posture honestly: **"lean core active"** or
**"all skills installed"**, plus, *(rev. 3)*, two counts the overlay makes meaningful —
**`N unmanaged`** (yours, never touched by this tool) and **`N behind`** (managed copies the
library has moved past, offered as a suggestion, never acted on automatically). Migration
itself stays a deliberate, typed CLI gesture (`migrate`); bulk install/uninstall from the UI
is a v1.5 candidate. A lean machine's global tree shows the core nodes lit and everything
else dark; a full machine shows every managed skill lit — the view never lies about what a
session will actually carry, and never claims ownership of an unmanaged skill.

## 7. Meta layer (v1.5) — scoreboard & achievements

Persistent across projects (meta store), surfaced in a dedicated panel:

- **Adoption scoreboard.** For each skill: enabled in N/M registered projects, read live
  from project manifests. Surfaces both in the panel (sortable leaderboard) and inline in
  the node inspector ("enabled in 4/9 projects"). This is real signal: which skills earn
  their place in builds, which expensive chains (overdrive) actually get taken.
- **Lifetime stats strip:** projects registered, total unlocks, deepest chain fired,
  heaviest build.
- **Achievements** — galore, surface-level by design (toasts + trophy case, zero gating).
  Seed set: *First Light* (first node in a project), *Constellation Complete* (full group),
  *Going Autonomous* (overdrive), *Speedrun* (loadout on a <1-day-old repo), *Minimalist*
  (sprint completed with ≤4 skills), *Cartographer* (5+ projects registered), *Purist*
  (overdrive reached without Unlock chain — every parent clicked by hand).

Each project still starts at zero — the meta layer records history, it never unlocks
shortcuts. The roguelike contract stays intact.

## 8. Degraded (static-server) mode

Without the bridge: current explorer behavior, clearly bannered — manifest edits are
"planning mode", every enabled-but-not-installed node shows `pending`, and the banner offers
the exact `skill-tree.js apply` command with a copy button. No fake unlock celebrations for
installs that didn't happen: the burst plays only in bridge mode; planning mode gets a
muted acknowledgment instead.

## 9. Out of scope (explicitly)

- XP, levels, or any artificial gate beyond the real dependency graph.
- Mystery/hidden nodes (violates full transparency).
- Sound (v2 toggle candidate). Multiplayer/shared scoreboards. Theming options.
