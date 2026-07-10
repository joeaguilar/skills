# Roadmap Artifact Reference

## ROADMAP.md schema (the rendered file)

```markdown
# Roadmap — <project name>

_Last updated: YYYY-MM-DD (post-<trigger>)_

> Cross-sprint product map. Bridges `docs/SPEC.md` and the live `itr` backlog.
> Read at the start of every `$sprint`. Updated at the end of every `$sprint-review`.

## Status legend

- ✅ — section is feature-complete (all subsections shipped, AC met)
- 🟡 — partial (some subsections shipped, others scoped or unscoped)
- ❌ — not started (no sprint has touched this; may have stubs filed)

Cells with a trailing `<!-- auto -->` marker are Codex-owned and refreshed by `$roadmap --update`. Cells without the marker are PO-edited and preserved verbatim. A `<!-- po:override -->` marker pins a PO-asserted status against future inference.

## Release boundary

**v1 ships when:**
- <bullet>
- <bullet>

**v2 scope (tracked, deferred):**
- <section> — <one-line why>

**Excluded (never):**
- <section> — <one-line why>

## Sections — v1

### §A — <group title>

| Section | Status | Size | Linked itr | Notes |
|---------|--------|------|------------|-------|
| §A.1 Architecture | ✅ <!-- auto --> | M <!-- auto --> | itr#12, itr#15 <!-- auto --> | shipped sprint-1 <!-- auto --> |
| §A.6.1 popup base | ✅ <!-- auto --> | S <!-- auto --> | itr#34 <!-- auto --> | shipped sprint-2 <!-- auto --> |
| §A.6.2 popup chonks | ❌ <!-- auto --> | M <!-- auto --> | itr#37 <!-- auto --> | chonks deferred <!-- auto --> |
| §A.6.3 popup Vim nav | ❌ <!-- auto --> | M <!-- auto --> | itr#38 <!-- auto --> | deferred <!-- auto --> |
| §A.16 WindowPicker | ❌ <!-- auto --> | S <!-- auto --> | itr#42 (stub) <!-- auto --> | **wide dep — 4 consumers** <!-- auto --> |
| ... | ... | ... | ... | ... |

### §B — <group title>

| ... |

## Sections — v2 (tracked, deferred)

| Section | Status | Size | Linked itr | Notes |
|---------|--------|------|------------|-------|
| §A.17 Bookmark match (URL-mode selector) | ❌ <!-- auto --> | L <!-- auto --> | — | deferred from v1 boundary 2026-04 <!-- auto --> |

## Cross-cutting

**Wide dependencies (4+ consumers):**
- §A.16 WindowPicker — consumed by popup, options-page, sibling, devtools
- ...

**Inter-section edges:**
- §A.6 → §A.5 (chonks depend on storage)
- ...

## Trajectory _(draft — refined at each $sprint)_

> This section is opt-in. If absent, `$sprint` re-derives ordering each cycle from current backlog state and dependency edges.

- **Sprint-N+1** — §A.11 Group vocab, §A.16 WindowPicker (wide dep, land early)
- **Sprint-N+2** — §A.15 Kinds (split: model + storage), §A.6.2 popup chonks
- ...

## Removed sections _(historical)_

Sections orphaned by spec drift but with shipped scope worth preserving for audit:

- §A.9 Tab quicklist _(removed from spec 2026-04-22; shipped scope was itr#88 sprint-1)_

## Update cadence

- Read at start of every `$sprint` (Phase 0 surfaces next ❌/🟡 sections).
- Updated at end of every `$sprint-review` (Phase 8 calls `$roadmap --update`).
- Manually re-run `$roadmap` when the spec gains or loses sections, or to handle drift reconciliation.
```

The `--brief` variant omits the `Notes`, `Cross-cutting`, `Trajectory`, and `Removed sections` blocks — keeps only the status legend, release boundary, and the per-group table reduced to `Section | Status | Linked itr`. Sentinels still apply.

---

## Integration with other skills

| Skill | How `$roadmap` integrates |
|---|---|
| `/init` | If a spec exists at `/init` time, `/init`'s final-report output should soft-suggest `$roadmap` (same pattern `$sprint` uses to suggest `$story-style`). New projects with no spec yet: don't suggest. |
| `$alignment` | `$roadmap` does NOT call `$alignment` as a sub-skill. Instead, it borrows alignment's DNA — relentless per-decision interview — in Phases 2, 3, 5. If a Phase 5 v1-boundary question is too complex to answer in one shot, the PO can pivot to `$alignment` manually, then resume `$roadmap`. |
| `$story-style` | `$roadmap` reads `STORY_STYLE.md` (if present) before Phase 7 stub filing so the stubs match project conventions. Same defer pattern as `$sprint`. |
| `$sprint` | `$sprint` Phase 0 reads `docs/ROADMAP.md` (if present) to inform sprint goal selection. Surfaces the next ❌/🟡 section in trajectory order (or, if no trajectory, in dependency order with wide-deps first) as a soft suggest, not a forced choice. **Divergence feedback:** if the PO picks a Sprint Goal that does NOT match the roadmap soft-suggest, `$sprint` records this in the sprint's Open Assumptions log; `$sprint-review` Phase 8 passes the divergence note to `$roadmap --update` (via env var `ROADMAP_DIVERGENCE_NOTE` or a tmpfile pointer), which appends it to the affected row's notes for next-cycle context. |
| `$blitz` | No direct integration. `$blitz` executes a sprint; the roadmap doesn't shape execution. |
| `$sprint-review` | **Update hook.** `$sprint-review` Phase 8 adds a step: `$roadmap --update`. Non-blocking; if `--update` errors, log and proceed (roadmap can always be refreshed manually). Passes any sprint-goal divergence note from the closed sprint's Open Assumptions log into the update (see `$sprint` row above). |
| `itr` skill | `$roadmap` Phase 7 defers to `itr` for stub creation (same as `$sprint` Phase 5). All stubs flow through `itr batch add` with `STORY_STYLE.md` conventions. |
| `kgr` | If present, Phase 4 uses `kgr query --who-imports` to confirm import-edge dependencies. Optional; the skill works without it. |

---

## Multi-repo handling

The strong default is **one roadmap per repo**. Multi-repo is a feature, not a default — invoke it only when the spec genuinely spans repos (e.g. `§A` lives in `tab-manager/`, `§B` lives in `sibling-product/`).

When `--scope` selects sections living in sibling repos (or when the spec body declares `Repo: path/to/repo` on a section heading):

- **Phase 0:** collect the unique repo set in step 7; surface under `Repos:` in the summary print. For each repo, read its own `itr` db and `sprint/` history.
- **Phase 2 (status walk):** linked-itr inference treats each repo's `.itr.db` independently; surface repo prefix on linked issue IDs (e.g. `sibling:itr#12`).
- **Phase 4 (deps):** dependency edges across repos are allowed and explicitly flagged as `cross-repo` — they often correlate with wide dependencies (a primitive in one repo consumed by surfaces in another).
- **Phase 7 (stubs):** stubs file into each section's owning repo's `itr` db, not the orchestrating repo's. The roadmap row references stubs with repo-prefixed IDs.
- **Phase 9 (write):** one artifact at the coordinating repo root (default current dir). Sections declare their repo prefix in the row when they live elsewhere.

Cross-repo roadmaps are higher-touch than single-repo ones — ambiguity in spec ownership multiplies across boundaries. The PO is the single source of truth for "does this section live in repo X or Y" — Codex never guesses.

---
