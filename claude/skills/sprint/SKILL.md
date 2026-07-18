---
name: sprint
description: "Take a Claude `/plan`, a markdown spec, or a recent conversation and turn it into a fully-groomed Sprint backlog filed in `itr` — single Sprint Goal, prioritized stories, declared file ownership, and a baked-in Definition of Done. Trigger when the user types `/sprint`, or asks to \"plan a sprint\", \"let's do sprint planning\", \"groom this into a sprint\", \"turn this spec into a sprint\", \"plan the work\", \"build a sprint backlog\", or similar phrasing. Acts as Scrum Master: the user is Product Owner, subagents and `/blitz` are Developers. Planning only — hands off to `/blitz` for execution. Do NOT trigger for one-off task creation (use the `itr` skill), for executing/clearing a backlog (use `/blitz`), or for sprint review (separate future skill)."
---

# /sprint — sprint planning as Scrum Master

Take an input (Claude `/plan`, markdown spec, conversation, or inline brief), and produce a fully-groomed Sprint: one Sprint Goal, a prioritized story backlog filed in `itr`, declared file ownership for `/blitz`, and a baked-in Definition of Done. This skill is **planning only** — it never executes work. Hand-off to `/blitz` happens after the user reviews the filed backlog.

The orchestrator plays **Scrum Master**:
- The **user** is the Product Owner — owns goal, scope, and prioritization.
- **Subagents / `/blitz` waves** are Developers — they receive the filed sprint and do the work.
- The Scrum Master coaches: each phase is announced by name, each Scrum artifact is explained as it's produced, and Scrum violations are flagged with a one-line *why*.

Verbose, structured output is the point — it's how the user knows where they are in the workflow.

## Slash invocation

```
/sprint [input] [--budget N] [--name slug] [--dry-run]
```

| Form | Meaning |
|---|---|
| `/sprint` | No args — use prior conversation; auto-detect a `/plan` block if present; if neither yields a usable spec, **ask the user** for a path or inline brief. |
| `/sprint path/to/spec.md` | Treat the markdown file as the source of truth. |
| `/sprint <inline brief>` | Treat the rest of the line as the spec. |
| `--budget N` | Override the soft cap on story count (default ~10, auto-fit to spec). |
| `--name slug` | Override the auto-derived slug used in the sprint folder name. Sanitized to `[a-z0-9-]`, capped at 32 chars. |
| `--dry-run` | Run all phases including alignment, but skip every `itr` write, the folder/file writes, and the `sprint/CURRENT` update. Print what *would* have been filed. |

---

## Roles & artifacts (Scrum Master coaching)

State these once at the top of every run so the user knows the contract:

- **Product Backlog** = all candidate work for this product. Lives in `itr` with tag `product-backlog`. Survives across sprints.
- **Sprint Backlog** = the subset selected for this Sprint. Lives in `itr` with tag `sprint-N`, parented to the Sprint epic.
- **Increment** = the "Done" output produced by `/blitz` after this skill hands off. Not produced here.
- **Sprint Goal** = one sentence describing the value this Sprint delivers. Mandatory. Locked at Gate 1.
- **Definition of Done** = the quality bar every story must clear. Lives at sprint level (in epic body) and is appended to each story's acceptance criteria.

---

## Phase 0 — Intake & preflight (BLOCKING for missing inputs)

Announce: `Phase 0 — Intake & preflight`.

1. **Resolve input.** In order:
   - If args contain a path that exists, read it as the spec.
   - Else if args contain inline text (more than just flags), use that.
   - Else if a `/plan` block exists in the recent conversation, use it.
   - Else if recent conversation contains a clear ask, use that.
   - Else **stop and ask** the user for a spec path or inline brief.

