---
name: react-review
description: Apply opinionated TypeScript/React/Next.js review standards — strict typing (zero `any`), React-Compiler-aware performance, custom-hook architecture, naming/import conventions, async & error rules, and a code-smell catalog — as a checklist that augments a code review. Trigger when the user types /react-review, or asks to "review this React/TS", "check my component/hook against our standards", or wants strict React/Next best practices enforced. Do NOT trigger for non-React code, or for a generic cross-language diff review (use /code-review).
---

# react-review

The opinionated TypeScript/React/Next.js standards to enforce. Pair with `/code-review` for the review act; this skill is the **house checklist**. Direct and uncompromising — favor long-term maintainability over local convenience.

## Core principles

1. **Type safety** — zero tolerance for `any` (rare, justified exceptions only). Explicit return types. No `!` non-null assertions — handle null properly. Prefer `unknown` when truly unknown.
2. **Performance** — default to the **React Compiler (React 19+)** for automatic memoization; do **not** hand-wrap everything in `useMemo`/`useCallback`/`React.memo`. Blanket manual memoization is now an anti-pattern (noise, stale-dep bugs, fights the compiler). Reach for manual memoization only with a *measured* reason — a profiled hot path, or referential stability a dependency array / context value genuinely needs.
3. **Testing** — ≥80% coverage; critical paths exercised with React Testing Library / Vitest.
4. **WET** — if similar logic appears three times, abstract it into a reusable function/hook.

## Architecture

- **State** — context kept minimal; prefer Zustand for global state; pass props explicitly for testability.
- **Components** — business logic lives in custom hooks; components are JSX + minimal glue.
- **Data fetching** — Server Actions by default for initial data; client fetching only to improve time-to-paint (Suspense boundaries, `use` hook).
- **Files** — flat, domain-based; one component per file.

## Coding standards

- **Naming** — booleans `is`/`has`/`should`; handlers `handle*` (not `on*`); `{ComponentName}Props`; constants `SCREAMING_SNAKE_CASE`.
- **Imports** — order: React → Next → third-party → alias → relative; blank line between groups, alphabetized within.
- **Functions** — ≤50 lines; guard clauses + early returns (no `else` after return); destructure when >2 args; arrow functions except components.
- **Types** — discriminated unions beyond 3 options; explicit interfaces, no inline object types.
- **Async** — `async`/`await` only (no `.then()` chains); no floating promises; `Promise.all` for parallel; `AbortController` on fetches.

## Code smells to flag

`useEffect` that could be server-side · multiple `useState` that should be `useReducer` · untyped props spreading · conditional hooks · direct DOM manipulation · timers without cleanup · stray `console.log` · TODOs without tickets · commented-out code · hardcoded URLs/endpoints · magic numbers/strings · missing error boundaries · unhandled rejections.

## Output (per finding)

**Severity** (Critical/High/Medium) · **Issue** · **Location** · **Fix** (exact change) · **Rationale**. Lead with the most critical issues.
