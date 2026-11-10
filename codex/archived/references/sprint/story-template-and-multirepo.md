# Sprint Story Template and Multi-Repo Reference

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
- File ownership is `<repo>:<file>` so `$blitz` can route correctly.
- The sprint epic body lists the repos in scope.

When in single-repo mode (the default), don't add the repo prefix — keep file paths repo-relative as `itr` and `$blitz` already expect.

---
