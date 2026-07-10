# Sprint Review Artifact Reference

## Outcomes / Demo / Retro section schemas (for `sprint/{folder}/plan.md`)

When filling the in-place stubs, use these structures:

### Outcomes (Phase 2 data)

```markdown
## Outcomes

**Goal achievement:** yes | partial | no
**Reviewed:** YYYY-MM-DD
**Stories:** <closed>/<total> closed, <quarantined> quarantined, <open> open

| ID | Title | Status | Closed | Notes |
|----|-------|--------|--------|-------|
| itr#... | ... | closed | YYYY-MM-DD | ... |

**Untracked changes (in git diff but not in itr):**
- <file or symbol, brief context> (or "none")
```

### Demo (Phase 3 data)

```markdown
## Demo

| ID | Title | PO Decision | Notes |
|----|-------|-------------|-------|
| itr#... | ... | accepted | — |
| itr#... | ... | conditional | follow-up itr#... |
| itr#... | ... | rejected | carryover itr#... |

**Bugs surfaced during demo:**
- itr#... — <title>
```

### Retro (Phase 5 data, only if retro ran)

```markdown
## Retro

**Triggered by:** <list of signals>

### Plan vs. actual
- <observation>

### Friction log
- <event from blitz log> — root cause: <one line>

### Process improvements (filed as retro action items)
- itr#... — <title>

### Codex-agent learnings
- <observation>
```

If retro was skipped, replace this block with:

```markdown
## Retro

**Skipped — clean sprint** (no quarantines, no interventions, no carryover, no bugs, completion ≥80%).
```

---

## retro-{date}.md schema

Standalone retro artifact, written under `sprint/{folder}/`. One file per retro; same-day repeats append `-2`, `-3`, etc. The user manages cleanup.

```markdown
# Retro — Sprint-N

**Date:** YYYY-MM-DD
**Sprint epic:** itr#<id>
**Sprint goal:** <one sentence>
**Outcome:** yes | partial | no

## Triggered by
- <signal>

## Plan vs. actual
- <observation>

## Friction log
| Event | Source | Root cause |
|-------|--------|------------|
| ... | blitz wave 2 retry on itr#103 | shared file conflict not declared |

## Process improvements (action items)
- itr#... — <title> — <why>

## Codex-agent learnings
- <observation>

## Notes for future $sprint runs
- <free-form, anything that should inform planning>
```

---

## Multi-repo handling

If sprint stories span multiple repos (their bodies contain `Repo: path/to/repo` lines):

- **Phase 0:** collect the unique repo set; print under `Repos:` in preflight.
- **Phase 2 (Outcomes):** run `git diff --stat` per repo over the sprint window; merge findings into a single `Untracked changes` list with `<repo>:<file>` paths.
- **Phase 3 (Demo):** for each story, run diff/verify in the story's declared repo. Show repo prefix on file paths in the story card.
- **Phase 8 (Apply):** file `itr` issues against the project's single `.itr.db` (sprint-level tracker, not per-repo). If a repo has its own `.itr.db`, defer to the user.

Multi-repo is a feature, not a default — most sprints stay in one repo. The skill auto-detects without ceremony when stories declare repos.

---
