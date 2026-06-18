# Skill Tree — Roadmap

**Status:** Draft for review · **Date:** 2026-06-11
**Companion docs:** [VISION.md](VISION.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [UX.md](UX.md)

Phased delivery. Each phase ends with something the PO can feel. *(Rev. 2: the global
lean-down is no longer a scheduled phase — the reversible `adopt`/`reset` toggle ships in
Phase 1 and adoption is an at-will personal action; see VISION decisions #19–22.)* Sizing:
S/M/L per the repo's usual scale.

## Phase 0 — Foundations (size: M)

Goal: the tree is *true* before it is interactive.

1. **Codex ack on the layout promotion** (blocking gate for everything in this phase).
2. Move `codex/explorer` → `explorer/`, `codex/registry` → `registry/`,
   `codex/scripts/skill-tree.js` → `scripts/skill-tree.js`; fix relative paths
   (`REGISTRY_URL`, `PLATFORM_ONLY_URL`, markdown prefixes); update `AGENTS.md`/`CLAUDE.md`
   references and the `codex/` doc pointers.
3. `build-registry`: `skill-tree.yaml` becomes single source, json generated;
   `validate` gains `--check` for staleness.
4. Registry coverage: the 20 draft entries + 11 new capabilities + `quality` group from
   ARCHITECTURE §2 — **after PO reviews the draft table**. Constellation layout pass for
   node positions (UX §1).
5. Extend `validate` (paths exist per platform, providers exist, cycles) and wire it into
   `validate-skills.sh`.

**Done when:** explorer served from repo root renders all 32 Claude skills with edges and
correct states; `./validate-skills.sh` green; Codex ack recorded in the PR.

## Phase 1 — Apply engine (size: M)

Goal: the manifest stops being fiction — from a terminal, enabling is real.

1. Manifest v2 (`materialization` block) with legacy v1 read-compat.
2. `apply`: prereq-closure validation, `--with-deps`, per-skill symlink/copy
   materialization, managed-only removal, dry-run default, ordered change output.
3. `update` + `diff`: drift table semantics (fast-forward, pull, keep with re-baseline).
4. Disable cascade in the CLI (warn + confirm + dependent subtree).
5. Meta store bootstrap: project auto-registration on apply; `loadout list/apply/save`
   with built-in **Core Dev**.
6. `adopt`/`reset` (per platform): build `dist/<platform>/skills` of per-skill relative
   symlinks for the core set (Codex variant always includes `.system`), re-point the home
   symlink, write the global manifest — idempotent both ways. `install.sh` adopt-awareness
   and the `dist/` gitignore entry land here too.
7. Tests against a scratch target project (enable chain → symlinks exist → a fresh Claude
   session in that project lists exactly those skills; induce drift on a copy → update
   detects, pull and keep both behave; adopt → reset round-trips cleanly under a temp
   `--claude-home`).

**Done when:** `skill-tree.js loadout apply core-dev --project /tmp/x --apply` produces a
working per-project skill set that a real Claude session routes to; `adopt` → a fresh
session anywhere carries only the core; `reset` provably restores all skills.

## Phase 2 — Bridge + the experience (size: L)

Goal: `/skill-tree` to a fully enabled build without touching a terminal; unlocks feel like
unlocking a hack.

1. `serve`: static hosting + the API surface (ARCHITECTURE §5), localhost-only.
2. Explorer live mode: filesystem-truth states (incl. `pending`, `drifted`), Enable→install,
   Unlock chain (sequential), disable cascade dialog, provider switching via API,
   drift diff view with pull/keep.
3. Degraded-mode banner + exact-command copy (UX §8); File System Access path retained.
4. **Feel pass** (UX §3): tier-scaled bursts, edge energy surge, child ignition shimmer,
   readout ticks, next-session toast; loadout cinematic.
5. Context weight: CLI computation + node badges, inspector breakdown, chain cost,
   build total (UX §5).
6. `/skill-tree` launcher skill (global): port probe, serve, open browser at current
   project; registry entry + `PLATFORM_ONLY.tsv` line.

**Done when:** in a fresh repo: `/skill-tree` → browser opens → apply Core Dev (cinematic)
→ Unlock chain on overdrive (event) → next Claude session routes to all of it. Demo-able
end to end.

## Phase 3 — dissolved *(rev. 2)*

The second alignment session replaced the one-way global migration with the reversible
`adopt`/`reset` toggle, which ships in Phase 1 alongside per-project apply (so the moment
you can go lean globally, you can also re-add skills per project — no stranded window).
Adopting on the PO's machine is an at-will personal action, not a milestone. The only
scheduled remnant is the **measurement**: on adoption, record skill-description context in
a fresh session before vs after (the VISION success criterion), and verify
agents/commands roots are untouched.

## v1.5 — Meta layer (size: M)

- Adoption scoreboard (live manifest reads across registered projects; panel + inspector
  inline stat), lifetime stats strip, achievements seed set + trophy case + toasts (UX §7).
- Meta-store pruning for moved/deleted projects.
- `adopt`/`reset` toggle button in the explorer's global scope (CLI-only in v1, UX §6).

## v2 — Horizon (unsized until v1.5 ships)

- Agents + commands join the tree (lean-global split applied to them; type-aware machinery
  already in place).
- Codex enablement per the handoff section (their wording, their core split, their launcher).
- Push-upstream action for drifted copies; sound toggle; whatever v1 usage teaches.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Codex declines/stalls the layout move | Phase 0 gate is explicit; fallback = standing-exception mode in place (decision #8 alternative), only the move is deferred, not the feature |
| Skills enabled mid-session don't route until restart | Honest UX copy everywhere ("available next session"); never claim otherwise |
| Adopting strands the 24 demoted skills | `adopt` ships in the same phase as per-project apply, so re-adding is always possible; `reset` restores everything instantly; the 9-core set keeps daily conversational use unaffected |
| Registry yaml/json drift during transition | `build-registry` lands in Phase 0 before any new entries |
| `install.sh` silently un-adopts by re-linking canonical | Adopt-aware check: leave `dist/`-pointing symlinks alone and explain (`reset` is the sanctioned path back) |
| Scope creep via gamification | v1 game surfaces limited to UX §§3–6; everything else is v1.5+ by decision #17 |

## Handoffs

- **Next step after doc approval:** `/sprint` grooms Phase 0 + Phase 1 into an itr backlog
  (these docs are the spec input).
- **Codex:** ARCHITECTURE §1 (the move) and §11 (their enablement surface) are the two
  sections that concern them; everything else is informational.
