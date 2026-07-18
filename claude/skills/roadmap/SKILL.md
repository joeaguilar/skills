---
name: roadmap
description: Produce or update `docs/ROADMAP.md` — the bridge between a locked spec and the live `itr` backlog. Walks the Product Owner section-by-section to establish status (✅/🟡/❌), effort sizing (S/M/L/XL), dependencies, and the v1 feature-complete boundary. Read at the start of every `/sprint`; updated at the end of every `/sprint-review`. Trigger when the user types `/roadmap`, or asks to "draft a roadmap", "map the work", "what's left to ship", "are we feature-complete yet", "show the work plan", "build a product roadmap", "track the long view", or similar phrasing. Acts as Scrum Master with a Product Manager lens — the user is Product Owner; the skill coaches them through the cross-sprint map. Do NOT trigger for one-off backlog questions (use the `itr` skill), single-sprint planning (use `/sprint`), or status reports on closed sprints (use `/sprint-review`).
---

# /roadmap — the bridge from spec to sprint backlog

Produce (or update) `docs/ROADMAP.md`, the cross-sprint product map that lives between a locked spec and the live `itr` backlog. Walks the Product Owner section-by-section: status (✅/🟡/❌), effort sizing (S/M/L/XL), dependencies, v1 boundary. Optionally drafts a sprint trajectory and files `itr` stubs for uncovered sections so future `/sprint` runs can pull them.

This skill fills the gap between `/sprint` (plans one sprint) and `/sprint-review` (closes one sprint). Neither answers *"are we feature-complete yet?"* — `/roadmap` does. Read at the start of every `/sprint`. Updated at the end of every `/sprint-review`.

The orchestrator plays **Scrum Master with a Product Manager lens**:
- The **user** is Product Owner — owns status confirmations, sizing, dependency edges, v1 boundary, trajectory decisions.
- The **spec** is the locked scope contract; the **`itr` backlog** is live execution state. `/roadmap` is the connecting tissue.
- The skill coaches the *why* of each cell as it reaches it. Verbose, structured, phase-announced output — same principle as `/sprint` and `/sprint-review`.

## Slash invocation

```
/roadmap [--spec <path>] [--scope <section>] [--update] [--brief] [--no-itr-stubs] [--dry-run]
```

| Form | Meaning |
|---|---|
| `/roadmap` | Default. Auto-detect spec (`docs/SPEC.md` → `docs/REWRITE_SPEC.md` → `README.md` → `CLAUDE.md`); auto-detect sprint history + `itr` state; full per-section interview. |
| `--spec <path>` | Override spec detection. Use when the spec lives somewhere unusual or when multiple specs exist in the repo. |
| `--scope <section>` | Limit the roadmap to a subset of the spec (e.g. `§A`, `§B.popup`). Used for monorepos with multiple products in one spec; the strong default is one roadmap per repo. |
| `--update` | Existing `docs/ROADMAP.md` found — interview only the rows whose status may have changed since the last update. Used by `/sprint-review` Phase 8. |
| `--brief` | Render the artifact in summary-only mode (status + linked issues only; no per-section notes). Good for 50+ section specs. |
| `--no-itr-stubs` | Skip Phase 7 entirely — don't file `itr` stubs for sections with zero backlog coverage. |
| `--dry-run` | Run all phases including alignment, print what *would* have been written/filed, no writes. |

---

## Roles & artifacts

State once at the top of every run so the user knows the contract:

- **Spec** = the locked scope contract (`docs/SPEC.md` or equivalent). Read-only input.
- **Product Backlog** = live work in `itr` tagged `product-backlog`. Survives across sprints.
- **Sprint Backlog** = filed by `/sprint`; closed by `/sprint-review`. Read for status inference, never written here.
- **Roadmap** = `docs/ROADMAP.md` (or repo-root `ROADMAP.md` for spec-less projects). The bridge. Read by every `/sprint` Phase 0; updated by every `/sprint-review` Phase 8.
- **Roadmap stubs** = `itr` issues filed for spec sections with zero backlog coverage. Tagged `roadmap-stub,needs-sprint,product-backlog`. Created by Phase 7.

---

## Phase 0 — Preflight

Announce: `Phase 0 — Preflight`.

1. **Resolve spec.** In order:
   - If `--spec <path>` and the file exists, use it.
   - Else check `docs/REWRITE_SPEC.md` → `docs/SPEC.md` → `README.md` → `CLAUDE.md`.
   - If none of the above yield a usable spec, **pivot to spec-less mode** (see below). Don't refuse — coach the user.

