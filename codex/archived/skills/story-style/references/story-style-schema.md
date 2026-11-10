# Story Style Artifact Reference

## STORY_STYLE.md schema (the rendered file)

```markdown
# Story Style — <project name>

_Last updated: YYYY-MM-DD_

> How this project writes issues, tickets, and stories. Read by `$sprint` Phase 0 and Codex or any user agent that creates issues for this repo.

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
**DoD reference:** <how DoD is referenced or appended — e.g. "appended by $sprint per sprint">

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
