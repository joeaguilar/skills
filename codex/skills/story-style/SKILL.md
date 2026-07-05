---
name: story-style
description: "Story style: /story-style, create/update STORY_STYLE.md issue conventions from itr/gh/examples/interview; not filing issues."
---

# /story-style — capture project issue conventions

Produce `STORY_STYLE.md`, the file `/sprint` Phase 0 reads to mirror how this team writes issues. Walks the user through ingestion (real examples or pure interview), surfaces observed patterns, lets the user refine linearly or in free-form chat, then writes the file behind a single approval gate.

This is a setup wizard — it runs rarely, ideally once per project, and updates over time as conventions evolve.

**Out of scope:**
- Filing issues (use the `itr` skill).
- Planning sprints or producing backlogs (use `/sprint`).
- Defining Definition of Done. STORY_STYLE.md is **style only** — title shape, body template, AC format, tags, voice. DoD stays in `/sprint` because it's sprint-scoped, not project-scoped.

## Slash invocation

```
/story-style [--path <dir>]
```

| Form | Meaning |
|---|---|
| `/story-style` | Default — write/update `./STORY_STYLE.md` at repo root. |
| `/story-style --path <dir>` | Write to `<dir>/STORY_STYLE.md` instead. Override for monorepos where a sub-package needs its own style; one style file per repo is the strong default. |

---

## Roles & artifact

- **User** = author of project conventions. Picks ingestion mode, picks refinement mode, owns final approval.
- **Skill** = coach + drafter. Surfaces base defaults, infers patterns from real examples, teaches *why* each section exists, drafts the file.
- **Artifact** = `STORY_STYLE.md`. Read by `/sprint` Phase 0 and (eventually) by any other skill that creates issues. One file per repo.

---

## Phase 0 — Preflight

Announce: `Phase 0 — Preflight`.

1. **Resolve target path.** Default `./STORY_STYLE.md`; honor `--path` if supplied.

2. **Detect existing file.** If `STORY_STYLE.md` already exists at the target path, read it. The skill will run the full interview anyway and propose a section-level diff at Gate 1 (Phase 6) before writing — never silently overwrite.

3. **Detect available source tools** (used by Phase 2 if the user picks a connected source):
   - `itr` — present if `itr stats` returns a valid db.
   - `gh` CLI — present if `gh --version` succeeds.
   - Note in the preflight summary which are available.

4. **Print the Phase 0 summary:**

   ```
   Story style preflight
     Target:         ./STORY_STYLE.md
     Existing file:  none | found (<N> lines, last modified <date>)
     Sources:        itr (db: .itr.db) | gh CLI | none — paste-only
   ```

   No confirmation needed. Proceed straight to Phase 1.

---

## Phase 1 — Choose ingestion mode

Announce: `Phase 1 — Ingestion mode`.

Coach: *"Style guides are sharper when they're built from real examples. Pick how you want to seed this one — the more concrete the input, the better the inference."*

Use a multiple-choice user-input prompt with these three options:

- **Connected source** — point at `itr`, GitHub, Jira, etc. The skill samples real issues to learn from.
- **Pasted examples** — user pastes 3–5 representative tickets directly. Works for any tracker.
- **Pure interview** — no examples. Walk the schema cold against the base default.

If the user picked **Connected source** but no relevant CLI/skill is available (Phase 0 detected none), offer:
- Switch to **Pasted examples**, or
- Switch to **Pure interview**.

Don't halt; user picks the fallback.

---

## Phase 2 — Ingestion

Announce: `Phase 2 — Ingestion (<mode>)`.

### If Connected source
- **`itr`**: run `itr list -f json -n 10 --fields id,title,body,acceptance,priority,tags,kind` (or equivalent per `itr agent-info`). Sample up to 10 recent issues across kinds.
- **GitHub** (with `gh` present): run `gh issue list -L 10 --json number,title,body,labels,state` for the relevant repo.
- **Other (Jira, Linear, etc.)**: no CLI to call directly — fall back to **Pasted examples** for this run.

### If Pasted examples
Ask the user to paste 3–5 tickets. Accept any format; just collect the text.

### If Pure interview
Skip ingestion entirely. Proceed to Phase 4 with no observed-pattern summary.

---

## Phase 3 — Observed patterns (only if Phase 2 produced examples)

Announce: `Phase 3 — Observed patterns`.

Coach: *"Here's what I see across the examples. Confirm or correct before we refine — inference errors compound silently if we skip this."*

Print a structured `Observed:` block (easier for the next Codex run to parse than prose):

