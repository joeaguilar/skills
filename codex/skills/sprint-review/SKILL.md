---
name: sprint-review
description: "Use only when the user explicitly invokes $sprint-review or asks to review and close one completed or in-flight sprint through outcomes, per-story demo acceptance, adaptive retro, follow-up triage, epic closure, and sprint/CURRENT updates. Do not use for sprint planning or backlog execution."
---

# $sprint-review — review the sprint as Scrum Master

Review a Sprint after `$blitz` (or whatever executor) finished the work. Fills the empty `Outcomes / Demo / Retro` sections of `sprint/{folder}/plan.md`, walks the Product Owner through per-story acceptance, files triage follow-ups into `itr`, optionally writes a standalone `sprint/{folder}/retro-{date}.md`, closes the sprint epic, and updates `sprint/CURRENT` to point at the next-highest open sprint (or removes it).

This skill collapses **Sprint Review** (demo + acceptance) and **Sprint Retrospective** (process learning) into one ceremony, with adaptive depth — Retro is skipped when the sprint went clean and required when any friction signal fired. That's deliberately less ceremonial than strict Scrum, because Codex-agent execution moves faster than human sprint cadence and most sprints don't need a 30-minute retro.

The orchestrator plays **Scrum Master** again:
- The **user** is the Product Owner — accepts, rejects, or conditionally accepts each story; owns triage decisions.
- The **closed sprint** is the Increment under review.
- **Codex worker agents / `$blitz`** are the Developers being reviewed.

Verbose, structured, phase-announced output — same principle as `$sprint`. Coach the *why* of each ceremony as you reach it.

## Invocation

```
$sprint-review [--epic <id> | --sprint <N>] [--retro | --no-retro] [--dry-run]
```

| Form | Meaning |
|---|---|
| `$sprint-review` | Auto-detect newest open sprint epic via `itr` query. |
| `--epic <id>` | Review a specific epic by itr ID. Useful when stacked sprints make auto-detection ambiguous. |
| `--sprint <N>` | Review the epic tagged `sprint-N`. |
| `--retro` | Force Retro to run even if no friction signals fired. |
| `--no-retro` | Force Retro to skip even if signals fired. PO override; use sparingly. |
| `--dry-run` | Run the full review including PO acceptance, but skip `itr` writes, artifact updates, epic closure, retro-file writes, and the `sprint/CURRENT` update. Print what *would* have happened. |

---

## Roles & artifacts

State once at the top of every run:

- **Increment** = the body of work shipped during the sprint. Reviewed here.
- **`sprint/{folder}/plan.md`** = the durable per-sprint document. This skill fills its Outcomes / Demo / Retro sections in-place.
- **`sprint/{folder}/retro-{date}.md`** = standalone retro artifact, written only when retro runs. One file per retro; same-day repeats append `-2`, `-3`, etc. User manages cleanup.
- **`sprint/CURRENT`** = single-line text file naming the highest-numbered open sprint folder. This skill rewrites it on epic close (or removes it if no sprints remain open).
- **`itr` triage filings** = bugs, carryover, demo feedback, retro action items — all filed via the `itr` skill (which reads `STORY_STYLE.md`).

---

## Phase 0 — Preflight

Announce: `Phase 0 — Preflight`.

1. **Identify the sprint.**
   - If `--epic <id>`, fetch that epic.
   - Else if `--sprint <N>`, query `itr search "sprint-N" --tags --kind epic -f json`.
   - Else auto-detect: read `sprint/CURRENT` if it exists; resolve to the named folder and its epic. If `CURRENT` is missing, query `itr` for open `sprint-N` epics, pick the highest N. If none open, pick the most recently created. If multiple stacked exist outside `CURRENT`, list them and ask the user to pick (one-shot question, not a gate).

2. **Pull sprint state from `itr`:** epic body (Sprint Goal, Non-Goals, sprint-DoD), all child stories with status, AC, tags, close timestamps, files declared.