2. **Parse spec section headings (with row-level granularity).** Walk markdown `##`, `###`, and `####` headings; capture title + line range for each. For each captured section, additionally **detect enumerated rows** in the body:
   - **Numbered lists** at the top of the section body (`1. ...`, `2. ...`) where each item describes a discrete shippable unit (heuristic: each item has its own AC, or is multi-sentence, or references a distinct file/feature).
   - **Tables** with row enumeration (each table row = one shippable unit).
   - **Sub-subsection headings** (`####` inside `###`) — already captured above.

   For sections where rows are detected, the roadmap tracks **row-level granularity** (e.g. `§A.6.1 popup base`, `§A.6.2 popup chonks`, `§A.6.3 popup Vim nav`). For sections without enumeration, the roadmap tracks at **section level** (`§A.5 Storage`). The granularity decision is surfaced for PO confirmation at Phase 1 — if the spec is ambiguous (e.g. a section with both prose paragraphs and one numbered list), the PO picks at Gate 1.

   Capture each row's identity as a **(number, title) pair** — both are used as a composite match key for `--update` drift detection in step 4.

3. **Detect existing `docs/ROADMAP.md`** (or `./ROADMAP.md` for spec-less projects). If present:
   - **`--update` flag passed** → enter update mode; read existing rows including their (number, title) identity pairs and any `<!-- auto -->` sentinel markers on agent-drafted cells.
   - **No `--update` flag** → ask the user: *"Existing ROADMAP found. Fresh draft or in-place update?"* (one-shot AskUserQuestion). Don't silently overwrite.
   - **Not present** → fresh draft.

4. **Drift detection (only if existing roadmap was loaded in step 3).** Compute the symmetric difference between the spec's current (number, title) pairs and the roadmap's stored pairs:
   - **Number match, title differs** → drift candidate (likely rename).
   - **Title match, number differs** → drift candidate (likely reorder).
   - **Both differ but content overlaps** → ambiguous drift; surface for PO judgment.
   - **In spec but not in roadmap** → new section since last update.
   - **In roadmap but not in spec** → orphan candidate (section was removed or restructured).

   Hold all drift candidates in memory; surface them at Phase 1 for PO reconciliation. **Do not silently re-match** — every drift must be PO-confirmed before the roadmap rewrites the cell.

5. **Detect sprint history.** List `sprint/sprint-*/` folders; for each, read `plan.md` and extract the Outcomes table. The Outcomes table is the primary status-inference signal in Phase 2. If a sprint folder exists but its Outcomes is empty (sprint planned but not yet reviewed), note `unreviewed` and exclude from status inference — its in-flight stories are still in `itr` and will be picked up via the linked-itr signal instead.

6. **Detect `itr` state.** Run:
   - `itr stats` to verify the db is present.
   - `itr agent-info` to get authoritative flag/tag conventions.
   - `itr list -f json --tags product-backlog --fields id,title,tags,status` to pull the live backlog. Hold in memory for Phase 2 linked-issue inference and Phase 7 stub-dedup check.
   - `itr list -f json --tags roadmap-stub --fields id,title,status` to pull existing roadmap stubs (used for Phase 7 idempotency — re-running `/roadmap` never double-files a stub).

7. **Detect repos in scope.** Default = current repo (single-repo mode). If `--scope` was passed and the section selector spans multiple repos (e.g. `§B` refers to a sibling product in `../sibling-repo/`), collect the unique repo set; treat each repo's `itr` db and sprint history as a separate signal cluster. Multi-repo is a feature, not a default — most roadmaps stay in one repo.

8. **Detect `STORY_STYLE.md`** for Phase 7 stub-issue shape. If missing, note in summary; stub issues will use `itr`'s base default.

9. **Detect `kgr`.** If present, plan to use `kgr query --who-imports` in Phase 4 for dependency inference. If absent, fall back to spec cross-reference parsing.

10. **Spec-less mode** (if step 1 found no spec):
    - Coach: *"A roadmap without a spec is a wishlist. Strongly consider `/alignment` first to capture the scope before mapping it. Proceeding anyway — section list will come from pure interview."*
    - Default target shifts from `docs/ROADMAP.md` to `./ROADMAP.md` (repo root, more visible without a `docs/` convention).
    - Skip steps 2, 4, and 9 — there's no spec to parse, no drift to detect, no cross-references to mine. Phase 2 will run pure-interview to draft the section list from scratch (same pattern as `/story-style`'s pure-interview path).

11. **Print the Phase 0 summary:**

    ```
    Roadmap preflight
      Spec:           docs/SPEC.md (N sections, K enumerated rows detected) | spec-less mode
      Target:         docs/ROADMAP.md (fresh) | docs/ROADMAP.md (update — N existing rows) | ./ROADMAP.md (spec-less)
      Drift:          none | N candidates (M renames, P reorders, Q new, R orphans) — reconcile at Gate 1
      Sprint history: N folders (sprint-1 … sprint-N), K reviewed, M unreviewed | none
      itr:            <K> open in product-backlog, <S> existing roadmap stubs
      Story style:    STORY_STYLE.md | base default — soft suggest /story-style
      kgr:            present | absent — dependency inference from spec cross-refs only
      Repos:          single (.) | multi (<list>)
      Scope:          full spec | --scope §A
      Mode:           full interview | --update (changed cells only) | --brief
    ```

    No confirmation needed at Phase 0 — proceed straight to Phase 1.

---

## Phase 1 — Scope confirm (BLOCKING — Gate 1)

Announce: `Phase 1 — Scope confirm`.

Coach: *"Before we walk every section, we agree on the section list itself. Mis-grouping here multiplies into the artifact."*

