# Workflow brief — `/roadmap` skill

A design brief, not the final `SKILL.md`. Convert this into `~/.claude/skills/roadmap/SKILL.md` after iterating on the workflow shape.

This document captures:
1. **Findings** — why the project needed a roadmap and didn't have one
2. **What I actually did** to produce `docs/ROADMAP.md` (sub-optimal, reactive)
3. **What I would have done with optimal time** (proactive, alignment-driven)
4. **The proposed skill workflow** — phase shape, integration points, update cadence
5. **Open design questions** for the user before converting to a skill

---

## 1. Findings — why this gap exists

`/sprint` plans one sprint at a time. `/sprint-review` closes one sprint at a time. Neither answers *"are we feature-complete yet?"* — the question that asks how much work remains across the whole product, where the dependencies cluster, and what the v1 finish line actually is.

In this project the gap surfaced organically at the end of sprint-2:

- Spec scope: 22 subsections (§A.1–§A.17 + §B.1–§B.5) in `docs/REWRITE_SPEC.md`.
- Live execution: 7 sprint-1 stories + 7 sprint-2 stories + ~30 backlog items in `itr`.
- Connecting tissue between the two: **nothing**, until the PO asked at /sprint-review.

Without that connecting tissue:

- **Sprint planning** had no map of "what's next after this one" — `/sprint` derives ordering from current backlog, not from the long view. Sprint-2 happened to pull §A.6 rows 1+2 because the PO knew that was next; nothing structural enforced it.
- **PO had no v1 boundary** to push back against scope creep with. "Is this in v1?" was answerable only by re-reading the spec each time.
- **Wide dependencies** like §A.16 WindowPicker (consumed by 4 surfaces) weren't visible until someone went looking — risking late discovery and forced re-sequencing.
- **Status drift** between the spec and reality was invisible. Sections shipped as ✅ in retros stayed buried in retro files; nobody had a single place to flip the bit.

The roadmap I drafted (`docs/ROADMAP.md`) fills this. The question is how to produce and maintain it reliably across projects, not as a one-shot deliverable.

---

## 2. What I actually did (sub-optimal)

Method I used in this session, in order:

1. **Reactive trigger.** PO asked at the end of /sprint-review-2: *"do we have a map?"* Answer: no. I offered to draft one. Sub-optimal because the value would have been highest at sprint-1 planning, not at sprint-2 close.
2. **One mode-pick question.** AskUserQuestion with 4 options for what kind of artifact to produce. PO picked `docs/ROADMAP.md`. Reasonable, but I then went silent and one-shot the artifact.
3. **Section ingestion via grep.** I ran `grep -nE '^### '` against `REWRITE_SPEC.md` to enumerate subsections. Then `sed -n` slices to read the ones I wasn't sure about (§A.5, §A.7/8, §A.11/12, §A.15, §A.16/17, §B). Adequate for a known-spec project; useless if the project had no spec yet.
4. **Status inference from sprints + itr.** I cross-referenced sprint-1 + sprint-2 outcomes against the spec subsections to mark ✅/🟡/❌. This is the part the PO couldn't easily do themselves — but I also did it without PO confirmation per section.
5. **Effort sizing.** I assigned S/M/L/XL per section based on my own guess. **Sub-optimal:** the PO knows their own team's velocity; my sizes are anchored to nothing.
6. **Dependency mapping.** I noted §A.16 WindowPicker as a wide dependency and a few storage-blocks-chonks relationships. **Sub-optimal:** I caught the obvious ones; the PO might know subtler couplings I missed.
7. **Sprint trajectory.** I drew up a sprint-3-through-sprint-14 plan. **Sub-optimal:** this is a planning artifact masquerading as a status report. The PO never agreed to it; if they read the doc as commitment, expectations and reality drift.
8. **v1 definition.** I extracted v1 boundary from `REWRITE_SPEC.md` §E (the explicit out-of-scope list). Adequate when the spec is well-formed; not viable for fuzzier projects.
9. **Wrote the file.** Single Write call, ~140 lines.