2. **Verify `itr` is available.** Run `itr stats`. If no `.itr.db`, surface the message from the `itr` skill and confirm before `itr init`. (Defer to the `itr` skill's own intake rules.)

3. **Run `itr agent-info`** once per session to get authoritative flag/tag/urgency conventions. Use what it says over what's written here if they disagree.

4. **Detect kgr.** If `kgr` is on `$PATH`, plan to use it for file inference and dependency edges (`kgr refs`, `kgr query --who-imports`). If absent, note the absence in the Phase 0 summary and proceed without it.

5. **Detect story style.** Look for project conventions in this priority:
   - `./STORY_STYLE.md` — canonical location (built by `/story-style`).
   - `CLAUDE.md` / `AGENTS.md` — scan for sections about story style, issue conventions, or ticket format.
   - Project default (any obvious project-level convention you can infer from existing `itr` issues — title casing, AC format, tag prefixes).
   - **Base default** (used if none of the above): see `Story style — base default` below.

   Note which style won in the Phase 0 summary. If the base default is in use (i.e. no `STORY_STYLE.md`, nothing relevant in `CLAUDE.md` / `AGENTS.md`, and no inferable project default), include a soft-suggest line: `Run /story-style to capture project conventions.` Do not pause — this is a surface, not a gate.

6. **Determine sprint number.** Prefer filesystem over tracker:
   - If `sprint/` exists, list `sprint/sprint-*` directories, parse the leading `sprint-{N}` from each, take max N + 1.
   - Else fall back to `itr search "sprint-" -f json --fields tags`, find max `sprint-N` tag, +1.
   - If neither yields anything, this is `sprint-1`.

7. **Check for in-flight sprints.** Read `sprint/CURRENT` if it exists — its single line names the most-recent open sprint folder. Cross-reference with `itr` for any open `sprint-N` epics.

   **Detect already-reviewed sprints before flagging as in-flight.** A sprint that has been through `/sprint-review` will have its `plan.md` Outcomes / Demo / Retro sections populated (Phase 6 writes them as empty HTML-comment placeholders; `/sprint-review` Phase 6 replaces them). Without this check, a closed-but-not-yet-incremented sprint will be falsely flagged as in-flight — noise the PO has to mentally filter. This mirrors the sprint-1 stale-tickets pattern (step 8 below): the bookkeeping says open, the reality is closed, and we have to read the reality before reporting.

   1. Read `sprint/CURRENT` for the folder name; resolve `sprint/<folder>/plan.md`.
   2. If the file is missing, treat the sprint as in-flight (no review evidence).
   3. If the file exists, read its `## Outcomes` section. Treat it as **reviewed** when the section contains substantive content — any non-whitespace line that is **not** the original placeholder `<!-- Populated by /sprint-review after /blitz runs. -->`. (Demo/Retro placeholders are weaker signals; Outcomes is the canonical one.) Optionally cross-check by reading the sprint epic in `itr` — a `closed` epic with a populated Outcomes is fully reviewed.
   4. **If reviewed:** do not print the in-flight warning. Note it in the Phase 0 summary as `In-flight: none (sprint-K reviewed, awaiting new-sprint increment)`. Proceed.
   5. **If not reviewed (placeholder Outcomes or no plan.md):** surface as today — `Note: sprint-3 epic is still open (sprint/CURRENT points to sprint-3-...). Stacking is allowed but anti-Scrum — finish or close it first if you can.` Do not block.

   **Self-test (manual, for skill authors):** create a scratch `sprint/sprint-9-2026-01-01-test/plan.md` with the canonical Phase 6 template and confirm step 7 reports it as in-flight. Then replace `<!-- Populated by /sprint-review after /blitz runs. -->` with any single line of real outcomes text and re-run — step 7 should now report `reviewed, awaiting new-sprint increment` and skip the stacking warning. A missing `plan.md` should fall back to the in-flight warning path.

8. **Detect stale itr tickets (commit-closed but still open in `itr`).** Git commit conventions like `closes #186` don't auto-sync into `.itr.db` — `itr` has no post-merge hook. Without this check, a sprint can over-count scope by planning a story that already shipped (sprint-1 hit this with #186; see retro action item #196).

   1. Run, in the current repo:

      ```
      git log --grep='closes #'   --since=30.days.ago --oneline
      git log --grep='close #'    --since=30.days.ago --oneline
      git log --grep='fixes #'    --since=30.days.ago --oneline
      git log --grep='fix #'      --since=30.days.ago --oneline
      git log --grep='resolves #' --since=30.days.ago --oneline
      git log --grep='resolve #'  --since=30.days.ago --oneline
      ```

      The 30-day window is the default; widen it to the cadence of the previous sprint if `sprint/CURRENT` (or filesystem inspection of `sprint/sprint-*/`) suggests a longer interval since the last closed sprint.

   2. Parse out unique ticket IDs with a regex like `(?i)(?:closes?|fixes?|resolves?)\s+#(\d+)`. Deduplicate.

   3. For each unique ID, run `itr get <id> -f json --fields id,status`. If `status == "open"`, the ticket is a **stale-closure candidate**: a commit claims it's done but `itr` still has it open.

   4. If any candidates surface, include them in the Phase 0 summary print (step 11 below) under a `Stale tickets:` line, and **pause for PO direction**. Offer exactly three choices:

      - **(a) Close them now.** Run `itr close <id> "Stale closure: shipped in <commit-sha> (<commit-subject>); detected by /sprint preflight on <date>."` for each. Then continue to Phase 1.
      - **(b) Include them in the sprint as no-op closures.** File them as Sprint Backlog stories whose AC is "Verify shipped in <commit-sha>; close as no-op." This matches the sprint-1 pattern where a wave-agent organically caught and closed the duplicate. Useful when the PO wants the bookkeeping to flow through the normal sprint workflow.
      - **(c) Skip preflight and proceed.** Note the candidates in the artifact's Open Assumptions log and continue without action. Use when the PO knows the commits don't actually close the tickets (e.g. partial fix, wrong ID typo).

   5. If no candidates surface, the `Stale tickets:` line in the summary reads `none`. Do not pause.

   **Self-test (manual, for skill authors):** to validate this step end-to-end, create a synthetic stale ticket in a scratch repo — open an `itr` ticket, then commit any file with `closes #<that-id>` in the message, then re-run `/sprint`. The preflight should surface the ticket and offer the three choices. A repo with zero matching commits, or zero open referenced IDs, should produce `Stale tickets: none`. No automated test exists for skill templates; the verify path is re-read of this file + the synthetic-repo exercise above.

9. **Detect `docs/ROADMAP.md`** (the cross-sprint product map built by `/roadmap`). Resolution order: `docs/ROADMAP.md` → `./ROADMAP.md` (spec-less projects). If found:

   1. Read the file. Parse the per-section tables to extract: section title, status (✅/🟡/❌), size, linked itr issues, and any optional `Trajectory` section.

   2. **Identify next-section candidates** for this sprint's Goal seed:
      - If a `Trajectory` section exists and names a sprint matching the number computed in step 6 (e.g. `Sprint-N+1` lines up with current sprint-N), use the sections listed under that sprint line.
      - Else surface the next ❌/🟡 sections in dependency order — wide dependencies first (flagged `wide dep` in the roadmap's `Cross-cutting` section), then by trajectory-order if any partial draft exists, then by spec order.
      - Cap the surface at 3 candidates; more is noise.

   3. **Hold candidates in memory for Phase 1 step 1.** They become a soft suggest for Sprint Goal drafting, not a forced choice.

   If `docs/ROADMAP.md` is absent: include the one-line `Roadmap: absent — run /roadmap to map cross-sprint scope.` surface in the Phase 0 summary. Do not pause — this is a surface, not a gate.

10. **Surface open retro items (pause for PO disposition).** Retro actions get filed reliably and scheduled never. Read them here, next to the roadmap, so they compete for this sprint's capacity instead of ageing quietly in the tracker.

    1. List the open process-improvement items by tag — `retro` by default, but use whatever this project actually spells it (`itr agent-info` from step 3 and the existing tag set are authoritative). E.g. `itr list --tag retro --status open -f json --fields id,title`.

    2. Print them in the Phase 0 summary (step 11 below) and take an explicit PO disposition on **each** one. Exactly two are valid:

       - **(a) Pull into this sprint.** It becomes a Phase 2 candidate story, held to the same Definition of Done as any other.
       - **(b) Close it.** `itr close <id> "Not scheduling — <reason>."` A rule nobody will action is cheaper closed than open.

    3. **"Leave it open" is not a disposition** — it is the failure this step exists to kill. An open retro item reads as a plan and behaves as a wish; if it recurs, file it fresh. *(The sprint-2 retro action "verify declared files exist before fan-out" was filed, never scheduled, and went on to cost sprint-6 and sprint-11 the same mid-wave intervention it was written to prevent.)*

    4. If nothing is open under the retro tag, the `Retro items:` line reads `none`. Do not pause.

11. **Print the Phase 0 summary** so the user can see the resolved context:

    ```
    Sprint preflight
      Input:         <path | inline | /plan | conversation>
      Tracker:       itr (db: .itr.db)
      kgr:           present | absent — file inference will use grep instead
      Story style:   STORY_STYLE.md | inferred | base default
      Roadmap:       docs/ROADMAP.md (N sections; next: §A.6 popup, §A.16 WindowPicker [wide dep]) | absent — run /roadmap
      Sprint number: sprint-N (auto-incremented from sprint/ folders)
      In-flight:     none | sprint-K reviewed, awaiting new-sprint increment | sprint-K still open per sprint/CURRENT (warning, not blocking)
      Stale tickets: none | #<id> (<title>) — closed in <sha> "<subject>"; choose (a) close now / (b) include as no-op / (c) skip
      Retro items:   none | #<id> (<title>) — choose (a) pull into sprint-N / (b) close
    ```

    If `Stale tickets:` is non-empty, wait for the PO choice (a/b/c) before proceeding. If `Retro items:` is non-empty, wait for a disposition (a/b) on every listed item — there is no third option. If both are empty, no confirmation needed — this is a transparency print, not a gate. Proceed straight to Phase 1.

    **Stash ticket data for Phase 3.** When the stale-ticket step (step 8) pulls ticket data via `itr get <id>` (or any equivalent batch read), keep the `acceptance` field for every candidate story in memory. Phase 3 Step 0 reads it directly — do not refetch.

---

## Phase 1 — Sprint Goal & Gate 1 (BLOCKING)

Announce: `Phase 1 — Sprint Goal`.

Coach: *"The Sprint Goal is the single sentence that explains why this Sprint exists. Every story in the Sprint Backlog must serve it. Anything that doesn't gets deferred to the Product Backlog."*

1. From the spec, draft **one** Sprint Goal sentence. Format suggestion: `Deliver <user-visible value> by <change> so that <outcome>.`

   **Roadmap soft-suggest:** if Phase 0 step 9 surfaced next-section candidates from `docs/ROADMAP.md`, draft the Sprint Goal from the top candidate (typically a wide dependency, or the next trajectory entry, or the next ❌/🟡 section). Print the alternatives so the PO can redirect:

   ```
   Roadmap-seeded Sprint Goal candidates (soft-suggest, override freely):
     1. §A.16 WindowPicker — wide dependency, 4 consumers (recommended)
     2. §A.6 popup rows 3–7 — partial section, unblocks chonks
     3. §A.11 Group vocabulary — clean ❌, size M

   Drafted Sprint Goal: "Deliver the WindowPicker primitive so that popup, options-page, sibling, and devtools share one window-selection surface."
   ```

   The roadmap is a planning aid, never a forced choice. If the PO's intent diverges from the roadmap candidates (e.g. urgent bug, customer ask, demo deadline), follow the PO and note the divergence in the Open Assumptions log so `/sprint-review` can revisit. If the roadmap is absent, draft from the spec + recent conversation as before.

2. Draft a short **Non-Goals** list (3–6 bullets) capturing what's deliberately out of scope. This is the most common source of mid-sprint friction; surfacing it now is high leverage.

3. **Gate 1 — confirm Sprint Goal & Non-Goals.** Print:

   ```
   Sprint Goal (Sprint-N):
     <one sentence>

   Non-Goals:
     - <bullet>
     - <bullet>
     ...

   Approve, edit, or amend? (we cannot draft the backlog until the goal is locked)
   ```

   **Wait** for explicit approval. Accept edits and reprint. Do not proceed to Phase 2 with an unconfirmed goal.

---

## Phase 2 — Backlog draft

Announce: `Phase 2 — Drafting the Sprint Backlog`.

Coach: *"Now I'll decompose the spec into stories sized to be completed by one `/blitz` wave-agent. Anything that can't fit that shape gets flagged for spillover into the Product Backlog."*

1. **Decompose into stories.** Each story should:
   - Serve the Sprint Goal (or be flagged spillover).
   - Have a clear, imperative title (`Add ...`, `Fix ...`, `Refactor ...`).
   - Be sized to roughly one wave-agent's worth of work — bounded file set, single concern, runnable verify gate at the end.
   - If a candidate story is too big, split it. If it can't be split without losing coherence, flag it as **needs-planning** spillover (not in this sprint).

2. **Declare file ownership** when confidence is high:
   - If kgr is present, use `kgr refs <symbol>` and `kgr query --who-imports <file>` to identify the file set.
   - Otherwise, grep for entry points referenced in the spec.
   - Files only go into `--files` when you're confident; ambiguous cases stay blank and `/blitz`'s planner agent will fill them later.
   - **Every declared file must exist, or be marked NEW.** `ls` each one before it goes into `--files`. When the story names a *symbol* (a handler, an export/save dispatch, a registration site), grep for the symbol rather than trusting the path — a stale path that still exists is the miss that survives an existence check. Dispatch and persistence symbols are the repeat offenders: they cluster in files whose names don't advertise them. *(sprint-6 #689 declared `bg-io/src/lib.rs` + `app/actions.rs`; the .3dl export dispatch actually lived in `formats.rs` + `action_handler.rs`, and `/blitz` had to SendMessage a mid-flight ownership correction.)*
   - **The plan is canonical for file naming — reconcile the issue body to it, not later.** When adopting a pre-filed story whose body names different paths than the plan, `itr update` the story body to match the plan **before** filing/handoff. Two sources of truth for one file set means the wave agent picks one and someone reconciles it mid-sprint. *(sprint-1 #378 needed a mid-sprint note to reconcile `test_ip_adapter_proj.cpp` against the plan's `test_ip_adapter_imageproj.cpp`.)*
   - **Flag shared surfaces at planning time — including docs.** Two stories are contended when they touch the same file, when one publishes an API (enum variant, trait method, struct field, signature) the other consumes, **or** when both edit the same spec/ADR/roadmap doc. Docs are the invisible case: they rarely appear in `--files`, and "two stories, one paragraph, last writer wins" is the same collision as two stories on one function. Record it in the story body as a `Contends: <file/symbol> with #NNN` line, and where the shared surface must exist before consumers can build, either set `--blocked-by` or draft a small prep story that lands the surface first. Declaring the contention is the planning job; `/blitz` Phase 2 makes the final call on wave shape.
   - **If a story's acceptance criterion is user-visible** ("user sees X", "surface a warning", "show a notice"), the ownership set must include the UI/surface file that *renders* it — not just the data-layer file that *produces* it. A data-layer change behind an unowned render site ships a dead path and forces the executor to skip the AC or reach outside its files. If data and surface naturally belong to different agents, split into a data-layer story + a UI-hookup story (`--blocked-by` the data-layer one). *(sprint-4 retro: #407 declared `bg-io` only; its "user sees a warning" AC needed a `bg-app` render site, forcing a `/blitz` orchestrator intervention.)*
   - **If a story adds persisted state to a core domain type** — a new variant, or just one new field that must survive a save/load or an undo — its ownership set must include **every** subsystem that serializes or reconstructs that type: the persistence/file-format path, the undo/redo snapshot path, and any flatten/composite/render path that reads it. All of them, in the *same* story. Splitting them across stories ships a field that writes and never restores, and every gate stays green because no test crosses two subsystems. The snapshot/undo path is the one that gets missed — check it explicitly. *(sprint-5: a new layer kind landed without its history snapshot, so a later story produced layers that couldn't undo losslessly. sprint-7: a persisted per-layer field silently dropped through undo/redo mid-sprint, and the story had to be granted extra crate ownership in flight.)*

3. **Infer dependencies (`--blocked-by`) conservatively:**
   - Only set when there's a concrete signal: a kgr import edge between owned files, or a clear "X must exist before Y" ordering from the spec.
   - When in doubt, leave it. Over-declared dependencies serialize the wave plan unnecessarily.

4. **Apply risk tier** (`risk:high|med|low`) per story:
   - **high** — unknown territory, external dep, security-relevant, or touches load-bearing code.
   - **med** — well-understood change with non-trivial surface area.
   - **low** — small, mechanical, or already-validated pattern.

5. **Order by risk → dependency → value.** Risky and foundational stories go first so the sprint surfaces unknowns early. Within ties, order by Product Owner-stated value. Make this ordering explicit so the PO can override during alignment.

6. **Identify spillover.** Anything that doesn't serve the goal, doesn't fit the budget, or needs more planning is set aside as **deferred** — it will still be filed (Phase 5), but tagged `product-backlog,needs-sprint` instead of `sprint-N`.

7. **Build the sprint-level Definition of Done** from the spec + project conventions. Default DoD checklist (adapt per project):
   - All acceptance criteria pass.
   - Project verify gate (tests, lint, typecheck, format) is green.
   - Behavior is observable to the user (or to the next dependent story).
   - Docs/README updated when user-facing behavior changes.
   - Multi-entry-point behavior is verified at **every** entry point. If an AC describes a behavior that has more than one route/path/mode into it, the AC enumerates them by name and the story proves the read site of each — not the first one. Route the heaviest or most-divergent path to the PO smoke first. *(A green gate that traced two of three routes is how a missing path ships.)*
   - A story whose type is test-only (`test(...)`, "add coverage", "close the baseline gap") but whose diff touches non-test production code says so explicitly in its close reason, naming the production sites it changed. Coverage work that alters shipping behavior passes every gate by construction.

   **If the DoD requires a reviewer signoff, say when it binds: before the FIRST close, not as a re-close after audit.** Write it as "reviewer signoff recorded as a tracker note before the **first** close of the issue". Signoff that lands after a close is an audit, and an audit finds what the close already declared done. *(sprint-1 is the worked example of this working, not failing: its DoD said "signoff recorded as an itr note **before issue close**", the reviewer returned REQUEST CHANGES on a story that had passed its own green gate against a tautological test, a fix-up agent ran, and the story closed once — after APPROVE. The gate sat in the right place and caught a green-but-wrong close. Write it that way from the start.)*

   This will be appended to every story's acceptance criteria in Phase 5.

8. **Derive the sprint slug** for the folder name `sprint/sprint-{N}-{YYYY-MM-DD}-{slug}/`:
   - If the user passed `--name foo`, use that as the slug input.
   - Otherwise extract 2–4 meaningful keywords from the Sprint Goal sentence, dropping leading verbs (`deliver`, `add`, `implement`, `ship`, `build`, `enable`).
   - **Sanitize:** lowercase; replace any non-`[a-z0-9]` with `-`; collapse runs of `-`; trim leading/trailing `-`; cap at 32 chars.
   - Hold for Phase 4 confirmation, where the PO can override.

Do not file anything yet. Hold the draft in memory.

---

## Phase 3 — Alignment (Scrum Master grilling)

Announce: `Phase 3 — Alignment` and explain: *"Before we file anything, we stress-test the draft. The Product Owner gets to push back on anything I drafted."*

### Step 0 — Empty-AC detection (BLOCKING)

Run this step **before** any of the four alignment topic clusters below. It exists because adopting a stale ticket with empty `acceptance` can otherwise slip past alignment and reach `/blitz` un-AC'd. (This mirrors the project-level constraint: `STORY_STYLE.md` says *"AC is required on every ticket. Empty `acceptance` is not acceptable closure-ready state."* — this step extends that rule into `/sprint` enforcement so it can't be bypassed by adopting a stale ticket.)

1. **Scan the candidate Sprint Backlog** for any story whose `acceptance` field is empty or whitespace. Use the ticket data already pulled by Phase 0 (step 8 stashes it explicitly) — do **not** refetch.

2. **For each empty-AC story, surface it explicitly to the PO**, one at a time:

   ```
   Story #N (<title>) has no acceptance criteria.
   Draft now or defer (defer = remove from sprint).
   ```

3. **If the PO drafts AC inline:** capture it verbatim. Confirm by reprinting:

   ```
   Drafting AC for story #N:
     - <bullet 1>
     - <bullet 2>
     ...

   Confirm, edit, or replace?
   ```

   On confirmation, **write the AC to the story** with:

   ```
   itr update <id> --acceptance "<the drafted AC, multi-line ok>"
   ```

   Use the `--acceptance` flag directly. Do **not** route through `itr update --context` or any other body-field workaround — `--acceptance` is the canonical surface and is confirmed available in current `itr` (`itr update --help`).

4. **If the PO defers:** move the story to spillover (tag `product-backlog,needs-sprint`) and drop it from the in-memory Sprint Backlog. Note the deferral in the Open Assumptions log so `/sprint-review` can revisit.

5. **Do not proceed to the four alignment topic clusters below until every in-sprint story has non-empty `acceptance`.** This is BLOCKING; the Phase 4 Gate 2 sanity check will refuse to proceed if any in-sprint story still has empty AC, so resolving it here is the cheaper path.

### Step 0b — Visual Gate AC detection (BLOCKING)

Run this immediately after Step 0, before the alignment clusters. It exists because visual/rendering stories that ship without a Visual Gate block have repeatedly caused regressions (the project has shipped multiple iso visual regressions when "cargo test green" was treated as sufficient closure). The project convention (`CLAUDE.md` → *"Visual features need visual gates"*) requires a structured `LOOK AT / IGNORE / EXPECTED / CONFOUNDERS` block in the AC of any visual-scope story; this step enforces it at planning time so an un-gated visual story can't reach `/blitz`.

1. **Flag every visual-scope story.** A story is visual-scope if it is tagged `visual`, `ui`, or `render`, **or** its declared `files` touch rendering-related paths (e.g. `src/screens/**`, `src/render/**`, `src/ui/**`, `src/app/scaling.rs`, shader/`post_process`/`view`/`draw` files). Use the ticket data already in memory — do **not** refetch.

2. **Inspect each flagged story's `acceptance` for the Visual Gate block.** It must contain all four labels: `LOOK AT`, `IGNORE`, `EXPECTED`, `CONFOUNDERS`. A story with visual scope but no such block fails the check.

3. **Surface each failing story to the PO**, one at a time:

   ```
   Story #N is visual but AC doesn't use the LOOK AT / IGNORE / EXPECTED / CONFOUNDERS block. Draft now or defer.
   ```

4. **If the PO drafts the Visual Gate inline:** capture it verbatim using the canonical format from `CLAUDE.md`:

   ```
   Visual gate:
     LOOK AT:    <specific element, location, observable behavior>
     IGNORE:     <known-deferred items + their ticket #s>
     EXPECTED:   <success criteria in observational terms>
     CONFOUNDERS: <bugs in adjacent systems that may surface but are out of scope>
   ```

   Confirm by reprinting, then **write it into the story's AC** with the canonical flag (append to, or merge with, existing AC bullets):

   ```
   itr update <id> --acceptance "<full AC including the Visual gate block>"
   ```

   Use `--acceptance` directly (same canonical surface as Step 0) — not `--context` or any body-field workaround.

5. **If the PO defers:** move the story to spillover (tag `product-backlog,needs-sprint`) and drop it from the in-memory Sprint Backlog, noting it in the Open Assumptions log.

6. **Do not proceed to the alignment clusters until every visual-scope in-sprint story has a Visual Gate block.** BLOCKING; the Phase 4 Gate 2 check re-verifies this, so resolving it here is cheaper.

7. **Mark visual-gate-only stories.** Some visual-scope stories have *nothing a wave agent can implement* — their entire deliverable is the PO looking at the running app against the Visual Gate block (no code to write, no gate an agent can self-satisfy). Tag any such story `visual-gate-only` in addition to `visual`. This tag is the cross-skill signal that `/blitz` must **skip** the story during the blitz (a wave agent cannot close a ticket whose only acceptance is a human's eyes) and that `/sprint-review` **must** perform the visual smoke to resolve it. Distinguish carefully: a story with real implementation work *plus* a visual gate is **not** visual-gate-only — a wave agent does the work, captures runtime evidence, and defers only the final PO smoke (the existing `awaiting PO visual smoke` soft-quarantine path in `/blitz`). Visual-gate-only means there is no implementable deliverable at all. Note in the Phase 4 draft and the plan artifact which stories carry `visual-gate-only`, so the PO expects to resolve them at review — never during the blitz.

### Alignment topic clusters

Invoke the `/alignment` interview pattern (`AskUserQuestion` for simple choices, freeform for nuanced ones) on these four topic clusters, in order. For each, present your recommendation alongside the question.

1. **Goal + non-goals + scope boundaries.** Re-confirm the goal still holds against the drafted stories. Surface any drafted story that doesn't visibly serve the goal.

2. **Definition of Done (sprint + per-story).** Confirm the sprint-level DoD checklist. For any story whose AC reads as a judgment call rather than an observable outcome, flag it: *"This AC isn't checkable by an agent — can we make it observable?"*

   Also scan every AC for **branch points** — phrases like *fallback*, *if X*, *optional*, *debug-only*, *CPU path*, *edge case*. Each one is a decision the executing agent will otherwise make alone, mid-flight, with no context for the PO's scope intent. Tag each explicitly in the AC text: `scope: in` or `scope: defer to <epic/issue>`. Ask the PO per branch point; don't infer. *(sprint-3 shipped two defensible-but-unplanned deviations — a deferred CPU fallback and a swapped lint attribute — purely because "is this in scope?" was answered by an agent instead of the PO.)*

3. **Risks, unknowns, human dependencies.** What could derail the sprint? Anything blocked by external review, access, data, or human decision? Capture answers into the **Open Assumptions** log for the artifact.

4. **Story splits, sizing, and prioritization.** For any oversized story, propose a split. Confirm or override the risk+dep+value ordering. Confirm spillover decisions (any story the PO wants to pull back into the sprint, or push out).

Capture all PO overrides directly into the in-memory draft. Capture all deferrals/assumptions into an **Open Assumptions** list — this lands in the artifact for the future `/sprint-review` to revisit.

If the PO substantially changes the goal during alignment, **return to Phase 1 Gate 1** and re-confirm. Don't fight that — silent goal drift is the biggest planning failure mode.

---

## Phase 4 — Confirm draft & Gate 2 (BLOCKING)

Announce: `Phase 4 — Final review before filing`.

**Sanity check — every in-sprint story has non-empty AC.** Before printing the draft for PO approval, re-scan the in-memory Sprint Backlog for any story with empty or whitespace `acceptance`. If any story still has empty AC (somehow slipped past Phase 3 Step 0), **refuse Gate 2** with a one-line block:

```
Story #N has no AC. Return to Phase 3 to draft or defer.
```

**Sanity check — every visual-scope story has a Visual Gate block.** In the same re-scan, for any story flagged visual-scope by Phase 3 Step 0b (tagged `visual`/`ui`/`render` or touching rendering paths), confirm its `acceptance` contains all four Visual Gate labels (`LOOK AT`, `IGNORE`, `EXPECTED`, `CONFOUNDERS`). If any visual-scope story still lacks the block (slipped past Step 0b), **refuse Gate 2** with a one-line block:

```
Story #N is visual but has no Visual Gate block. Return to Phase 3 Step 0b to draft or defer.
```

Phase 4 cannot proceed past either check. Resume the draft once the PO has drafted AC / the Visual Gate (Phase 3 path: `itr update <id> --acceptance "..."`) or moved the story to spillover.

Once the sanity check passes, print the full draft so the PO can see exactly what will hit `itr`:

```
Sprint-N — <Sprint Goal>

Sprint Backlog (M stories, budget = <budget>):
  #  Title                              Pri    Risk  Files                       Blocked-by  AC
  1  <story title>                      high   high  src/foo.rs, src/bar.rs      —           3 + DoD
  2  <story title>                      high   med   src/baz.rs                  #1          2 + DoD
  ...

Definition of Done (sprint-level, appended to every story):
  - <bullet>
  - <bullet>

Spillover → Product Backlog (K items, tagged needs-sprint):
  - <title> (reason: out-of-goal | too-large | needs-planning)
  ...

Open Assumptions (for /sprint-review):
  - <assumption>
  ...

Will write:
  - sprint/sprint-N-YYYY-MM-DD-<slug>/  (override slug below or via --name foo)
  - 1 epic (kind=epic, tags: sprint-N)
  - M story tasks (kind=task, --parent <epic-id>, tags: sprint-N, risk:_)
  - K spillover tasks (tags: product-backlog, needs-sprint, risk:_)
  - sprint/sprint-N-YYYY-MM-DD-<slug>/plan.md artifact
  - sprint/CURRENT rewritten to point at the new folder

Approve, amend, or abort?
```

**Wait** for explicit approval. Accept edits ("drop story 4", "move 7 to spillover", "story 2 needs `--blocked-by #1`") and reprint until the PO approves. If `--dry-run`, print this and stop here.

---

## Phase 5 — File to itr

Announce: `Phase 5 — Filing to itr`.

Order matters — epic first so stories can `--parent` it:

1. **Create the Sprint epic.** Use `itr add -k epic -p high` with:
   - Title: `Sprint-N: <Sprint Goal short form>`
   - Body: full Sprint Goal sentence, Non-Goals list, sprint-level DoD checklist.
   - Tags: `sprint-N`.
   - Output `-f json` to capture the epic ID.

2. **Bulk-file the Sprint Backlog stories.** Use `itr batch add` with a JSON array on stdin. Each entry:
   - Title, body (story description from draft).
   - `priority`, `kind: task`, `parent: <epic-id>`.
   - `acceptance`: story-specific AC + appended sprint DoD checklist.
   - `tags`: `sprint-N,risk:<tier>` (plus any project-style tags from `STORY_STYLE.md`; add `visual-gate-only` for any story Phase 3 Step 0b marked so — this is what tells `/blitz` to skip it and `/sprint-review` to smoke it).
   - `files`: declared set when confident, omit otherwise.
   - `blocked_by`: only when conservative inference set it.

3. **Bulk-file the spillover items** in a separate `itr batch add` call. Same shape but:
   - No `--parent` (they're not part of this sprint epic).
   - Tags: `product-backlog,needs-sprint,risk:<tier>`.

4. **Handle partial failure.** If any item fails:
   - Retry that specific item once.
   - If retry fails, **stop and surface to the user**: print the failed payload, the error, and the IDs of items that *did* file. Wait for resolution (typo, missing tag, schema change). Then resume from where it stopped — do not re-file successful items, do not roll back the epic.

5. **Capture all created IDs** for the artifact.

---

## Phase 6 — Write the artifact

Announce: `Phase 6 — Writing sprint/<folder>/plan.md`.

1. **Create the sprint folder.** Compute `<folder> = sprint-{N}-{YYYY-MM-DD}-{slug}` using the slug from Phase 2 step 8 (or PO override from Phase 4). Create `sprint/{folder}/` (and `sprint/` itself if it doesn't exist).

2. **Write `sprint/{folder}/plan.md`** with this structure (real itr IDs embedded):

   ```markdown
   # Sprint-N — <Sprint Goal short form>

   **Sprint Goal:** <full sentence>
   **Epic:** itr#<epic-id>
   **Created:** <ISO timestamp>
   **Story style:** STORY_STYLE.md | inferred | base default

   ## Non-Goals
   - ...

   ## Definition of Done (sprint-level)
   - ...

   ## Sprint Backlog
   | ID | Title | Pri | Risk | Files | Blocked-by | AC |
   |----|-------|-----|------|-------|------------|----|
   | itr#... | ... | ... | ... | ... | ... | ... |

   ## Spillover → Product Backlog
   - itr#... — <title> (reason)

   ## Open Assumptions
   - ...

   ## Outcomes
   <!-- Populated by /sprint-review after /blitz runs. -->

   ## Demo
   <!-- Populated by /sprint-review. -->

   ## Retro
   <!-- Populated by /sprint-review. -->
   ```

3. **Update `sprint/CURRENT`.** Overwrite (or create) the file with a single line containing the new folder name (e.g. `sprint-3-2026-05-09-auth-hardening`). No trailing newline-only — just the name. This is how `/blitz`, `/sprint-review`, and any other sprint-aware skill discover the in-flight sprint.

---

## Phase 7 — Final report

Announce: `Phase 7 — Sprint planned`. Print:

```
Sprint-N planned.

  Goal:         <one sentence>
  Epic:         itr#<id>
  Folder:       sprint/sprint-N-YYYY-MM-DD-<slug>/
  Plan:         sprint/sprint-N-YYYY-MM-DD-<slug>/plan.md
  CURRENT:      → sprint-N-YYYY-MM-DD-<slug>
  Stories:      M filed (sprint-N), K deferred (product-backlog)

Sprint Backlog:
  itr#..  high   high  Add ...                       files: src/foo.rs
  itr#..  high   med   Refactor ...                  files: src/bar.rs   blocked-by: itr#..
  ...

Spillover (deferred to Product Backlog):
  itr#..  med    high  Investigate ...               (reason: needs-planning)
  ...

Open Assumptions:
  - <assumption>

Next: run `/blitz` to execute the Sprint Backlog. Run `/sprint-review` after blitz to triage outcomes.
```

Stop. Do not invoke `/blitz` automatically.

---

## Story style — base default

Used when no `STORY_STYLE.md` exists and no project default can be inferred.

**Title:** imperative, specific. `Add streaming to upload API`, not `Streaming upload`.

**Body:**
```
**Why:** <one or two sentences on the user-visible value or the constraint driving this>
**What:** <one paragraph describing the change>
**Notes:** <optional — gotchas, related code, prior art>
```

**Acceptance criteria** (the `-a` field) — bulleted observable outcomes, AC-first then DoD-appended:
```
- <story-specific outcome 1>
- <story-specific outcome 2>
- <story-specific outcome 3>
---
- All sprint-level DoD items pass (see epic itr#<id>):
  - Verify gate green
  - Tests added/updated
  - Docs updated if user-visible
```

**Tags:** `sprint-N`, `risk:<tier>`, plus any tags pulled from `STORY_STYLE.md`.

If a project-level `STORY_STYLE.md` exists, it overrides the body shape, AC format, and tag conventions above. Mirror its style; don't fight it.

---

## Multi-repo

Sprints are goal-scoped. A goal that genuinely spans repos is fine; it's not the default.

When the spec implies multiple repos:
- Each story declares its repo path explicitly in the body (`Repo: path/to/repo`).
- File ownership is `<repo>:<file>` so `/blitz` can route correctly.
- The sprint epic body lists the repos in scope.

When in single-repo mode (the default), don't add the repo prefix — keep file paths repo-relative as `itr` and `/blitz` already expect.

---

## Coaching style (Scrum Master tone)

- **Announce every phase by name** (`Phase 0 — ...`, `Phase 1 — ...`). The structured output is a feature: it tells the PO exactly where they are in the workflow.
- **Explain the *why* of each Scrum step** in one short sentence as you reach it. ("The Sprint Goal exists so we have a single yardstick for spillover decisions.") Don't lecture; coach.
- **Flag Scrum violations** with a one-line *why*: "Stacked sprints are anti-Scrum because they dilute the in-flight focus — proceeding because you asked." Don't refuse unless explicitly instructed to (only Phase 1 and Phase 4 gates are blocking).
- **Use Scrum vocabulary consistently.** Sprint Goal, Sprint Backlog, Product Backlog, Increment, Definition of Done, Sprint Review. Reusing the terms is what builds the PO's mental model over time.

---

## Principles

- **Planning only.** The skill never executes work. The Increment is `/blitz`'s job.
- **The Sprint Goal is the yardstick.** Every story decision (in-sprint vs spillover, prioritization, cut/keep) is justified against the goal.
- **Two BLOCKING gates, no more.** Gate 1 locks the goal; Gate 2 confirms the draft before any `itr` write. After that the skill files autonomously.
- **File ownership is hand-off currency.** Declared `--files` are gifts to `/blitz`'s wave planner. Conservative when uncertain.
- **Spillover is a feature.** Surfacing what *won't* fit is as valuable as picking what will. Nothing gets lost — every deferred item lands in `itr`.
- **Coaching is structured output.** The phase headers and Scrum vocabulary make the workflow legible. Verbose is fine; opaque is not.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. After Phase 6 writes the sprint folder and `sprint/CURRENT`, commit those planning artifacts — unless the PO asked otherwise.

---

## Don't

- Don't proceed past Gate 1 without a confirmed Sprint Goal.
- Don't proceed past Gate 2 without an explicit user approval of the draft.
- Don't write to `itr` before Gate 2.
- Don't invoke `/blitz` automatically — the user runs it after reviewing the filed sprint.
- Don't roll back partially-filed sprints. On `itr` failure, retry once, then surface and resume.
- Don't refuse stacked sprints. Warn, then proceed.
- Don't invent priorities, risk tiers, or AC the spec doesn't imply — surface in alignment instead.
- Don't drop the spillover. Every deferred story is filed with `product-backlog,needs-sprint` so future `/sprint` runs can pick it up.
- Don't run `/sprint-review` from this skill — that's a separate future skill.
- Don't route drafted AC through `itr update --context` or any other body-field workaround — `itr update --acceptance "..."` is the canonical surface. Sprint-1 used the context-body path as a documented exception for #186; that was the workaround, not the path forward. See itr#198.
