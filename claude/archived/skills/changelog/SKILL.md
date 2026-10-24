---
name: changelog
description: Generate changelogs, release notes, and product-update summaries from git commits, PRs, and development activity — categorized (Breaking / Features / Enhancements / Fixes / Performance / Security / Docs / Dependencies / Deprecations), SemVer-aware, with migration notes for breaking changes and audience-tailored variants (developer / end-user / PM / exec / support). Trigger when the user types /changelog, or asks to "generate a changelog", "write release notes", "what changed since vX", "summarize commits for stakeholders", or "draft the v2.1 release notes". Do NOT trigger for writing a single commit message, for filling a sprint's Outcomes/Demo/Retro (use /sprint-review), or for one-off issue triage (use the itr skill).
---

# changelog

Turn raw development activity into clear release documentation that serves the audience it's for. Read git directly when you can; ask for input when you can't.

## Process

1. **Gather activity** — parse commits, PRs, and issues since the last release or the specified window (`git log <last-tag>..HEAD`, `gh pr list`, tags). If git data isn't available, say so and ask the user for commit messages / PR descriptions.
2. **Categorize** every change into the buckets below.
3. **Assess impact** — surface the most significant changes and who they affect.
4. **Detect breaking changes** — call them out explicitly and provide migration guidance.
5. **Tailor to audience** — produce the variant(s) requested (see below).
6. **Format** — clean, scannable, with links to issues/PRs/docs when available; recommend the next version per SemVer.

## Categories

| | Category | Meaning |
|---|---|---|
| 🚨 | Breaking Changes | API/behavior changes requiring user action |
| ✨ | Features | New functionality |
| 🔧 | Enhancements | Improvements to existing features |
| 🐛 | Bug Fixes | Resolved defects |
| ⚡ | Performance | Speed/efficiency gains |
| 🔒 | Security | Vulnerability patches — feature prominently |
| 📚 | Documentation | Doc updates |
| 📦 | Dependencies | Library/dependency bumps |
| ⚠️ | Deprecations | Marked for future removal |

## Audience variants

- **Developers** — API changes, code examples, migration steps.
- **End users** — feature benefits, UI improvements, resolved issues.
- **Product managers** — feature delivery, metrics, roadmap progress.
- **Executives** — business impact, risk mitigation.
- **Support** — known issues, workarounds, FAQ updates.

## Quality checklist

All significant changes captured · correct categorization · breaking changes have migration guidance · security prominent · SemVer-correct version · consistent, professional formatting.

## Principles

- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. (Applies when the changelog lands as a file in the repo; output delivered only in-chat has nothing to commit.)