1. **Drift reconciliation (only if Phase 0 step 4 found drift candidates).** Walk each candidate one at a time. For each, present the drift type and ask the PO to choose:

   ```
   Drift detected: §A.6 "Popup UI"
     Was: §A.6 "Popup surface" (in existing ROADMAP)

   Reconcile?
     (a) Same section, accept rename — keep all rows; refresh title only.
     (b) Different section, orphan old + create new — old §A.6 row archived to a "Removed sections" appendix at the bottom of the artifact; new §A.6 starts at status ❌.
     (c) Split — old row stays for shipped scope; new row tracks remaining scope.
   ```

   Handle each drift type:
   - **Number match, title differs** → present as rename candidate, default to (a).
   - **Title match, number differs** → present as reorder candidate, default to (a) with row renumbered.
   - **In spec but not in roadmap** (new section) → no choice needed; new row added at status ❌.
   - **In roadmap but not in spec** (orphan) → present as orphan candidate, default to (b) with old row moved to "Removed sections" appendix.

   **PO answers per drift; never auto-apply.** Drift reconciliation is the most error-prone part of `--update`; silent matching is what silently desyncs the artifact.

2. **Granularity confirm.** For any section where Phase 0 step 2's heuristic was ambiguous (e.g. one numbered list but otherwise prose), surface the choice:

   ```
   §A.6 popup has 7 numbered rows in the spec. Track as:
     (a) one row §A.6 with notes covering all 7
     (b) seven rows §A.6.1 … §A.6.7
     (c) hybrid — pick which rows graduate to their own roadmap row
   ```

   Default to (b) when enumeration is unambiguous; ask (a/b/c) when mixed. PO answer locks granularity for this section across all future `--update` runs.

3. **Group the detected sections** into logical clusters. For specs with `§A`, `§B` top-level dividers, group by those. Otherwise group by `##` headings, with `###` subsections nested. Example layout:

   ```
   §A — Foundation
     §A.1   Architecture
     §A.2   Storage
     §A.3   Sync
   §A — Popup surface
     §A.5   ...
     §A.6.1 popup base
     §A.6.2 popup chonks
     §A.6.3 popup Vim nav
   §B — Sibling product
     §B.1   ...
   ```

4. **In spec-less mode**, draft a candidate section list via pure interview: *"What are the major surfaces or modules this product needs? Aim for 8–20 sections."* Capture, then group as above. Drift reconciliation and granularity confirm are skipped in spec-less mode (nothing to drift against).

5. **Print the grouped list** and ask:

   ```
   Roadmap will cover N sections in M groups:
     <grouped list>

   Will execute:
     2. Per-section status walk — agent proposes ✅/🟡/❌, PO confirms each
     3. Effort sizing — S/M/L/XL per ❌/🟡 section
     4. Dependency mapping — wide consumers flagged
     5. v1 boundary — feature-complete definition
     6. Trajectory — OPT-IN (off by default; draft sprint plan if you want one)
     7. Stub filing — itr stubs for uncovered sections (or skip with --no-itr-stubs)
     8. Gate 2 — approve before any writes

   Approve, regroup, or restrict scope?
   ```

   **Wait** for explicit approval. Accept overrides ("merge §A.7 and §A.8", "drop §B from this run", "restrict to §A.popup"). Do not proceed past Gate 1 with an unconfirmed section list.

---

## Phase 2 — Per-section status walk

Announce: `Phase 2 — Per-section status walk`.

Coach: *"Status drift is the silent killer of roadmaps. Confirming each row now is the only reliable way to keep the map honest. We'll go fast on obvious cells, slow on partial ones."*

For each section in the confirmed list, in order:

1. **Agent drafts a row** from spec + sprint history + `itr` state. The status inference uses **linked-itr-primary, title-fallback, always-PO-confirmed**:

   - **Title** — from the spec heading (or PO-confirmed phrasing in spec-less mode).
   - **Linked itr** — primary signal. Issues identified by:
     - Existing roadmap row's linked-itr cell (if `--update` and row preserved).
     - `itr` body text containing the section heading number (e.g. `§A.6.2`) — exact match.
     - For unlinked rows, run **title-keyword fallback** match: extract 2–3 noun keywords from the section title, search `itr` open/closed issues for title-keyword overlap. Surface matches as **link candidates**, not auto-linked.
   - **Status** — derived from the linked-itr set:
     - ✅ if **every** linked itr issue is closed AND every spec-enumerated row has a linked closed issue (no unmapped rows).
     - 🟡 if some linked issues are closed and some are open, OR some spec rows have no linked issues but the section has any closed work.
     - ❌ if no linked issues exist or none are closed.
   - **Draft notes** — one line summarizing the inference: `linked: itr#34 (closed sprint-2), #37 (open), #38 (open); spec rows 3-7 unlinked`.

