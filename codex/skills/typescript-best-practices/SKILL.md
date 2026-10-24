---
name: typescript-best-practices
description: "Use for TypeScript or JavaScript (.ts, .tsx, .js, .mjs) reviews, implementations, and refactors where idiomatic strict typing, unknown over any, discriminated unions, readonly, error handling, async and AbortController, ESM modules, runtime validation at trust boundaries, node:test or vitest, and the tsc plus eslint verify gate matter; plain JS is in scope via JSDoc and // @ts-check. Fits Node CLIs, small browser apps, Manifest V3 Chrome extensions, and Claude Code mods. Do not use for Rust, for UI or visual design work, or as a generic language-independent diff review."
---

# TypeScript Best Practices

Use this skill to keep TypeScript and JavaScript work aligned with the type
checker, the platform it runs on (Node, browsers, Chrome extensions), and
pragmatic production quality. Default to simple, idiomatic code first; add type
machinery, validation layers, and dependencies only where the task or evidence
justifies it. Plain JavaScript is in scope: the same rules apply, enforced
through JSDoc and `// @ts-check`.

## Reference Routing

The detailed standards live in `references/typescript-best-practices.md`. Read
the relevant sections before making non-trivial TypeScript or JavaScript design,
review, or refactor decisions.

- `tsconfig` strictness, `unknown` vs `any`, narrowing, unions, `satisfies`,
  `readonly`, casts: read the compiler settings and type system section.
- Error strategy, `cause`, floating promises, `Promise.all`, `AbortController`:
  read the errors and async section.
- ESM and module layout, barrels, validating JSON/messages/env, `??` and `?.`,
  adding a dependency: read the modules, boundaries, and dependencies section.
- Test runner choice, lint, format, `tsc --noEmit`, CI: read the tests and
  tooling section.
- Plain JS with JSDoc, Node CLIs, browser apps, MV3 extensions, Claude Code
  mods: read the platform notes.

Use `rg -n "^##|^###|keyword" references/typescript-best-practices.md` to jump
to the needed section instead of loading unrelated detail.

## Working Rules

1. Inspect the TS/JS context first: `package.json` (`type`, `engines`,
   `scripts`, dependencies), the lockfile (which package manager), `tsconfig*.json`
   and what it `extends`, `eslint.config.*`, formatter config, `manifest.json`
   for extensions, CI config, the existing test runner, and `AGENTS.md`.
2. Preserve the repo's local style and tools (quotes, semicolons, import style,
   test runner) unless they conflict with correctness or an explicit user goal.
   Do not add vitest where `node:test` or a kit harness is in use, and do not
   reformat files you are not changing.
3. Pick the appropriate rigor level:
   - Prototype: `// @ts-check` with JSDoc or loose TS; a local `as` or `any`
     with a note is acceptable when it keeps the path clear.
   - Correct: `strict` + `noUncheckedIndexedAccess`, no `any`, unions for state,
     every trust boundary validated, `cause` on rethrow, meaningful tests.
   - Hardened: add `exactOptionalPropertyTypes`, type-aware ESLint
     (`strictTypeChecked`), branded IDs, a schema library, and a single `check`
     script in CI, only when the code or the task earns it.
4. Treat type errors as design feedback first. Fix the model (a union,
   a narrowing, a validator) before reaching for `as`, `!`, `any`, or
   `@ts-ignore`. When a suppression is truly needed, use `@ts-expect-error`
   with a reason, on the narrowest line.
5. Types describe the inside; runtime checks guard the edge. Anything from
   `JSON.parse`, `fetch`, a file, `process.env`, `argv`, storage, or a message
   (`postMessage`, `chrome.runtime`) is `unknown` until validated once at the
   boundary.
6. In async code, leave no floating promises, run independent work with
   `Promise.all`, bound the fan-out, give every network call a timeout, and pass
   an `AbortSignal` down instead of leaving waits uncancellable.
7. Prefer the platform to a dependency (`fetch`, `node:test`, `util.parseArgs`,
   `structuredClone`, `crypto.randomUUID`). Add one only for a hard problem,
   after checking its size, maintenance, and transitive tree.

## Review Checklist

When reviewing TypeScript or JavaScript, lead with concrete bugs and risks.
Check:

- Types: `strict` and `noUncheckedIndexedAccess` on and `tsc --noEmit` actually
  run; no `any`; no `as` on external data, `as unknown as`, or unexplained
  `!`; string-literal unions rather than `enum`; `satisfies` for config tables.
- Data modeling: discriminated unions for state and messages, exhaustive
  `switch` ending in `assertNever`; `readonly` parameters; no in-place
  `.sort()` on shared arrays; `Map` for dictionaries with untrusted keys.
- Errors: no empty `catch` or `.catch(() => {})`; rethrow with `{ cause }`;
  `catch (e)` narrowed before use; typed results for expected failures at
  boundaries.
- Async: no floating promises or `forEach(async ...)`; independent awaits in
  `Promise.all`; bounded concurrency; `res.ok` checked; timeout and
  `AbortSignal` on fetch; state re-checked after `await`.
- Modules and boundaries: ESM with `import type` and named exports; no barrel
  files inside the app; no work at import time; JSON, env, messages, and storage
  validated once at the edge; no untrusted text interpolated into HTML or shell
  commands; `??` rather than `||` for defaults.
- Tests: the repo's runner; behavior tested through exported functions;
  malformed-input cases for every validator; dependencies injected rather than
  module-mocked; async assertions awaited.
- Tooling: `tsc --noEmit`, type-aware `eslint`, the formatter's `--check`, and
  the tests are the default quality gate, exposed as `typecheck`, `lint`,
  `format:check`, and `test` scripts; add `npm audit` or bundle-size checks
  when the project already uses them or the task asks for hardening.

## Verification

Prefer read-only checks first. Run the narrowest meaningful command for the
change (the one test file, `tsc --noEmit`), then the repo's normal gate when
practical. Run the project's pinned binaries through its package scripts rather
than global tools. Use `prettier --check` (or the formatter's check mode) before
formatting; only run mutating formatters or `eslint --fix` when formatting is
requested or the edit scope makes project-wide formatting acceptable.