3. **Locate `sprint/{folder}/plan.md`.** Resolution order:
   - If Phase 0 step 1 came from `sprint/CURRENT`, the folder is already known.
   - Else find by sprint number: list `sprint/sprint-{N}-*` directories, take the matching one.
   - Else find by epic ID: scan `sprint/sprint-*/plan.md` headers for `**Epic:** itr#<id>`.
   - **If found:** good, ready to update in-place.
   - **If missing:** the sprint pre-dates the `sprint/` layout, or the folder was deleted. **Stop and ask the user**:
     ```
     Sprint epic exists but no sprint/{folder}/plan.md found.
     Proceed with itr-only review and create a fresh folder at
       sprint/sprint-{N}-{today}-{slug-from-goal}/plan.md
     ? (yes / abort)
     ```
     Wait for explicit approval before continuing. Don't silently invent a folder.

4. **Locate blitz logs.** Read `sprint/{folder}/blitz/wave-*.md` (sorted by wave number) — there may be one or several from sequential blitz runs against this sprint.
   - **If found:** parse all of them for wave timing, retries, interventions, quarantine notes, files-touched-per-task. Merge into a single friction view.
   - **If absent:** note in the preflight summary. Outcomes/Demo run with reduced data; Friction-log section in Retro will be empty; blitz-derived Retro triggers (quarantines, interventions) can't fire — fall back to itr-state and PO judgment.

5. **Compute the sprint window:** earliest story open-date → latest story close-date (or now, if any still open). Used for `git log` / `git diff` scoping.

6. **Detect repos in scope.** Default = current repo. If sprint stories' bodies declare `Repo: path/to/repo`, collect the unique set. Multi-repo runs merge findings (see `Multi-repo handling`).

7. **Print the Phase 0 summary:**

   ```
   Sprint review preflight
     Sprint:        sprint-N (epic itr#<id>)
     Folder:        sprint/sprint-N-YYYY-MM-DD-<slug>/
     CURRENT:       points here ✓ | points elsewhere | absent
     Goal:          <one sentence>
     Stories:       <total> total — <closed> closed, <quarantined> quarantined, <open> open
     Plan:          sprint/{folder}/plan.md ✓ | MISSING (will create fresh after confirm)
     Blitz logs:    sprint/{folder}/blitz/wave-{1..N}.md ({count} found) | absent — reduced retro signal
     Repos:         <list>
     Window:        <start> → <end>
   ```

   Proceed straight to Phase 1.

---

## Phase 1 — Scope confirm (BLOCKING — Gate 1)

Announce: `Phase 1 — Scope confirm`.

Coach: *"Sprint Review starts by agreeing on what we're actually reviewing. If the wrong sprint is in scope, every later step is wasted."*

Print:

```
Reviewing sprint-N — <Sprint Goal>
  Epic:           itr#<id>
  Folder:         sprint/sprint-N-YYYY-MM-DD-<slug>/
  Stories:        <closed>/<total> closed, <quarantined> quarantined, <open> open
  Data sources:   itr ✓ | plan ✓|✗ | blitz logs ({N} files) | git diff ✓
  Repos:          <list>

Will execute:
  1. Outcomes — plan vs. actual, story-state table
  2. Demo — per-story walkthrough, PO accepts/rejects each
  3. Retro decision — auto-required if quarantines/interventions/carryover/bugs/<80% completion
  4. Retro (if required or --retro) — friction log + improvements + agent learnings
  5. Triage drafting — bugs, carryover, demo feedback, retro action items
  6. Gate 2 — final approval before any itr writes, artifact updates, or epic closure

Proceed? (or specify a different sprint)
```

**Wait** for explicit approval. Accept overrides ("review sprint-2 instead", "skip retro this run"). Do not proceed without confirmation.

---

## Phase 2 — Outcomes

Announce: `Phase 2 — Outcomes`.

Coach: *"Outcomes is the objective record of what was promised vs. what shipped. The PO uses it to judge Goal achievement."*

Compute and print:

1. **Plan vs. actual table** (one row per story from the original plan):

   ```
   ID        Title                              Status        Closed       Notes
   itr#101   Add streaming to upload API       closed         2026-05-08
   itr#102   Refactor session middleware       closed         2026-05-08
   itr#103   Add idle-timeout warning          quarantined    —            agent retry exhausted
   itr#104   Update docs for new flow          open           —            never picked up
   ```

2. **Counts:** stories closed / quarantined / open / failed-skipped, plus completion rate.

3. **Goal achievement** — the skill drafts a yes/partial/no judgment based on:
   - All goal-critical stories closed → **yes**
   - Some closed, some carried → **partial**
   - Goal-critical work is open or quarantined → **no**

   The PO confirms or overrides this judgment in Phase 3 implicitly via per-story acceptance.

4. **Surface anything in `git diff` not represented in itr** — code changes that don't tie back to a sprint story. Could be scope creep, agent-driven cleanup, or a missing story. Flag for PO attention.

This data is held in memory; it lands in the artifact at Phase 8.

---

## Phase 3 — Demo (per-story interactive)

Announce: `Phase 3 — Demo`.

Coach: *"Demo is per-story so the PO actually looks at each one. Skipping this is how 'incomplete' sprints sneak through."*

**Requirement-coverage check (do this first).** Re-read the PO's original request text — the conversation, spec, or brief that seeded this sprint — not the agent's or plan's summary of it. Confirm every explicit user request maps to an `itr` issue in scope, and verify each story against that original wording. A request that never became an issue is a silently-dropped requirement; a story that satisfies the summary but not the original ask is drift. Flag either for triage at Gate 2. Summaries paraphrase away detail — the original text is the source of truth.

For each closed (or quarantined) story, in priority order:

1. **Print the story card:**

   ```
   itr#101 — Add streaming to upload API
   Pri: high   Risk: med   Status: closed (2026-05-08)

   Behavior change (user-visible):
     <one paragraph: what changed, where it's observable>

   Files touched (git diff --stat for owned files):
     src/upload/stream.rs  | +143 -12
     src/upload/api.rs     |  +24  -8

   Verify gate (last result from blitz log, or run now if missing):
     ✓ cargo test (12.4s)
     ✓ cargo clippy
     ✓ cargo fmt --check

   Testing boundaries:
     IN scope to test:
       - Upload endpoint accepts streamed payloads up to 100MB
       - Partial-upload resume works after disconnect
     OUT of scope (don't flag if these break):
       - Auth flow (story #102's territory)
       - UI progress bar (no story for this sprint)
   ```

   **Testing boundaries are derived from:** the story's owned files (in scope) + AC (in scope) + sprint Non-Goals + adjacent stories' owned files (out of scope). If the story body has explicit `Test scope:` notes, prefer those.

2. **Ask the PO:**

   ```
   Decision for itr#101: accept / reject / conditional?
   ```

   - **accept** → record acceptance, move on.
   - **reject** → drafts a carryover issue (held until Gate 2). Ask PO for one-line reason; bake into the carryover body.
   - **conditional** → drafts a follow-up issue (held until Gate 2). Ask PO for one-line condition (e.g. "ship as-is, but add metrics in next sprint"). Bake into the follow-up body.

3. **Collect any free-form bugs the PO mentions during this story.** Hold for the triage list.

After every story is reviewed, print a per-story summary table.

---

## Phase 4 — Retro decision

Announce: `Phase 4 — Retro decision`.

Check the four required-Retro signals against the data gathered:

| Signal | Source |
|---|---|
| Any `quarantined` or `failed-skipped` story | itr state |
| Any `$blitz` intervention recorded | `sprint/{folder}/blitz/wave-*.md` `Interventions` section |
| Any carryover (rejected story this run) OR any bug filed during demo | Phase 3 captures |
| Sprint completion rate <80% | Phase 2 counts |

If `--no-retro` was passed: skip Retro regardless. (Print: `Retro suppressed by --no-retro.`)
If `--retro` was passed: force Retro regardless. (Print: `Retro forced by --retro.`)
Otherwise:

- **Any signal fired** → Retro is **required**. Print which signal(s) fired and why. Coach: *"Friction is information. Retro is how we turn it into next-sprint improvements."* Proceed to Phase 5.
- **No signal fired** → ask:
  ```
  Sprint went clean (all stories closed, no interventions, no bugs surfaced).
  Skip Retro? (skip / run anyway)
  ```
  Default to `skip`. If skipped, jump to Phase 6.

---

## Phase 5 — Retro (conditional)

Announce: `Phase 5 — Retro`.

Coach: *"A short retro is better than no retro. We'll cover four things, then move on."*

Walk the four content blocks:

1. **Plan vs. actual.** Use Phase 2's table. Highlight: stories that slipped (rejected or open), stories with scope creep (extra files touched beyond declared), stories with AC drift (closed but PO conditionally accepted).

2. **Friction log.** Pull from `sprint/{folder}/blitz/wave-*.md` (if present): every quarantine, retry, intervention across all waves. For each, the skill drafts a one-line root-cause guess from the recorded notes; the PO confirms or edits. If no blitz logs, this section says `No blitz logs; friction observable only via itr state.`

3. **Process improvement candidates.** Skill proposes 1–3 specific, actionable changes informed by the friction log. Examples: *"Declare `--files` more precisely on stories touching shared modules"*, *"Add a 'verify gate green for 60s' rule before closing stories"*. PO accepts, edits, or rejects each. Survivors become Retro action items in Phase 6.

4. **Codex-agent learnings.** Patterns that apply to future `$sprint` runs: planning gaps (e.g. "AC was too vague on story #103, Codex agents disagreed on done"), file-ownership misses (e.g. "shared util needed by 2 worker agents wasn't declared in either"), AC clarity issues. These don't necessarily become tasks; they become notes in the `retro-{date}.md` file. If any learning is a durable, cross-project rule rather than sprint-specific, ask the PO whether it should be promoted to project or global agent instructions such as `AGENTS.md` or `CODEX.md`.

Hold all four content blocks in memory. They land in the `Retro` section of `sprint/{folder}/plan.md` AND in the standalone `sprint/{folder}/retro-{date}.md`. (Schema for the standalone file is below.)

---

## Phase 6 — Triage drafting

Announce: `Phase 6 — Triage drafting`.

Compose the new `itr` issues to file. Use the `itr` skill's conventions (it will read `STORY_STYLE.md` for title/body/AC/tag style — let it).

Categories and their tag conventions:

| Source | Kind | Tags | Body must include |
|---|---|---|---|
| Bugs surfaced during Demo | `bug` | `from-review-N`, project tags from STORY_STYLE.md | story #N where surfaced |
| Rejected stories (carryover) | `task` | `carryover`, `sprint-N+1-candidate`, `product-backlog` | `carryover-from: itr#<original-id>`, PO's reason |
| Conditionally accepted (follow-up) | `task` | `from-review-N`, `product-backlog` | `follows-up: itr#<original-id>`, PO's condition |
| Demo feedback / new ideas | `feature` | `from-review-N`, `product-backlog` | brief context of when raised |
| Retro action items | `task` | `retro`, `process-improvement` | what to change, why (root-cause from friction log) |

**Print the full triage list as a flat table** so the PO sees exactly what will be filed at Gate 2:

```
Triage drafts (will file at Gate 2):
  [bug]      "<title>"                          tags: from-review-3, area:upload
  [task]     "<title>"                          tags: carryover, sprint-4-candidate
  [feature]  "<title>"                          tags: from-review-3, product-backlog
  [task]     "<title>"                          tags: retro, process-improvement
  ...
```

Hold all drafts. Do not file yet.

---

## Phase 7 — Final review (BLOCKING — Gate 2)

Announce: `Phase 7 — Final review`.

Print the full picture so the PO can approve everything in one look:

```
Sprint-N — review summary

Goal achievement:    yes | partial | no
Stories:             <closed>/<total> closed, <quarantined> q, <open> o
PO acceptance:       <accepted> accepted, <rejected> rejected, <conditional> conditional

Will write:
  1. New itr issues (M total):
     - <bug count> bugs, <carryover count> carryover, <feedback count> feedback, <retro count> retro
  2. Update sprint/{folder}/plan.md — fill Outcomes / Demo / Retro sections in-place
  3. Write sprint/{folder}/retro-<date>.md (if Retro ran; -2/-3 suffix on same-day repeats)
  4. Close sprint epic itr#<id> as <accepted | partially-accepted | rejected>
  5. Update sprint/CURRENT — repoint to next-highest open sprint or remove if none remain
  6. Update docs/ROADMAP.md via $roadmap --update (non-blocking; skipped if absent)

Approve, amend, or abort?
```

**Wait** for explicit approval. Accept edits ("drop the retro action item about #3", "don't close the epic, leave it open"). Reprint until the PO approves. If `--dry-run`, print this and stop here without writing anything.

---

## Phase 8 — Apply changes

Announce: `Phase 8 — Applying changes`.

Order matters — file new issues first so the artifact can reference real IDs:

1. **File the triage issues.** Defer to the `itr` skill (`itr add` per item, or `itr batch add` if more than ~3). Capture every new ID. On partial failure: retry once per item; if retry fails, surface the failed payloads to the user and resume from where it stopped (no rollback) — same pattern as `$sprint` Phase 5.

2. **Update `sprint/{folder}/plan.md` in-place.** Fill the empty Outcomes / Demo / Retro sections with the data from Phases 2, 3, and 5. Preserve everything else in the file. Schema for these sections is below.

3. **Write `sprint/{folder}/retro-<date>.md`** if Retro ran. Schema below. If a retro file with that date already exists, append `-2`, `-3`, etc.

4. **Close the sprint epic.** Use the `itr` close command (defer to `itr agent-info` for exact syntax) with a short closing note: `Reviewed <date>. Outcome: <yes|partial|no>. <accepted>/<total> stories accepted.`

5. **Update `sprint/CURRENT`.** Query `itr` for any remaining open `sprint-N` epics:
   - If at least one open: rewrite `CURRENT` with the highest-numbered open sprint's folder name.
   - If none open: delete `sprint/CURRENT`. Future `$blitz` runs without `--sprint` will fall back to `sprint/_unscoped/`.

6. **Update the roadmap (non-blocking).** If `docs/ROADMAP.md` (or `./ROADMAP.md`) exists, invoke `$roadmap --update` as a sub-skill so the cross-sprint map reflects the just-closed sprint:
   - Sections fully closed in this sprint flip to ✅.
   - Sections partially closed update notes / linked itr cells.
   - New triage-filed `itr` issues (carryover, follow-ups) get linked to their roadmap rows.
   - Trajectory entries naming this sprint are marked done; subsequent entries shift up by one.

   **Pass any roadmap-divergence note from the sprint's Open Assumptions log into the update.** If `$sprint` Phase 1 recorded a divergence (PO picked a Sprint Goal that didn't match the roadmap soft-suggest), parse the assumption line out of `sprint/{folder}/plan.md` and forward it to `$roadmap --update` so the affected roadmap row's notes capture the divergence reason. This closes the feedback loop — next-cycle `$sprint` Phase 0 sees the divergence context.

   **Failure handling:** if `$roadmap --update` errors (file shape unexpected, spec moved, sub-skill unavailable), log the error and proceed. The roadmap can always be refreshed manually with a direct `$roadmap` invocation — this hook is convenience, not load-bearing.

   **Skip the hook entirely if:**
   - No `docs/ROADMAP.md` (or `./ROADMAP.md`) exists. Note `Roadmap: absent — run $roadmap to map cross-sprint scope.` in the Phase 9 final report.
   - `--dry-run` is set (Phase 7 Gate 2 stops before any writes).

---

## Phase 9 — Final report

Announce: `Phase 9 — Sprint reviewed`.

Print:

```
Sprint-N reviewed and closed.

  Goal:                <one sentence>
  Achievement:         yes | partial | no
  Acceptance:          <accepted>/<total> stories accepted
  Epic:                itr#<id> (closed)
  Folder:              sprint/sprint-N-YYYY-MM-DD-<slug>/
  Plan:                sprint/{folder}/plan.md (updated)
  Retro:               sprint/{folder}/retro-<date>.md (or "Retro skipped — clean sprint")
  CURRENT:             → sprint-{N+M}-... (next open) | removed (no sprints in flight)
  Roadmap:             docs/ROADMAP.md (updated: N sections flipped ✅, M trajectory entries shifted) | absent — run $roadmap | update failed (see log; refresh manually)

New issues filed:
  Bugs (<N>):          itr#.., itr#..
  Carryover (<N>):     itr#.., itr#..
  Demo feedback (<N>): itr#..
  Retro actions (<N>): itr#..

Process changes for next sprint:
  - <retro action item>
  - <retro action item>

Next: run `$sprint` to plan the next sprint with carryover and product-backlog items in scope.
```

Stop.

---

## Artifact schema reference

Before Phase 8 writes review or retro artifacts, read `references/review-artifact-schemas.md` completely. It contains the Outcomes, Demo, Retro, standalone retro, and multi-repo schemas.

## Coaching style (Scrum Master tone)

- **Announce every phase by name** (`Phase 0 — ...`). Same structured-output principle as `$sprint` and `$blitz`.
- **Coach the *why* of each ceremony** in one short line as you reach it. ("Outcomes is the objective record." "Demo is per-story so the PO actually looks." "Friction is information.")
- **Adaptive Retro is a teaching moment**: when Retro is required, name the signal that triggered it. When skipped, name the signal absence. The PO learns the trigger logic over time.
- **Per-story PO acceptance is the only non-negotiable interaction.** Everything else is summary + approve. Drilling into stories is where review value lives.
- **Don't lecture.** One line per ceremony, then collect the answer.

---

## Principles

- **One sprint per invocation.** No batched multi-sprint reviews. Each sprint deserves its own ceremony.
- **PO acceptance per story.** Sprint-level "yes/partial/no" is a derived summary, not a substitute for per-story decisions.
- **Adaptive Retro is the right default for Codex-agent workflows.** Strict Scrum runs a Retro every sprint; Codex agents move faster than that ceremony cadence. Trigger Retro on friction signals; otherwise skip without guilt.
- **Triage flows through `itr`.** Don't reinvent issue creation here; the `itr` skill already reads `STORY_STYLE.md` for project conventions.
- **The artifact is the durable record.** `sprint/{folder}/plan.md` ends the day with all four sections filled (or Retro marked skipped). `sprint/{folder}/retro-{date}.md` captures the per-retro process learnings; the cross-sprint view comes from listing `sprint/sprint-*/retro-*.md`.
- **Closing the epic flips the in-flight signal.** Future `$sprint` runs will warn (but not refuse) about stacked sprints; closing makes the next planning session cleaner.
- **Two BLOCKING gates, no more.** Gate 1 confirms scope; Gate 2 approves the full picture before any writes. PO acceptance per story is inline, not a gate.

---

## Don't

- Don't proceed past Gate 1 without scope confirmation.
- Don't proceed past Gate 2 without explicit approval of the full triage list and epic closure.
- Don't write to `itr`, the plan artifact, the retro file, or `sprint/CURRENT` before Gate 2.
- Don't close the sprint epic if any goal-critical story is open without an explicit carryover decision from the PO.
- Don't silently invent a fresh `sprint/{folder}/plan.md`; confirm with the user first.
- Don't review more than one sprint per invocation. Re-run for each.
- Don't run a full Retro on a clean sprint just because Scrum says so. Adaptive depth is the point.
- Don't skip the testing-boundaries section in Demo — unclear test scope is the documented pain point this skill exists to fix.
- Don't roll back partial `itr` failures during Phase 8; retry once, surface, resume.
- Don't write the retro file if Retro was skipped.
- Don't leave `sprint/CURRENT` pointing at a closed sprint — repoint or delete it in Phase 8.
- Don't fail the review if `$roadmap --update` errors — it's a convenience hook. Log the failure, surface it in Phase 9, proceed.