2. **Present to PO with adaptive depth:**
   - **Fast path** (clean state — no sprint history, no `itr` coverage, draft status `❌`, no title-keyword candidates): one-shot confirmation. *"§A.11 Group vocabulary: ❌, no coverage, no linked issues, no fuzzy matches. Confirm?"*
   - **Slow path** (any inference signal): alignment-style. Show the full inference trace:

     ```
     §A.6.2 popup chonks
       Linked itr:       itr#37 (open, sprint-3 candidate)
       Title-match:      itr#41 "Refactor popup tests" — link? (y/n)
                         itr#52 "Group-grouping popup demo" — link? (y/n)
       Drafted status:   ❌
       Drafted notes:    chonks deferred to itr#37
       Confirm, edit, or override?
     ```

3. **Capture PO edits** to title, status, linked issues, notes. Don't argue — the PO has context the agent doesn't. **If PO status disagrees with inference**, record the divergence in the note as a sentinel-trailing comment (`<!-- po:override -->`) so future runs know not to silently re-infer.

4. **In `--update` mode**, the change-detection predicate for "should we re-interview this row?" is:
   - Any linked itr issue's status changed since the roadmap's `_Last updated_` timestamp, OR
   - Any new sprint folder was created with this section in its Outcomes, OR
   - Drift reconciliation in Phase 1 touched this row, OR
   - The section's spec heading line range expanded (new rows added).

   Sections that pass none of the above keep their existing row verbatim — including any PO-edited cells (preserved via the `<!-- auto -->` sentinel logic in Phase 9).

Hold the confirmed rows in memory. Nothing is written yet.

---

## Phase 3 — Effort sizing

Announce: `Phase 3 — Effort sizing`.

Coach: *"Sizing is for the PO, not for the agent. I'll propose; you correct. The point isn't precision — it's having a yardstick for trajectory and sprint scoping."*

For each section with status `❌` or `🟡`:

1. **Agent proposes a size** (S/M/L/XL) anchored on:
   - Spec section length (line count).
   - Complexity signals (decision tables, multiple subsections, cross-cutting concerns).
   - Known team velocity from prior sprints (e.g. "sprint-2 closed 7 stories ≈ L-equivalent → calibrate accordingly").

2. **PO accepts or edits** per section. For uncertain sections, fall back to alignment-style sub-questions: *"§A.15 Kinds has 7 subsections covering model, defaults, storage, identity, behavior, options-page editor, popup action. What's the smallest meaningful split you'd want to ship as one sprint? That's the size unit."*

3. **Flag XL sections.** Any section sized XL means *"too big for one sprint"* — surface for splitting in Phase 6 trajectory drafting (if trajectory is opted in) or for `/sprint` to split at scoping time.

4. **`--update` mode**: re-prompt only on rows whose status changed in Phase 2. Preserve existing sizes otherwise.

Hold sizes in memory.

---

## Phase 4 — Dependency mapping

Announce: `Phase 4 — Dependency mapping`.

Coach: *"Dependency edges are how trajectory survives contact with reality. Wide consumers must land early; missing edges cause re-sequencing surprises mid-project."*

1. **Agent proposes dependency edges** from:
   - **Spec cross-references** — sections that name other sections in their body (`§A.6 chonks reference §A.5 storage` → edge from A.6 to A.5).
   - **kgr import edges** (if available) — sections owning files that import each other.
   - **Heuristic primitives** — sections whose name implies they are consumed by multiple surfaces (e.g. "WindowPicker", "Logger", "Auth", "Schema").

2. **PO confirms or corrects each proposed edge.** Fast path for obvious edges (storage → chonks); slow path for ambiguous ones.

3. **Flag wide dependencies (4+ consumers) explicitly.** These are the sections that must land early in any trajectory to unblock downstream work. Surface them in the artifact's `Cross-cutting` section.

4. **Cycle detection.** After all edges are confirmed, run a depth-first walk over the dependency graph. If a cycle is detected (A→B and B→A, or longer rings):

   ```
   Cycle detected: §A.6 → §A.5 → §A.6
     §A.6 depends on §A.5 (chonks need storage primitives)
     §A.5 depends on §A.6 (storage tests need popup harness)

   Resolve?
     (a) Drop §A.5 → §A.6 (reverse edge is wrong)
     (b) Drop §A.6 → §A.5 (forward edge is wrong)
     (c) Split one section (e.g. extract §A.5.core to break the cycle)
     (d) Keep both, accept the cycle (trajectory will warn but not refuse)
   ```

   Don't silently accept cycles — they make trajectory drafting impossible and force `/sprint` to over-serialize.

5. **`--update` mode**: re-walk only if Phase 2 flagged a section as newly closed or newly opened — its dependents may need updating. Cycle detection always runs (cheap, and a cycle introduced by a new section is the exact case `--update` should catch).

Hold edges in memory.

---

## Phase 5 — Release boundary (v1 / v2 / never)

Announce: `Phase 5 — Release boundary`.

Coach: *"The release boundary is the line you'll push back against scope creep with. v1 is the closest line; v2 and 'never' are explicit buckets, not just 'deferred'. If you can't say what's in each, every backlog conversation will drift. This is alignment territory — we go slow."*

1. **Draft the v1 boundary** from the spec's explicit out-of-scope list (e.g. `REWRITE_SPEC.md` §E or equivalent). In spec-less mode, the boundary starts empty and is built from scratch via interview.