```
Observed:
  Title shape:    imperative | declarative | mixed
  Title length:   median <N> chars (range <min>-<max>)
  Body sections:  Why / What / Notes  (or: none — flat prose)
  AC format:      bulleted observable | Gherkin | mixed | absent
  Priority:       P0-P3 | critical/high/medium/low | numeric | absent
  Tag taxonomy:   <prefix>:* (e.g. area:auth) | flat | none
  Epic linking:   --parent | "Epic: #N" in body | none
  Voice/tone:     terse-technical | friendly-explanatory | formal | mixed
  Terminology:    "ticket" | "issue" | "story" | "task"
  Notable:        <anything else worth flagging — e.g. screenshots common, all titles end with project tag>
```

Ask: `Does this match how your team actually writes? (approve / correct / re-sample)`.

Capture corrections directly. If the user says "we actually use Gherkin even though only 2 of 5 pasted ones do", trust the user.

---

## Phase 4 — Show base default + pick refinement mode

Announce: `Phase 4 — Refinement mode`.

1. **Print the base default schema** (or, if Phase 3 produced corrections, the inferred-and-corrected starting point) so the user has something to react to. Use the rendered file structure from `STORY_STYLE.md schema` below.

2. **Ask the user to pick refinement mode** with a multiple-choice prompt:
   - **Linear** — field-by-field, base default pre-filled. Fast, predictable, keyboard-driven. Best for confident users with clear preferences.
   - **Free-form chat** — describe how your team writes stories in your own words; the skill drafts and confirms. Best when conventions are nuanced or hard to bucket.

---

## Phase 5 — Run the refinement

Announce: `Phase 5 — Refinement (<mode>)`.

### Linear mode

Walk the field list below in order. Each field uses a multiple-choice prompt when there's a clear set of options, or short freeform input when the answer is project-specific text. The base default (or inferred value from Phase 3) is always offered as the **Recommended** option.

Coach briefly at the start of each section block — one line on *why* the section exists with an example of what each option changes.

**Field list (canonical order):**

1. **Title shape** — imperative / declarative / mixed.
2. **Title length cap** — soft cap in chars (e.g. 60 / 80 / no cap).
3. **Title prefix convention** — none / area tag (`[auth] ...`) / type tag (`fix: ...`, `feat: ...`).
4. **Body sections** — pick from `Why / What / How / Notes / Acceptance / Out-of-scope` or define your own ordered set.
5. **Required body sections** — which of the above are mandatory vs optional.
6. **AC format** — bulleted observable outcomes / Gherkin (Given/When/Then) / numbered checklist.
7. **AC observability rule** — how strict ("must be Codex-checkable" vs "human-judged OK").
8. **Tag taxonomy** — flat / prefixed (`area:*`, `risk:*`, `type:*`) / list specific prefixes the project uses.
9. **Priority scheme** — `critical/high/medium/low` / `P0–P3` / numeric / other.
10. **Epic linking convention** — `--parent <id>` / `Epic: #N` line in body / no formal link.
11. **Terminology** — preferred noun: ticket / issue / story / task. Used consistently in the file.
12. **Voice & tone** — terse-technical / friendly-explanatory / formal / casual / domain-specific.
13. **Banned phrases / anti-patterns** — anything explicitly discouraged ("don't say 'simply'", "no 'should' in AC").
14. **Domain glossary** — short list of project-specific terms with one-line definitions.
15. **Anything else pertinent** — open freeform field. Captures the "we have this one weird thing" content.

After the last field, jump to Phase 6.

### Free-form chat mode

Open the conversation: *"Tell me how your team writes stories — examples, vibe, conventions, anything goes. I'll listen, ask 1–3 clarifying questions if needed, then draft the file for your approval."*

