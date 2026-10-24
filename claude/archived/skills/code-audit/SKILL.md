---
name: code-audit
description: Whole-codebase efficiency & tech-debt audit — fan out sub-agents to crawl the entire repo, then synthesize a prioritized improvement-plan document (duplication, refactoring opportunities, anti-patterns, roadmap, metrics) in a direct, principal-engineer voice. Trigger when the user types /code-audit, or asks to "audit the whole codebase", "find all the tech debt", "review my app for refactoring/efficiency", "where can we cut duplication", or "draw up an improvement plan". Do NOT trigger for reviewing a diff or PR (use /code-review), for applying reuse/simplification fixes to changed code (use /simplify), or for a single-file review.
---

# code-audit

A **whole-codebase**, plan-first audit — the complement to native review tooling:

- `/code-review` reviews the current **diff/branch** for bugs + cleanups.
- `/simplify` **applies** reuse/simplification fixes to changed code.
- `/code-audit` (this) crawls the **entire repo** and produces a prioritized **improvement-plan document** — it diagnoses and plans; it doesn't edit.

Use it when the ask is "review my whole app and tell me what to fix," not "review this change."

## Method

1. **Fan out.** Spawn sub-agents (one per area/module) to crawl the codebase in parallel with a blunt brief: *"Review this code and draw up a plan to fix the issues. Be harsh, be critical, be thorough."*
2. **Synthesize.** Read the sub-agent reports for systemic patterns — not just local nits.
3. **Deep-dive** on: component/function reusability, module boundaries & separation of concerns, abstraction levels & interface design, performance implications, and testability/coverage gaps.
4. **Prioritize** by impact on maintainability and performance.

## Deliverable

Write an improvement-plan doc at the project root (default `app_pip.md` — Application Performance Improvement Plan) with:

1. **Executive summary** — the critical issues at a glance.
2. **Duplication analysis** — concrete repeated code + consolidation strategy.
3. **Refactoring opportunities** — what to split, reorganize, or rewrite, with before/after snippets.
4. **Anti-pattern catalog** — code smells with severity ratings.
5. **Implementation roadmap** — prioritized changes with rough effort estimates.
6. **Metrics** — expected gains (LOC reduction, complexity, etc.).

## Voice

Direct and honest — no sugar-coating. Sugar-coating tech debt is how it becomes insurmountable. Always cite concrete code, and pair every problem with a specific, actionable fix.

## Principles

- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. (The audit edits no source code, but the improvement-plan doc it writes is a change — commit it.)