2. **Walk the boundary line by line.** For each item: *"is this in v1, in v2, or never?"* Capture per-line. Sections labeled `v2` get their own bucket — they remain in the roadmap with status tracking (still ❌/🟡/✅), but the artifact's `Release boundary` section shows them under `v2` rather than mixing with `v1`. Sections labeled `never` are removed from the roadmap entirely and noted in the `Excluded` appendix.

3. **Surface ambiguous sections from Phase 2 that need v1 disambiguation.** *"§A.17 Bookmark match is marked 🟡 — what's the minimum viable surface for v1? Tab badge only, or tab badge + URL-match-mode selector?"* Alignment-style.

4. **Draft a final boundary** as bullet points:

   ```
   v1 ships when:
     - All §A sections (in v1) are ✅
     - <project-specific qualifier, e.g. "Chrome+Firefox QA passes">
     - <project-specific qualifier, e.g. "Secrets rotated">

   v2 scope (tracked, deferred):
     - §A.17 Bookmark match (URL-mode selector)
     - §B.4 Sibling sync polish

   Excluded (never):
     - <section> — out of scope, rationale: ...
   ```

   Confirm with PO. Edits land in the artifact directly. Sections in the `v2` bucket continue to receive status updates from sprint cycles; sections in `Excluded` are frozen.

5. **`--update` mode**: re-walk only if the spec's out-of-scope list changed since last update, or if any section moved between v1 / v2 / never. Otherwise preserve the existing boundary.

---

## Phase 6 — Trajectory (opt-in)

Announce: `Phase 6 — Trajectory (opt-in)`.

Coach: *"A trajectory is a planning aid, not a commitment. The next `/sprint` re-derives ordering from current backlog state. If you want a draft, I'll write it and label it 'draft'; if you'd rather just have the status map, that's the default."*

1. **Ask the PO** with `AskUserQuestion`:
   - **Skip trajectory** (Recommended) — write the status map only; `/sprint` re-derives sprint goals each cycle.
   - **Draft a trajectory** — agent proposes sprint-N+1 through sprint-N+M groupings respecting dependencies + sizes.

2. **If trajectory is drafted:**
   - Group `❌` and `🟡` sections into sprint-sized chunks respecting dependency edges (wide consumers go first; XL sections get split-flagged).
   - PO accepts, edits, or scraps per sprint.
   - **Always label trajectory as `draft, refined at each /sprint`.** Never as commitment. The header in the artifact carries this disclaimer in bold.

3. **`--update` mode**: ask whether to refresh the existing trajectory. Default = preserve unless PO says otherwise (trajectory is the cell most likely to drift; over-refreshing is churn).

---

## Phase 7 — Stub filing (BLOCKING — Gate 2 preview)

Announce: `Phase 7 — Stub filing`.

Coach: *"Sections with status ❌ and no linked itr issues are invisible to `/sprint` — it can't pull what isn't there. Stubs fix that. You decide the volume."*

**Skip this phase entirely if `--no-itr-stubs` was passed.** Print `Stub filing skipped (--no-itr-stubs).` and proceed to Phase 8.

1. **Identify candidates.** Filter the in-memory rows: status ❌ AND zero linked `itr` issues. Then **dedup against existing roadmap stubs** loaded in Phase 0 step 6: drop any candidate whose section number appears in the body of an existing `roadmap-stub`-tagged issue (matching on the literal `§A.X` token). Print the candidate list plus deduped count:

   ```
   Stub candidates (N sections with no backlog coverage):
     §A.11  Group vocabulary       (size M)
     §A.16  WindowPicker           (size S, wide dependency — 4 consumers)
     §B.3   Sibling import flow    (size L)
     ...

   Already-stubbed (skipped to avoid duplicates):
     §A.7   Window auto-grouping   → existing stub itr#198
     §A.12  Theme switcher         → existing stub itr#201
   ```

2. **Ask the PO** with `AskUserQuestion`:
   - **File all** — default for `--update` runs (steady state, low volume).
   - **File none** — defer all to a future cycle.
   - **Pick which** — default for first run (initial volume is heavy; PO picks selectively).

   On **pick which**, walk the candidate list with per-item yes/no.

3. **Draft each stub issue** using `STORY_STYLE.md` conventions (defer to `itr` skill):
   - **Title** — from spec section title.
   - **Body** — must contain the section number as a literal token (e.g. `§A.16`) on its own line; this is what future `/roadmap` runs use for dedup. Also include a link to the spec section (file + heading) and a one-liner: `Tracked by roadmap row §A.16. AC will be drafted at /sprint scoping time (Phase 3 Step 0).`
   - **AC** — left empty (this is a stub; AC drafts at sprint scoping time per `/sprint` Phase 3 Step 0).
   - **Kind** — `task`.
   - **Tags** — `roadmap-stub, needs-sprint, product-backlog, risk:<tier-from-size>` (XL→high, L→med, S/M→low).