Listen. Take notes against the schema. Ask up to 3 clarifying questions for genuinely missing information (don't pad the conversation). Then draft the full file from the conversation + base default + ingestion observations, and proceed to Phase 6.

---

## Phase 6 — BLOCKING gate: confirm draft

Announce: `Phase 6 — Final review`.

Print the rendered `STORY_STYLE.md` in full so the user sees exactly what will be written.

If an existing file was found in Phase 0, also print a section-level diff:

```
Diff vs existing STORY_STYLE.md:
  Title & Body:           changed (new section ordering)
  Acceptance Criteria:    unchanged
  Tags & Priority:        added priority scheme
  Language & Voice:       changed (new glossary entries)
  Worked Examples:        regenerated
```

Ask: `Approve, edit, or abort?`

**Wait** for explicit approval. Accept edits ("drop the glossary", "use 'tickets' not 'issues'") and reprint until the user approves.

---

## Phase 7 — Write the file

Announce: `Phase 7 — Writing <path>`.

Write the file. Header line includes project name (inferred from the directory name unless the user already specified one) and ISO last-updated date.

If the directory doesn't exist (rare, only with `--path`), create it.

---

## Phase 8 — Final report

Announce: `Phase 8 — Done`.

Print:

```
STORY_STYLE.md written.

  Path:           ./STORY_STYLE.md
  Sections:       Title & Body, Acceptance Criteria, Tags & Priority, Language & Voice, Examples
  Diff:           created new | updated <N> sections (see above)

Example story (rendered in this style):
  <title>
  <one short body block + AC bullets>

/sprint will auto-detect this file in Phase 0 and mirror its conventions when drafting backlogs.
```

Stop.

---

## STORY_STYLE.md schema (the rendered file)

```markdown
# Story Style — <project name>

_Last updated: YYYY-MM-DD_

> How this project writes issues, tickets, and stories. Read by `/sprint` Phase 0 and Codex or any user agent that creates issues for this repo.

## Title & Body

**Title shape:** <imperative | declarative | mixed> — <one-line rule>
**Title length:** <cap or "no cap">
**Title prefix:** <none | convention>

**Body template:**
```
<rendered body skeleton with section headings>
```

**Required sections:** <list>
**Optional sections:** <list>

## Acceptance Criteria

**Format:** <bulleted observable | Gherkin | numbered>
**Observability rule:** <one-line rule>
**DoD reference:** <how DoD is referenced or appended — e.g. "appended by /sprint per sprint">

## Tags & Priority

**Tag taxonomy:** <flat | prefixed conventions>
**Common tag prefixes:** <list with one-line meanings>
**Priority scheme:** <scheme + values>
**Epic linking:** <convention>

## Language & Voice

**Terminology:** prefer "<noun>" (not "<alternates>")
**Voice:** <terse-technical | friendly-explanatory | formal | ...>
**Banned phrases / anti-patterns:**
- <bullet>

**Domain glossary:**
- **<term>** — <one-line definition>

**Other project-specific notes:**
- <bullet>

## Worked Examples

### Example 1 — <kind, e.g. feature>

<rendered title>

<rendered body>

**Acceptance criteria:**
- <bullet>
- <bullet>

### Example 2 — <kind, e.g. bug>

<rendered title>

<rendered body>

**Acceptance criteria:**
- <bullet>
- <bullet>
```

If a section ends up empty (e.g. no banned phrases declared), omit it rather than leaving a placeholder.

---

## Coaching style (Scrum-Master-adjacent tone)

- **Announce every phase by name.** Same structured-output principle as `/sprint` and `/blitz` — the user always knows where they are.
- **Teach the *why* of each schema section** in one short line as you reach it. Examples:
  - *"Title shape matters because every user agent picking up an issue scans titles first; consistency speeds triage."*
  - *"AC observability is what lets Codex self-verify it's done — vague AC creates handoff failures."*
- **Don't lecture.** One line per section, then collect the answer. Verbose is fine; preachy is not.
- **Trust user overrides over inferred patterns.** If Phase 3 saw bulleted AC but the user says "we want Gherkin going forward", capture the user's intent, not the historical pattern.

---

## Principles

- **One repo, one style file.** `--path` exists for the rare monorepo exception, but the strong default is single-source-of-truth per repo.
- **Style only, not DoD.** STORY_STYLE.md describes how stories *look*. Definition of Done is sprint-scoped and lives in `/sprint`. Don't blur the boundary.
- **Inference is a starting point, not authority.** Always confirm observed patterns with the user before refinement. Inference errors compound silently otherwise.
- **One BLOCKING gate, no more.** The interview itself gives the user agency throughout; only the final write needs an explicit confirmation.
- **Worked examples beat declarative templates.** End the file with 1–2 fully-rendered example stories; that's what the next Codex run reads to understand the style.
- **Setup wizard, not daily driver.** Run rarely. Each run is either init or update.

---

## Don't

- Don't write the file before Phase 6 approval.
- Don't silently overwrite an existing `STORY_STYLE.md` — always show the diff first.
- Don't define a project-wide Definition of Done here; that's `/sprint`'s territory.
- Don't file or modify any issues; this skill never touches the tracker.
- Don't add multiple style files per repo unless the user explicitly used `--path` knowing the trade-off.
- Don't fold inferred patterns into the draft silently — confirm them in Phase 3.
- Don't lecture; coach in one line per section.
