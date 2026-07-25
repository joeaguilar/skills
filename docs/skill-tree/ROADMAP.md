# Skill Tree — Roadmap

**Status:** Draft for review · **Date:** 2026-06-11 · **Rev. 3:** 2026-07-25
**Companion docs:** [VISION.md](VISION.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [UX.md](UX.md)

Phased delivery. Each phase ends with something the PO can feel. *(Rev. 2: the global
lean-down is no longer a scheduled phase — the reversible `adopt`/`reset` toggle ships in
Phase 1 and adoption is an at-will personal action; see VISION decisions #19–22.)* Sizing:
S/M/L per the repo's usual scale.

> **Rev. 3 (2026-07-25) — why this document stalled, and the re-order that unblocks it.**
> Phase 0 opened with a *blocking* gate — "Codex ack on the layout promotion" — and the ack
> was never sought, so nothing downstream was ever groomed and the plan sat idle for six
> weeks. That gate is now **decoupled**: the installer needs no file moves and is built where
> the code lives today (`codex/scripts/skill-tree.js`, `codex/explorer/`). The layout
> promotion becomes an independent, non-blocking cleanup that can land before, after, or
> never. **Phase 1 is now the first phase**, and it is re-specified per ARCHITECTURE rev. 3:
> a real `~/.claude/skills` overlay of managed **copies** beside untouched unmanaged skills.

## Phase 1 — The global installer (size: M) — **first phase as of rev. 3**

Goal: the manifest stops being fiction, unmanaged skills become possible, and the home can no
longer damage the library. Terminal-only; the UI comes in Phase 2.

1. Manifest v2 per ARCHITECTURE §3 — global (`~/.claude/primitives.json`) and per-project,
   `managed` ownership map **keyed by root** (`skills`/`agents`/`commands`/`workflows`) with
   `baseline`/`installedAt`, legacy v1 read-compat.
2. `migrate --platform claude --global [--root …]`: root symlink → real overlay, backup first,
   copy the existing set in, write the manifest, print the per-root census. Dry-run default,
   idempotent, per-root so roots can be converted and verified one at a time.
   2a. **Flat-root rules** (§7, decision #32): install refuses to overwrite an unmanaged file;
   uninstall removes one file and prunes only installer-created empty directories; no root is
   ever reconciled as a unit. Namespaced commands supported though currently unexercised.
3. `install` / `uninstall` / `refresh` / `status` / `diff` per §7, with the four
   destructive-operation rules from §4 (never delete, never act on the unproven, never resolve
   through a link, one explicit library write path and no ambient one).
   3a. The **three-way reconcile** on drift — `keep` (default) / `pull` / `promote` — in the
   fixed safest-first order, plus `promote` and its guards: working tree only, refuse on a
   dirty target, refuse on unconfirmed conflict, single-skill scope, no bulk.
4. Prereq closure and `--with-deps` on install; disable cascade (warn + confirm + dependent
   subtree) on uninstall.
5. `install.sh` overlay-awareness (§7) — the shared edit. Reconcile per-skill on a migrated
   home; never re-link the root over an overlay; never adopt an unmanaged skill.
6. Meta store bootstrap: project auto-registration; `loadout list/apply/save` with built-in
   **Core Dev**.
7. Tests, against a temp `--claude-home` so nothing touches the real one:
   - **the safety suite** (this is the phase's reason for existing): an unmanaged primitive in
     **each** root survives install/uninstall/refresh/`install.sh --apply` byte-for-byte and is
     never reported as drift — including an unmanaged `.md` sharing a directory with a managed
     one; `rm -rf <home>/skills/<managed>/` leaves the library intact; a managed path that is
     unexpectedly a symlink is reported, not followed; installing over an existing unmanaged
     file halts on collision instead of overwriting; uninstall never removes a directory that
     still holds an unmanaged file.
   - migrate → identical installed set → reverse → original symlink restored.
   - library moves ahead → `status` says *behind* → `refresh` pulls; delete a skill from the
     library → *orphaned*, not silently uninstalled.
   - **reconcile suite:** locally edit a copy → *locally edited* → all three actions behave
     (`keep` writes neither side and re-baselines; `pull` archives then overwrites the copy;
     `promote` writes only `claude/skills/<id>/` and leaves it unstaged). Both sides edited →
     *conflict* → `promote` refuses without explicit confirmation. Dirty library target →
     `promote` refuses. Dismissing the prompt lands on `keep`, never on `pull` or `promote`.
   - enable chain → a fresh Claude session lists exactly the managed set.

**Done when:** on a migrated machine, `install`/`uninstall` change what the next Claude session
routes to **in every root**; a hand-written skill, agent, command, or workflow is provably
untouched by every flow; no operation in the home can modify `claude/**` **except** a typed
`promote` on a named primitive; and that promotion always arrives as a reviewable unstaged
diff rather than a commit.

## Phase 0 — Foundations (size: M) — *non-blocking as of rev. 3; may land before or after Phase 1*

Goal: the tree is *true* before it is interactive.

1. ~~**Codex ack on the layout promotion** (blocking gate).~~ **Decoupled (rev. 3.)** The
   installer does not depend on the move; seek the ack on its own timeline.
2. *(optional, gated on that ack)* Move `codex/explorer` → `explorer/`, `codex/registry` →
   `registry/`, `codex/scripts/skill-tree.js` → `scripts/skill-tree.js`; fix relative paths
   (`REGISTRY_URL`, `PLATFORM_ONLY_URL`, markdown prefixes); update `AGENTS.md`/`CLAUDE.md`
   references and the `codex/` doc pointers.
3. `build-registry`: `skill-tree.yaml` becomes single source, json generated;
   `validate` gains `--check` for staleness.
4. Registry coverage: the draft entries + 11 new capabilities + `quality` group from
   ARCHITECTURE §2 — **after PO reviews the draft table**. Constellation layout pass for
   node positions (UX §1). *(Rev. 3: the library is 68 skills now, not 32 — the draft table
   needs a coverage re-check before review.)*
5. Extend `validate` (paths exist per platform, providers exist, cycles) and wire it into
   `validate-skills.sh`.

**Done when:** the explorer renders every Claude skill with edges and correct states;
`./validate-skills.sh` green. Item 2 lands only with the Codex ack recorded in the PR.

## Phase 2 — Bridge + the experience (size: L)

Goal: `/skill-tree` to a fully enabled build without touching a terminal; unlocks feel like
unlocking a hack.

1. `serve`: static hosting + the API surface (ARCHITECTURE §5), localhost-only.
2. Explorer live mode across the **existing per-type tabs** — skills, agents, commands,
   workflows all selectable, not just skills: filesystem-truth states (incl. `pending`,
   `drifted`, `unmanaged`), Enable→install, Unlock chain (sequential), disable cascade dialog,
   provider switching via API, drift view with the three-way reconcile (`keep` preselected,
   `promote` last and separated).
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

*(Rev. 3: the mechanism changed — `adopt`/`reset` became `migrate` + per-skill
`install`/`uninstall` over a real overlay — but the conclusion stands unchanged. Going lean
is still an at-will personal action rather than a milestone, and it is still reversible,
now because uninstall archives payloads instead of because canonical was never touched.)*

## v1.5 — Meta layer (size: M)

- Adoption scoreboard (live manifest reads across registered projects; panel + inspector
  inline stat), lifetime stats strip, achievements seed set + trophy case + toasts (UX §7).
- Meta-store pruning for moved/deleted projects.
- Bulk core-set install/uninstall from the explorer's global scope (CLI-only in v1, UX §6).

## v2 — Horizon (unsized until v1.5 ships)

- ~~Agents + commands join the tree.~~ **Moved into Phase 1 by rev. 3 (#31)** — one selector
  covers all four roots from the start.
- Codex enablement per the handoff section (their wording, their core split, their launcher).
- Push-upstream action for drifted copies; sound toggle; whatever v1 usage teaches.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Codex declines/stalls the layout move | **This risk materialized** (rev. 3): the ack was never sought and the whole plan stalled behind it. Mitigation is now structural — the gate is decoupled, Phase 1 depends on no `codex/**` move, and the promotion can land whenever or never |
| Skills enabled mid-session don't route until restart | Honest UX copy everywhere ("available next session"); never claim otherwise |
| Lean global strands the demoted skills | Uninstall moves payloads to `.primitive-backups/`, and re-installing is one command against the library, so nothing is ever unrecoverable; the core set keeps daily conversational use unaffected |
| Registry yaml/json drift during transition | `build-registry` lands in Phase 0 before any new entries |
| `install.sh` re-links the root and destroys the overlay | Overlay-awareness (ARCHITECTURE §7) is a Phase 1 deliverable, not a follow-up: a real home directory with a valid manifest is reconciled per-skill, never replaced. Covered by the safety suite |
| **Copies go stale silently** *(rev. 3)* | The cost of choosing copies over links. `status` reports the behind count and `serve` surfaces it on load; the library is a git repo, so the diff is always available. Accepted deliberately in exchange for the library being unreachable from the home |
| **Manifest lost or corrupted** *(rev. 3)* | Fails safe by design: no entry ⇒ unmanaged ⇒ untouched. The installer never infers ownership from disk layout, so the worst case is that managed skills become inert user files, never that user files get overwritten |
| **`promote` damages the library** *(rev. 3)* | The one deliberate write path, so it carries the most fencing: working tree only (never staged, committed, or pushed), refuses a dirty target, refuses an unconfirmed conflict, one skill directory per invocation, no bulk mode, and always last in the option order with `keep` as the default. Every promotion is recoverable with `git checkout --` *before* it is committed, which is the point of never committing |
| Scope creep via gamification | v1 game surfaces limited to UX §§3–6; everything else is v1.5+ by decision #17 |

## Handoffs

- **Next step after doc approval:** `/sprint` grooms **Phase 1** into an itr backlog (these
  docs are the spec input). Phase 0 grooms separately and is no longer a prerequisite.
  *(Rev. 3: last time this handoff was written it never fired — the approval gate is the
  thing to actually close, not the plan.)*
- **Codex:** ARCHITECTURE §1 (the move) and §11 (their enablement surface) are the two
  sections that concern them; everything else is informational. Nothing in Phase 1 moves a
  `codex/**` file or writes into `~/.codex`, so their ack no longer blocks delivery.