4. **Print the full stub list** for PO approval before Gate 2:

   ```
   Will file at Gate 2:
     [task] "Implement Group vocabulary"          tags: roadmap-stub, needs-sprint, product-backlog
     [task] "Build WindowPicker primitive"        tags: roadmap-stub, needs-sprint, product-backlog
     ...
   ```

   Hold drafts. Do not file yet — filing happens at Phase 8 after Gate 2.

---

## Phase 8 — Final review (BLOCKING — Gate 2)

Announce: `Phase 8 — Final review`.

Print the full picture so the PO can approve everything in one look:

```
Roadmap — sprint-N baseline

Sections:           <total> total — <closed> ✅, <partial> 🟡, <open> ❌
v1 boundary:        <K> sections in v1, <M> deferred to v2, <P> excluded
Wide dependencies:  <N> sections flagged
Trajectory:         drafted (sprint-N+1 … sprint-N+M) | skipped (recommended)
Stubs to file:      <N> stubs | none (--no-itr-stubs) | none (PO declined)

Will write:
  1. <K> new itr stubs (tags: roadmap-stub, needs-sprint, product-backlog)
  2. docs/ROADMAP.md (or ./ROADMAP.md for spec-less) — full table + boundary + cross-cutting + optional trajectory
  3. (--update only) preserve existing rows except those flagged changed in Phase 2

Approve, amend, or abort?
```

**Wait** for explicit approval. Accept edits ("drop the trajectory section", "don't file stub #3", "change §A.16 from L to M"). Reprint until the PO approves. If `--dry-run`, print this and stop here without writing anything.

**Feature-complete celebration:** if every section in the confirmed list is ✅, print one extra line before the prompt:

```
🎉 All sections complete. v1 feature-complete baseline reached.
   Roadmap can still be updated to record the milestone; future cycles can re-open with new scope.
```

No release-note generation — that's a separate concern (out of scope for `/roadmap`).

---

## Phase 9 — Apply

Announce: `Phase 9 — Applying changes`.

Order matters — file stubs first so the artifact can reference real IDs:

1. **File the stubs** via `itr batch add` (if any). Capture every new ID. On partial failure: retry once per item; if retry fails, surface failed payloads and resume (no rollback) — same pattern as `/sprint` Phase 5.

2. **Write the artifact with `<!-- auto -->` sentinel markers.**

   Every agent-drafted cell gets a trailing `<!-- auto -->` HTML comment marker inside the table cell:

   ```
   | §A.6.2 popup chonks | 🟡 <!-- auto --> | M <!-- auto --> | itr#37 <!-- auto --> | chonks deferred to sprint-3 <!-- auto --> |
   ```

   The sentinel encodes a contract: **agent owns the cell; `--update` will refresh it.**

   When a PO manually edits a cell, they remove the sentinel (or the cell is overwritten without one). On the next `--update`:
   - Cells **with sentinel** → eligible for refresh per Phase 2 step 4's change-detection predicate.
   - Cells **without sentinel** → preserved verbatim (PO owns; agent never overwrites).
   - PO override sentinel (`<!-- po:override -->` from Phase 2 step 3) → preserved AND propagated so future runs don't re-infer.

   Write modes:
   - **Fresh draft**: write `docs/ROADMAP.md` (or `./ROADMAP.md` in spec-less mode) using the schema below; every cell carries `<!-- auto -->`.
   - **`--update` mode**: read existing file, walk every cell, refresh only sentineled cells where the change-detection predicate fires. Preserve un-sentineled cells (PO edits) and `<!-- po:override -->` cells verbatim. Phase 1 drift reconciliation may also move/orphan rows; those moves are applied here.
   - **`--brief` mode**: render the abridged schema (status + linked issues only; no notes column). Sentinels still apply.
   - **Multi-repo mode**: when `--scope` spans repos, write a single roadmap at the orchestrating repo root (default current dir). Section rows declare repo prefix when the section lives elsewhere (e.g. `§B.1 sibling-repo:import flow`). One artifact per orchestrator, not per repo — the roadmap is the cross-repo view.

3. **Append an update log line** at the top of the file:

   ```
   _Last updated: 2026-05-15 (post-/sprint-review-2)_
   ```

   For fresh drafts the log shows the trigger context (`/sprint-review-2`, `/init follow-up`, or `manual run`).

---

## Phase 10 — Final report

Announce: `Phase 10 — Roadmap written`.

Print:

```
Roadmap baseline established (or updated).

  Spec:               docs/SPEC.md (N sections) | spec-less mode
  Artifact:           docs/ROADMAP.md (or ./ROADMAP.md)
  Sections:           <closed> ✅, <partial> 🟡, <open> ❌  (total: N)
  v1 boundary:        <K> in, <M> deferred, <P> excluded
  Wide dependencies:  <N> sections (early-land candidates)
  Trajectory:         drafted (sprint-N+1 … +M) | skipped
  Stubs filed:        <N> new itr issues | none

Next:
  - Read `docs/ROADMAP.md` at the start of every `/sprint` to inform sprint goal selection.
  - `/sprint-review` Phase 8 calls `/roadmap --update` automatically to keep status current.
  - Re-run `/roadmap` manually when the spec changes (add/remove sections).
```