**What's wrong with this method:**

- Single-pass with no per-section gate. PO didn't get to grill any single section's status or sizing.
- I inserted myself into product decisions (sprint trajectory, v1 boundary) that should be PO-confirmed, not agent-asserted.
- No integration with `/sprint-review` to update it. The doc says "updated at /sprint-review" but no mechanism exists to actually do that.
- No itr issue stubs for sections with zero coverage — sections like §A.11 Group vocabulary and §A.16 WindowPicker have no backlog presence; the roadmap mentions them but `/sprint` can't pull them.

---

## 3. What optimal looks like

If I had time and the right primitive (this proposed skill), the flow would look like:

### When to run
- **Primary:** right after `/init` produces CLAUDE.md, and after a spec exists (`docs/SPEC.md` or equivalent), and **before** the first `/sprint`. This is the natural moment — the spec is locked, no sprints have executed yet, status is trivially "everything is ❌."
- **Mid-project:** when PO realizes the map is missing (this session's scenario). Skill detects existing sprints + itr state and re-derives baseline.
- **At a spec update:** the spec changes (alignment session adds a section), the skill is re-run to add the new rows.

### What changes vs. my method
- **Replace one mode-pick with a structured 6-phase walk** (sketched below).
- **Per-section PO confirmation:** every status / effort / dependency cell has the PO's eyes on it before it lands in the artifact. Adaptive depth — short sections get a single yes/no, big ones get an alignment-style grilling.
- **Agent proposes, PO disposes.** I draft status / sizing / dependencies from the spec + sprint history. PO accepts, edits, or rejects each.
- **Sprint trajectory is optional and clearly labelled "draft."** The default is *no trajectory* — `/sprint` re-derives ordering each cycle. Trajectory is a planning aid only, off by default.
- **File stub itr issues** for sections with zero backlog coverage, tagged `roadmap-stub, needs-sprint, product-backlog`. So `/sprint` can actually pull them later.
- **Register the update hook** in `sprint-review`'s output so the roadmap status stays current.

---

## 4. Proposed skill — `/roadmap`

### Frontmatter (rough)

```yaml
name: roadmap
description: Produce or update docs/ROADMAP.md — the bridge between a locked spec and the live itr backlog. Walks the PO section-by-section to establish status, effort sizing, dependencies, and the v1 feature-complete boundary. Trigger when the user types /roadmap, or asks to "draft a roadmap", "map the work", "what's left to ship", "are we feature-complete yet", "show the work plan", or similar phrasing. Read-once-per-sprint artifact; updates land at /sprint-review. Do NOT use for one-off backlog questions (use itr), single-sprint planning (use /sprint), or status reports on closed sprints (use /sprint-review).
```

### Slash invocation

```
/roadmap [--spec <path>] [--no-itr-stubs] [--update] [--dry-run]
```

| Form | Meaning |
|---|---|
| `/roadmap` | Default. Auto-detect spec (`docs/SPEC.md`, `docs/REWRITE_SPEC.md`, `README.md`, `CLAUDE.md`); auto-detect sprint history + itr; full interview. |
| `--spec <path>` | Override spec detection. |
| `--no-itr-stubs` | Don't file roadmap-stub issues for uncovered sections. |
| `--update` | Existing `docs/ROADMAP.md` found — interview only the rows whose status may have changed since the last update. Used by `/sprint-review`. |
| `--dry-run` | Run all phases including alignment, print what would have been written/filed, no writes. |

### Roles & artifacts

- **PO** owns: section status, effort sizing, dependency confirmations, v1 boundary, sprint trajectory (if drafted).
- **Skill** owns: spec parsing, sprint-history cross-reference, itr cross-reference, artifact drafting, itr stub filing.
- **Primary artifact:** `docs/ROADMAP.md` (read-once-per-sprint, updated at `/sprint-review`).
- **Secondary writes:** roadmap-stub `itr` issues for sections with zero backlog coverage (if not `--no-itr-stubs`).

### Phase walkthrough

#### Phase 0 — Preflight
1. Detect spec (priority: `--spec` arg → `docs/REWRITE_SPEC.md` → `docs/SPEC.md` → `README.md` → `CLAUDE.md`). If none, ask PO for a path OR pivot to "spec-less mode" (interview from scratch — like `/story-style`'s pure-interview path).
2. Parse spec section headings (markdown `##` and `###`). Capture title + line number range.
3. Detect existing `docs/ROADMAP.md`. If present and not `--update`: ask if this is a fresh draft or an in-place update.
4. Detect sprint history: list `sprint/sprint-*/` folders, read each `plan.md` Outcomes table.
5. Detect itr: run `itr list --status open --tags product-backlog -f json` to get the open backlog.
6. Detect any `STORY_STYLE.md` (for stub-issue field shape).
7. Print Phase 0 summary: spec, # of sections detected, # of sprints in history, # of open backlog items, target artifact path.

#### Phase 1 — Scope confirm (BLOCKING — Gate 1)
Same pattern as `/sprint` Phase 1: print the detected spec sections grouped (e.g., §A foundation, §A popup, §A storage, §B sibling), confirm the grouping makes sense, give PO chance to redirect.

#### Phase 2 — Per-section status walk (the heart of the skill)
For each spec section, in order:

1. **Agent drafts a status row:** title from spec, status (✅/🟡/❌) inferred from sprint outcomes, linked itr issues from backlog tag search, draft notes.
2. **Present to PO** — *fast path* for sections with clean state (no sprint history + no itr coverage = automatic ❌; ask for confirm only). *Slow path* for partial-state sections — alignment-style: *"§A.6 popup has rows 1+2 ✅ from sprint-2 but rows 3-7 are unscoped, chonks are deferred to itr#37, Vim nav to itr#38. Status: 🟡 partial. Confirm or correct?"*
3. **Capture PO's edits** to title, status, linked issues, notes. Don't argue — PO has context the agent doesn't.

Coach (alignment-style): *"Status drift is the silent killer of roadmaps. Confirming each row now is the only reliable way to keep the map honest."*

#### Phase 3 — Effort sizing
For each ❌ / 🟡 section:

1. Agent proposes a size (S/M/L/XL) based on spec section length, complexity signals (tables, decision lists, etc.), and known team velocity.
2. PO accepts or edits per section. If the PO is uncertain on a size, invoke alignment-style sub-questions: *"§A.15 Kinds has 7 subsections covering model, defaults, storage, identity, behavior, options-page editor, popup action. What's the smallest meaningful split you'd want to ship?"*
3. Collect sizes; flag any XL sections for splitting in a follow-up `/sprint` cycle.

#### Phase 4 — Dependency mapping
1. Agent proposes dependency edges based on spec cross-references (e.g., "§A.6 chonks reference §A.5 storage") and known wide-consumers (e.g., a primitive used by 4 sections).
2. PO confirms each edge or corrects.
3. Flag **wide dependencies** (4+ consumers) explicitly — these are the sections that should land early in any trajectory to unblock downstream work.

#### Phase 5 — v1 boundary (alignment territory)
This is the section that justifies running `/alignment` style questioning hardest.

1. If the spec has an explicit "out of scope" list (`REWRITE_SPEC.md` §E in this project), draft the v1 boundary from it.
2. Walk the PO through the boundary line by line. Each line: *"is this in v1, in v2, or never?"*
3. Capture the v1 definition as bullet points (e.g., "v1 ships when all of §A is closed + Tabitha.pem rotated + Chrome+Firefox QA passes").
4. Surface anything ambiguous — alignment-style: *"§A.17 Bookmark match is 'partial' — what's the minimum viable surface for v1? Tab badge only, or tab badge + URL-match-mode selector?"*

#### Phase 6 — Trajectory (optional, opt-in)
1. Ask PO: *"Do you want a draft sprint trajectory, or just the status map?"*
2. If yes: agent proposes sprint-N+1 through sprint-N+M groupings respecting dependencies + sizing. PO accepts, edits, or scraps.
3. **Always label trajectory as "draft, refined at each /sprint."** Never as commitment.

#### Phase 7 — Stub filing (BLOCKING — Gate 2)
1. Identify sections with status ❌ and zero linked itr issues.
2. Draft stub issues per section: kind `task`, tags `roadmap-stub, needs-sprint, product-backlog`, title from spec, body links back to spec section + the roadmap row.
3. Print the stub list; PO approves or amends.
4. **Skip if `--no-itr-stubs` was passed.**

#### Phase 8 — Apply
1. **File the stub issues** via `itr batch add` (if not `--no-itr-stubs`).
2. **Write `docs/ROADMAP.md`** with the structure I produced this session (status legend, per-section table, cross-cutting, optional trajectory, v1 definition, update cadence note).
3. **If updating in place** (`--update`): preserve existing rows, change only the cells that changed, append new rows if spec sections were added.

#### Phase 9 — Final report
Print the summary, including how to keep it updated:
- Read at start of each `/sprint`.
- Update at end of each `/sprint-review` (or run `/roadmap --update`).

---

## 5. Integration with other skills

| Skill | How `/roadmap` integrates |
|---|---|
| `/init` | If a spec exists at `/init` time, soft-suggest `/roadmap` at the end of `/init`'s output (same pattern as `/sprint` soft-suggesting `/story-style`). New projects with no spec yet: don't suggest. |
| `/alignment` | **`/roadmap` does NOT call `/alignment` as a sub-skill.** Instead, `/roadmap` borrows alignment's DNA — relentless per-decision interview — in Phases 2, 3, 5. The recommended-answer pattern (*"my recommendation is X, accept/edit/reject?"*) is the same. If a Phase 5 v1-boundary question is too complex to answer in one shot, PO can pivot to `/alignment` manually, then resume `/roadmap`. |
| `/story-style` | `/roadmap` reads `STORY_STYLE.md` (if present) before Phase 7 stub filing so the stubs match project conventions. Same defer pattern as `/sprint`. |
| `/sprint` | `/sprint` Phase 0 reads `docs/ROADMAP.md` (if present) to inform sprint goal selection. Surfaces the next ❌/🟡 section in trajectory order as a soft suggest, not a forced choice. |
| `/blitz` | No direct integration. `/blitz` executes a sprint; the roadmap doesn't shape execution. |
| `/sprint-review` | **Update hook.** `/sprint-review` Phase 8 adds a step: *"Update `docs/ROADMAP.md` — flip closed sections to ✅, update notes, add new itr issues to linked-issues cells."* Calls `/roadmap --update` or does the in-place edit directly. |
| `itr` skill | `/roadmap` Phase 7 defers to `itr` for stub creation (same as `/sprint` Phase 5). |
| `kgr` | If present, can be used in Phase 2 to detect "which spec sections have implementation evidence" — e.g., `kgr query --who-imports` against files declared in spec sections. Out of scope for v1 of this skill; nice-to-have later. |

---

## 6. Open design questions

Resolve these before converting to `SKILL.md`:

1. **Default trajectory: on or off?** This brief recommends *off by default* (PO must opt in at Phase 6) because trajectory is a commitment-shaped output that's too easy to misread. Alternative: *on by default*, since the PO usually wants it and turning it off is the rare case. **Suggest:** off-by-default, but with a strong inline coach line at Phase 6 explaining why it's optional.

2. **Update cadence: pull or push?** *Pull* = `/sprint-review` calls `/roadmap --update`. *Push* = PO manually re-runs `/roadmap`. **Suggest:** pull — add to `/sprint-review` Phase 8 as a non-blocking step.

3. **Stub filing: on or off by default?** Filing 12+ stubs at first-run is heavy. **Suggest:** ask PO at Phase 7 with `(file all / file none / pick which)`. Default `pick which` for the first run; default `file all` for `--update`.

4. **Spec-less mode.** For projects without a spec, the skill could do pure interview (like `/story-style`'s pure-interview path) to draft a spec-equivalent section list. Alternative: refuse to run, suggest the PO write a spec first. **Suggest:** support spec-less mode with a strong coach line: *"A roadmap without a spec is a wishlist. If you don't have a spec, /alignment first."*

5. **One roadmap per project, or per product?** This project has two products (Tab Manager + DevTools sibling) in one repo, captured as §A and §B. Monorepos with truly separate products might want separate roadmaps. **Suggest:** one per repo by default; offer `--scope <section>` to scope to a subset.

6. **Where does the doc live?** `docs/ROADMAP.md` is my pick (matches `docs/REWRITE_SPEC.md` convention). Alternatives: repo-root `ROADMAP.md` (more visible), `sprint/ROADMAP.md` (next to sprint history). **Suggest:** `docs/ROADMAP.md` for spec-having projects; repo-root for spec-less projects.

7. **How verbose should the roadmap be?** My one-shot draft was ~140 lines with multiple tables. For 50+ section projects this could balloon. **Suggest:** keep table-shape; add `--brief` flag for summary-only mode (just status + linked issues, no notes).

8. **Should `/roadmap` ever close-out the project?** When all sections are ✅: should it print "you're feature-complete" + offer to write a v1 release note? Or stay scoped to status-tracking only? **Suggest:** print the milestone with a one-line celebrate, but don't generate release notes — that's a separate concern.

---

## 7. Migration path — this session's artifact → future skill

The `docs/ROADMAP.md` produced in this session is roughly the shape of what `/roadmap` would output. Differences to expect when the skill exists:

- **Per-section PO sign-off** — each row's status, sizing, deps will have been confirmed, not inferred.
- **No sprint trajectory by default** — the current trajectory section was agent-asserted; future runs will only have one if the PO opted in.
- **Stub itr issues filed** — sections like §A.11, §A.16, parts of §A.7 currently say "none filed" in linked-issues; future runs would either file stubs or note the deliberate skip.
- **An update note at the top** — future runs will append a one-line "updated 2026-MM-DD at /sprint-review-N" line each cycle.

The current artifact is good enough to ship sprint-3 from. Re-run when the skill exists to capture the missing alignment.

---

## 8. Skill author checklist

Before this brief becomes `~/.claude/skills/roadmap/SKILL.md`:

- [ ] Resolve the 8 open design questions above.
- [ ] Mirror the structural conventions of `/sprint` and `/sprint-review` — Phase 0 preflight, Gate-1 scope confirm, Gate-2 apply, Phase N final report.
- [ ] Add a `/sprint` Phase 0 hook reading `docs/ROADMAP.md` (soft suggest, not gate).
- [ ] Add a `/sprint-review` Phase 8 step calling `/roadmap --update`.
- [ ] Decide on coach tone — same Scrum Master tone as `/sprint` and `/sprint-review`, or a different role (Product Manager? Architect?).
- [ ] Cross-test on a clean repo (spec-less mode) and on this repo's mid-project state (sprint-2 done).
- [ ] Verify `--update` actually preserves manual PO edits to the existing ROADMAP.md — that's a behaviour test worth writing.

---

*Drafted 2026-05-15 by the agent that produced `docs/ROADMAP.md` at the end of sprint-2 /sprint-review. Findings are based on a single project (Tabula) and one cycle of /sprint + /blitz + /sprint-review. Generalisation to other projects is unconfirmed.*