Stop.

---

## ROADMAP.md schema (the rendered file)

```markdown
# Roadmap — <project name>

_Last updated: YYYY-MM-DD (post-<trigger>)_

> Cross-sprint product map. Bridges `docs/SPEC.md` and the live `itr` backlog.
> Read at the start of every `/sprint`. Updated at the end of every `/sprint-review`.

## Status legend

- ✅ — section is feature-complete (all subsections shipped, AC met)
- 🟡 — partial (some subsections shipped, others scoped or unscoped)
- ❌ — not started (no sprint has touched this; may have stubs filed)

Cells with a trailing `<!-- auto -->` marker are agent-owned and refreshed by `/roadmap --update`. Cells without the marker are PO-edited and preserved verbatim. A `<!-- po:override -->` marker pins a PO-asserted status against future inference.

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

## Trajectory _(draft — refined at each /sprint)_

> This section is opt-in. If absent, `/sprint` re-derives ordering each cycle from current backlog state and dependency edges.

- **Sprint-N+1** — §A.11 Group vocab, §A.16 WindowPicker (wide dep, land early)
- **Sprint-N+2** — §A.15 Kinds (split: model + storage), §A.6.2 popup chonks
- ...

## Removed sections _(historical)_

Sections orphaned by spec drift but with shipped scope worth preserving for audit:

- §A.9 Tab quicklist _(removed from spec 2026-04-22; shipped scope was itr#88 sprint-1)_

## Update cadence

- Read at start of every `/sprint` (Phase 0 surfaces next ❌/🟡 sections).
- Updated at end of every `/sprint-review` (Phase 8 calls `/roadmap --update`).
- Manually re-run `/roadmap` when the spec gains or loses sections, or to handle drift reconciliation.
```

The `--brief` variant omits the `Notes`, `Cross-cutting`, `Trajectory`, and `Removed sections` blocks — keeps only the status legend, release boundary, and the per-group table reduced to `Section | Status | Linked itr`. Sentinels still apply.

---

## Integration with other skills

| Skill | How `/roadmap` integrates |
|---|---|
| `/init` | If a spec exists at `/init` time, `/init`'s final-report output should soft-suggest `/roadmap` (same pattern `/sprint` uses to suggest `/story-style`). New projects with no spec yet: don't suggest. |
| `/alignment` | `/roadmap` does NOT call `/alignment` as a sub-skill. Instead, it borrows alignment's DNA — relentless per-decision interview — in Phases 2, 3, 5. If a Phase 5 v1-boundary question is too complex to answer in one shot, the PO can pivot to `/alignment` manually, then resume `/roadmap`. |
| `/story-style` | `/roadmap` reads `STORY_STYLE.md` (if present) before Phase 7 stub filing so the stubs match project conventions. Same defer pattern as `/sprint`. |
| `/sprint` | `/sprint` Phase 0 reads `docs/ROADMAP.md` (if present) to inform sprint goal selection. Surfaces the next ❌/🟡 section in trajectory order (or, if no trajectory, in dependency order with wide-deps first) as a soft suggest, not a forced choice. **Divergence feedback:** if the PO picks a Sprint Goal that does NOT match the roadmap soft-suggest, `/sprint` records this in the sprint's Open Assumptions log; `/sprint-review` Phase 8 passes the divergence note to `/roadmap --update` (via env var `ROADMAP_DIVERGENCE_NOTE` or a tmpfile pointer), which appends it to the affected row's notes for next-cycle context. |
| `/blitz` | No direct integration. `/blitz` executes a sprint; the roadmap doesn't shape execution. |
| `/sprint-review` | **Update hook.** `/sprint-review` Phase 8 adds a step: `/roadmap --update`. Non-blocking; if `--update` errors, log and proceed (roadmap can always be refreshed manually). Passes any sprint-goal divergence note from the closed sprint's Open Assumptions log into the update (see `/sprint` row above). |
| `itr` skill | `/roadmap` Phase 7 defers to `itr` for stub creation (same as `/sprint` Phase 5). All stubs flow through `itr batch add` with `STORY_STYLE.md` conventions. |
| `kgr` | If present, Phase 4 uses `kgr query --who-imports` to confirm import-edge dependencies. Optional; the skill works without it. |

---

## Multi-repo handling

The strong default is **one roadmap per repo**. Multi-repo is a feature, not a default — invoke it only when the spec genuinely spans repos (e.g. `§A` lives in `tab-manager/`, `§B` lives in `sibling-product/`).

When `--scope` selects sections living in sibling repos (or when the spec body declares `Repo: path/to/repo` on a section heading):

- **Phase 0:** collect the unique repo set in step 7; surface under `Repos:` in the summary print. For each repo, read its own `itr` db and `sprint/` history.
- **Phase 2 (status walk):** linked-itr inference treats each repo's `.itr.db` independently; surface repo prefix on linked issue IDs (e.g. `sibling:itr#12`).
- **Phase 4 (deps):** dependency edges across repos are allowed and explicitly flagged as `cross-repo` — they often correlate with wide dependencies (a primitive in one repo consumed by surfaces in another).
- **Phase 7 (stubs):** stubs file into each section's owning repo's `itr` db, not the orchestrating repo's. The roadmap row references stubs with repo-prefixed IDs.
- **Phase 9 (write):** one artifact at the orchestrator's repo root (default current dir). Sections declare their repo prefix in the row when they live elsewhere.

Cross-repo roadmaps are higher-touch than single-repo ones — ambiguity in spec ownership multiplies across boundaries. The PO is the single source of truth for "does this section live in repo X or Y" — agent never guesses.

---

## Coaching style (Scrum Master tone)

- **Announce every phase by name** (`Phase 0 — ...`, `Phase 1 — ...`). Same structured-output principle as `/sprint` and `/sprint-review`.
- **Coach the *why* of each cell** in one short line as you reach it:
  - *"Status drift is the silent killer of roadmaps."*
  - *"Sizing is for the PO; I'll propose, you correct."*
  - *"Wide dependencies must land early or they re-sequence the project."*
  - *"v1 is the line you'll push back against scope creep with."*
  - *"A trajectory is a planning aid, not a commitment."*
- **Adaptive depth per row.** Fast path on obvious cells (no history → ❌, one-shot confirm); slow path on partial-state cells (alignment-style grilling). The PO learns the rhythm.
- **Agent proposes, PO disposes.** Every status / size / dep / boundary cell is agent-drafted, PO-confirmed. Never assert without giving the PO a chance to redirect.
- **One sprint of language at a time.** Scrum vocabulary (Product Backlog, Sprint Backlog, Increment, Definition of Done) is consistent across `/sprint`, `/sprint-review`, and `/roadmap`. Reusing terms is what builds the PO's mental model.

---

## Principles

- **Bridge, not authority.** The roadmap is connecting tissue between spec and `itr`. The spec defines scope; `itr` defines live work; the roadmap maps one to the other. It doesn't override either.
- **Read-once-per-sprint cadence.** The roadmap is consulted by every `/sprint` Phase 0 and updated by every `/sprint-review` Phase 8. Manual `/roadmap` runs are rare — for fresh drafts or spec changes.
- **Per-section PO confirmation is the only non-negotiable interaction.** Every other coach line, every other proposal — those are surface, not gate. The per-section walk is what makes the artifact load-bearing.
- **Two BLOCKING gates, no more.** Gate 1 confirms scope/section list; Gate 2 approves the full picture before any writes. Per-section walks in Phase 2 are inline, not gates.
- **Trajectory is opt-in.** Drafting a sprint plan in the roadmap risks commitment-shaped output. Default is no trajectory; `/sprint` re-derives ordering each cycle.
- **Stubs are how spec sections become pullable.** `/sprint` can't pull a section that has no `itr` presence. Phase 7 creates that presence — selectively on first run, comprehensively on `--update`.
- **The artifact is the durable record.** `docs/ROADMAP.md` ends each cycle with the current map. Reading it tells anyone — agent or human — where the project stands without re-deriving from sprint history.
- **Spec-less mode is supported but discouraged.** It works, but the coach line at Phase 0 reminds the PO that `/alignment` first is the higher-leverage path.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. Once Phase 9 lands the artifact, commit it — the durable record belongs in history, and the PO can opt out per this rule. A `--dry-run` writes nothing and so has nothing to commit.

---

## Don't

- Don't proceed past Gate 1 without an approved section list.
- Don't proceed past Gate 2 without explicit approval of stubs + artifact + boundary.
- Don't write to `itr` or the artifact before Gate 2.
- Don't infer a status without surfacing the inference for PO confirmation.
- Don't draft a trajectory unless the PO opted in at Phase 6.
- Don't overwrite an existing `docs/ROADMAP.md` without confirming fresh vs update mode at Phase 0.
- Don't silently overwrite PO manual edits in `--update` mode. The `<!-- auto -->` sentinel is the contract: refresh sentineled cells; preserve un-sentineled and `<!-- po:override -->` cells verbatim.
- Don't silently re-match drifted sections. Every drift (rename, reorder, orphan, new) gets surfaced at Phase 1 for PO reconciliation. Auto-matching is what silently desyncs the artifact.
- Don't double-file roadmap stubs on re-run. Phase 7 dedups against existing `roadmap-stub`-tagged issues by section-number token.
- Don't accept dependency cycles silently. Phase 4 cycle detection surfaces every ring for PO resolution.
- Don't infer status from title-keyword match alone. Linked-itr is primary; title-fallback always offers links as candidates, never auto-applies.
- Don't file roadmap stubs without `STORY_STYLE.md` conventions if the file is present.
- Don't generate release notes when the project hits feature-complete — that's a separate concern. Celebrate the milestone with one line, stop there.
- Don't call `/sprint` or `/blitz` from this skill — handoff happens by the PO reading the artifact, not by automation.
- Don't review more than one repo's roadmap per invocation. Use `--scope` to narrow within a repo; re-run for separate repos.
- Don't lecture — coach in one line per cell. Verbose is fine; preachy is not.
