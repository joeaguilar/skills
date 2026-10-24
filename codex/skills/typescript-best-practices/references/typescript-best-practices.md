# The comprehensive TypeScript and JavaScript best practices reference

Idiomatic TypeScript means letting the compiler prove what it can and letting runtime checks guard what it cannot. **The single most important principle: type the inside of your program strictly, treat everything that crosses a boundary as `unknown` until it is validated, and keep both layers as small as the code allows.** This document covers compiler settings, the type system, errors, async, modules, boundaries, dependencies, testing, and tooling for the code this repo actually writes: Node CLIs, small browser apps, Manifest V3 Chrome extensions, and Claude Code mods. It is not about frameworks. Plain JavaScript is in scope throughout; the rules are the same and the enforcement is JSDoc plus `// @ts-check` (see the platform notes). The TypeScript snippets marked good were checked with `tsc` 5.9 under `strict` and `noUncheckedIndexedAccess` (the extension handler against a stand-in for `chrome.runtime`).

## Reference map

- Compiler settings and the type system: `tsconfig`, `unknown`, narrowing, unions, `satisfies`, `readonly`, casts
- Errors and async: `cause`, swallowed errors, typed results, floating promises, `Promise.all`, `AbortController`
- Modules, boundaries, and dependencies: ESM, barrels, runtime validation, `??` and `?.`, dependency restraint
- Tests and tooling: `node:test`, vitest, the `tsc` + `eslint` verify gate
- Platform notes: plain JS with JSDoc, Node CLIs, browser apps, MV3 extensions, Claude Code mods

---

## Compiler settings and the type system

### Make the compiler strict, and say so explicitly

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,   // `import type` stays a type import
    "noEmit": true,                 // tsc checks; the runtime or bundler runs the code
    "skipLibCheck": true,
    "target": "es2023",             // the oldest runtime you ship to, not ES5
    "module": "nodenext"            // Node. With a bundler: "esnext" + "moduleResolution": "bundler"
  }
}
```

**Write `strict` out even where a default would turn it on** — defaults differ between TypeScript versions and a config that depends on them breaks on upgrade. `strict` is a bundle (`strictNullChecks`, `noImplicitAny`, `useUnknownInCatchVariables`, ...); never switch off a member of it to make an error go away.

**`noUncheckedIndexedAccess` is the one flag `strict` does not include and the one worth the most.** It makes `arr[i]` and `record[key]` `T | undefined`, which is what they are at runtime. Without it, an empty array passes the checker and crashes in production.

```ts
// bad: `rows[0]` is `Row` to the checker, undefined on an empty array
const first = rows[0]
console.log(first.name)

// good: the compiler makes you decide what empty means
const first = rows[0]
if (!first) throw new Error('no rows')
console.log(first.name)
```

`for (const row of rows)`, `.map`, `.find`, and destructuring with defaults avoid most of the noise. Reach for `!` last (see casts below).

`exactOptionalPropertyTypes` (so `{ a?: number }` cannot hold an explicit `undefined`) and `noPropertyAccessFromIndexSignature` belong to the hardened tier: valuable in a library, noisy against untyped dependencies. Pin `typescript` in `devDependencies` and run the project's copy, never a global one.

### `unknown` over `any`, then narrow

`any` switches the checker off for everything it touches and spreads through inference; `unknown` makes you prove the shape before use. `JSON.parse`, `response.json()`, and untyped library returns hand you `any`: assign them to `unknown` immediately.

```ts
// bad: compiles, throws at runtime when `user` is missing
const data = JSON.parse(raw)
data.user.name.toUpperCase()

// good
const data: unknown = JSON.parse(raw)
if (isRecord(data) && isRecord(data.user) && typeof data.user.name === 'string') {
  data.user.name.toUpperCase()
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}
```

The narrowing toolbox: `typeof`, `instanceof`, `in`, `Array.isArray`, `===` against a literal, a discriminant property, type predicates (`x is T`), assertion functions. Careful with truthiness: `if (count)` is false for `0`, `if (name)` is false for `''`; compare against `undefined` when zero or empty is a valid value. **A type predicate is a promise to the compiler, not a check**: a guard that verifies one field and claims a whole shape is a cast in disguise. `catch (e)` is `unknown` under `strict`; narrow it (see errors).

### Discriminated unions, and exhaustive `switch` with `never`

Model state as one union with a literal tag, not several booleans and optionals. Illegal combinations stop being representable and every consumer is forced to handle each case.

```ts
// bad: three fields, eight combinations, five of them nonsense
type Load = { loading: boolean; error?: Error; data?: Data }

// good
type Load =
  | { status: 'loading' }
  | { status: 'failed'; error: Error }
  | { status: 'ready'; data: Data }

function assertNever(x: never): never {
  throw new Error(`unhandled variant: ${JSON.stringify(x)}`)
}

function render(load: Load): string {
  switch (load.status) {
    case 'loading': return '...'
    case 'failed': return load.error.message
    case 'ready': return String(load.data.n)
    default: return assertNever(load)   // adding a variant fails to compile here
  }
}
```

Use the same shape for messages between processes (`{ type: 'ping' } | { type: 'save'; id: string }`) and for parsed command variants. Turn on `@typescript-eslint/switch-exhaustiveness-check` so a missing case is caught even without the `default`.

**Prefer string-literal unions to `enum`.** An `enum` emits runtime code and is not erasable syntax (it fails under type stripping and `erasableSyntaxOnly`), and `const enum` adds cross-file pitfalls under `isolatedModules`. When you also need the values at runtime (to validate input), derive the type from an `as const` array so the list and the type cannot drift:

```ts
const MODES = ['fast', 'safe'] as const
type Mode = (typeof MODES)[number]
const isMode = (x: unknown): x is Mode => MODES.some((m) => m === x)
```

Branded types (`type SessionId = string & { readonly __brand: 'SessionId' }`) are the newtype equivalent. Use them only where mixing two kinds of string is a real risk, with one validating constructor as the single sanctioned cast.

### `satisfies`: check the shape without widening it

A type annotation widens the value to the annotation; no annotation lets typos through. `satisfies` validates against a type and keeps the specific one.

```ts
type Route = { path: string; title: string }

// bad: annotation loses the keys and the literals
const routes: Record<string, Route> = { home: { path: '/', title: 'Home' } }
routes.hme            // compiles: any string key is allowed

// good: checked against Route, keys and literals preserved
const routes = {
  home: { path: '/', title: 'Home' },
  about: { path: '/about', title: 'About' },
} satisfies Record<string, Route>
routes.hme            // error: property does not exist
```

It fits config tables, hotkey maps, and command registries. Add `as const` (`{...} as const satisfies T`) when the literal values matter.

### `readonly` and immutability

Mutation you cannot see is the commonest source of "it worked until another caller used it". Accept the read-only type in parameters (it admits both mutable and read-only arrays), return the specific type.

```ts
// bad: rejects readonly arrays, invites the callee to mutate the caller's data
function total(xs: number[]): number

// good
function total(xs: readonly number[]): number

type Config = Readonly<{ port: number; hosts: readonly string[] }>
const DEFAULTS = { retries: 3, hosts: ['a', 'b'] } as const
```

`readonly` is compile-time only; `Object.freeze` is the shallow runtime version. **`.sort()`, `.reverse()`, and `.splice()` mutate in place** — use `toSorted()`, `toReversed()`, `toSpliced()`, `with()`, or spread when the original is shared. For dictionaries keyed by untrusted strings use a `Map` (a plain object accepts `__proto__` and `constructor` keys) and `Object.hasOwn(obj, key)` rather than `key in obj`.

### Casts, non-null assertions, and suppressions are claims

`as T` on external data, `x!`, and `as unknown as T` tell the compiler to stop checking. Each one needs a reason the compiler cannot see, and most are a missing narrowing or a missing validation.

- `as` is fine for `as const` and for a single validated constructor; `JSON.parse(raw) as Settings` is the bug, not the fix.
- `!` is acceptable directly after a check the compiler cannot follow, with a comment. Never chain `!` to silence `noUncheckedIndexedAccess` across a codebase.
- Use `// @ts-expect-error reason` over `@ts-ignore`: it fails when the error goes away, so dead suppressions cannot pile up. Enforce with `@typescript-eslint/ban-ts-comment` set to `allow-with-description`.

### Signatures

Give exported functions explicit return types (it documents the contract, catches accidental widening, and keeps declaration emit cheap); infer locals. Replace more than three positional parameters, or any boolean flag, with an options object: `fetchUser(id, { retry: true })` beats `fetchUser(id, true, false)`. A type parameter used once is a smell; use the concrete type. Prefer `undefined` for "absent" in your own APIs and expect `null` only at JSON and DOM boundaries; do not put both in one type.

---

## Errors and async

### Errors

**Throw only `Error` instances, wrap with `cause`, and let each layer say only what it was doing.** `throw 'oops'` has no stack; a rethrown message that pastes in the inner message duplicates it; `cause` keeps the chain intact for logs and debuggers.

```ts
async function loadConfig(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (err) {
    throw new Error(`reading config ${path}`, { cause: err })
  }
}
```

**Never swallow.** An empty `catch {}`, a `.catch(() => {})`, or a `catch { return null }` turns a failure into a wrong answer later. If a specific failure is expected, catch that one and rethrow the rest:

```ts
try {
  return await readFile(p, 'utf8')
} catch (err) {
  if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return undefined
  throw err
}
```

**Throw for bugs and unexpected failures; return a typed result when failure is an ordinary outcome the caller must branch on**, which means parsers, validators, and message handlers at a boundary. Keep it to a union, not a library:

```ts
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E }
```

Define an error class (with a `name` or `code`) only when callers will match on it; otherwise a plain `Error` with `cause` is enough. In a CLI, one top-level handler prints the message to stderr and sets `process.exitCode = 1`; avoid `process.exit()` mid-flow because it can cut off buffered output. Use `finally` for cleanup, not control flow.

### Async

**No floating promises.** A promise that is neither awaited, returned, nor handled turns a rejection into a crash (Node) or a silent loss (browser). Mark deliberate fire-and-forget with `void` and a handler.

```ts
// bad
saveState(s)

// good
await saveState(s)
// deliberate fire-and-forget
void saveState(s).catch(reportError)
```

Turn on `@typescript-eslint/no-floating-promises` and `no-misused-promises` (an `async` callback passed where a `void` return is expected, such as an event handler). **`xs.forEach(async ...)` does not wait**; use `for...of` for sequential work or `Promise.all(xs.map(...))` for parallel. Use `return await` inside `try/catch`, or the `catch` never sees the rejection.

**Independent work runs in parallel; dependent or rate-limited work runs in sequence.**

```ts
// bad: two independent calls, one after the other
const a = await getA()
const b = await getB()

// good
const [a, b] = await Promise.all([getA(), getB()])
```

`Promise.all` rejects on the first failure but does not cancel the others (pair it with an `AbortController`); use `Promise.allSettled` when partial success is the point. **Bound the fan-out**: `Promise.all` over ten thousand items opens ten thousand sockets. A small pool is a few lines (use `p-limit` only if it is already a dependency):

```ts
async function pool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  const it = items.entries()   // one shared iterator: each worker pulls the next item
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (const [i, item] of it) out[i] = await fn(item)
    }),
  )
  return out
}
```

**Make every wait cancellable and every network call bounded.** `fetch` has no default timeout, so a hung server hangs the program. Accept a `signal` as the last option, pass it down to `fetch`, `node:fs/promises`, `node:timers/promises`, and child processes, and check `signal.throwIfAborted()` in long loops.

```ts
const res = await fetch(url, { signal: AbortSignal.any([userSignal, AbortSignal.timeout(10_000)]) })
if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)   // fetch resolves on 404 and 500
```

Treat an abort as control flow, not a failure to report. Pass `{ signal }` to `addEventListener` to remove a group of listeners in one `abort()`. In a CLI, abort on `SIGINT` (`process.once('SIGINT', () => ac.abort())`) so cleanup runs.

**Do not block the event loop.** Synchronous file reads at CLI startup are fine; CPU-heavy loops or `*Sync` calls in a server, a service worker, or a UI thread are not. Move them to `worker_threads` or a Web Worker. **Re-check state after every `await`**: anything read before the await may be stale after it (a tab closed, a setting changed, a second message arrived).

---

## Modules, boundaries, and dependencies

### Modules

**ESM only for new code**: `"type": "module"`, `import`/`export`, no `require` mixed in, `node:` prefix on built-ins (`node:fs/promises`). Use `import.meta.dirname` / `import.meta.filename` (Node 20.11+) instead of `__dirname`, and `path.join` rather than string concatenation (this code runs on Windows). Under `module: nodenext` relative imports carry the runtime extension (`./util.js`, even from a `.ts` file); under a bundler they do not. Follow what the `tsconfig` says. Use `import type` for types so a type import never becomes a runtime import; `verbatimModuleSyntax` enforces it.

**Named exports over `export default`**: a default export gets a different name in every importer, resists grep and rename, and re-exports awkwardly. Keep default exports only where a tool demands one (config files, framework entry points).

**Barrel files cost more than they save.** An `index.ts` full of `export *` makes every import load everything behind it (slow CLI startup and tests, weak tree-shaking, circular-import traps, noisy auto-import). Allow one at a package's public edge; inside the app, import from the file that defines the symbol.

**Importing a module must not do work.** No network, file, or DOM side effects at top level beyond defining things; export functions and run them from a thin entry. That keeps modules testable. (An MV3 service worker's top-level listener registration is the deliberate exception.) Group by feature rather than by kind (`utils/`, `helpers/`, `types/` become dumping grounds), export only what other modules use, and break circular imports rather than working around them.

### Validate at runtime at the trust boundary

Types are erased; at runtime the data is whatever arrived. **Everything the compiler did not produce is `unknown`**: `JSON.parse`, `await res.json()`, file contents, `process.env` and `argv`, `localStorage` and `chrome.storage`, `postMessage` and `chrome.runtime.onMessage`, URL and query parameters, `FormData`, subprocess output, model output. Validate once at the edge; inside the edge, code takes the typed value and never re-checks.

```ts
// bad: the cast is a promise nobody checked
const settings = JSON.parse(raw) as Settings

// good: one function owns the claim
const settings = parseSettings(JSON.parse(raw))   // (x: unknown) => Settings; throws or returns a Result
```

Hand-written guards are right for one to three small shapes. Use a schema library (zod, valibot) when there are many shapes or it is already a dependency, and **derive the type from the schema** (`z.infer`) so the check and the type cannot disagree. Decide once per project; do not mix both.

**Parse `process.env` once**, in a config module at startup, failing fast with the variable name. `process.env.PORT` is `string | undefined`, `Number('')` is `0`, and `Number('abc')` is `NaN`:

```ts
function parsePort(raw: string | undefined): number {
  const n = raw === undefined ? 3000 : Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > 65535) throw new Error(`PORT must be an integer 0-65535, got ${raw}`)
  return n
}
```

For messages, check the `type` discriminant, then the fields, and reject an unknown `type` explicitly. On the output side, never build HTML, shell commands, or queries by interpolating untrusted text: use `textContent`, `execFile(cmd, [args])` instead of `exec(string)`, and parameterised queries.

### Equality and nullish

Use `===` and `!==` always; the one accepted `==` is `x == null` (both `null` and `undefined`) if the repo already uses it (`eqeqeq` with `{ null: 'ignore' }`). **Use `??` for defaults, not `||`**: `||` also replaces `0`, `''`, and `false`.

```ts
const port = opts.port || 3000    // bad: port 0 becomes 3000
const port = opts.port ?? 3000    // good
```

Use `?.` where a value is genuinely optional; a long `a?.b?.c?.d` chain over data that is never missing hides bugs, and `no-unnecessary-condition` flags `?.` on a non-nullable type. `??=` replaces the `if (x === undefined) x = ...` dance.

### Dependency restraint

Every dependency is code you did not review, with its own transitive tree, install scripts, and update burden. In a browser app or extension it also ships to every user, and MV3 forbids remotely hosted code. **Check the platform first.**

| Instead of | Use |
|---|---|
| commander / yargs / minimist (flag-simple CLIs) | `util.parseArgs` |
| axios / node-fetch | global `fetch` |
| jest / mocha (no existing runner) | `node:test` |
| uuid | `crypto.randomUUID()` |
| lodash `cloneDeep` | `structuredClone` |
| dotenv | `node --env-file=.env` |
| chalk | `util.styleText` |

Add a dependency when it replaces a hard problem (a format parser, crypto, schema validation at scale), and never hand-roll those: CSV quoting, YAML, semver, and crypto are the opposite mistake. Before adding, check maintenance, install size, transitive count, bundled types, ESM support, and license. Commit the lockfile, use one package manager per repo (the lockfile says which), install with `npm ci` in CI, and keep tooling in `devDependencies`.

---

## Tests and tooling

### Testing that catches real bugs

**Use the runner the repo already has.** For a new Node or CLI project, `node:test` with `node:assert/strict` needs no dependency (`node --test`). Use vitest when you need a DOM environment, rich mocking or snapshots, or the project already builds with Vite. Claude Code mod tests use the plugin kit's own harness (`claude-code/testing`, in `.tsx` files); do not add a second runner beside it.

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('parseSettings rejects a non-object', () => {
  assert.throws(() => parseSettings([]), /expected an object/)
})

for (const [input, want] of [['1', 1], ['0x10', 16]] as const) {
  test(`parses ${input}`, () => assert.equal(Number(input), want))
}
```

- Test behaviour through the exported function. Use table-driven cases, and write the regression test before the fix. **The boundary validator is the most valuable thing to test**: feed it malformed, truncated, and wrongly typed input.
- **Inject the world instead of mocking modules**: pass `fetch`, a clock, the file system, and `env` as parameters or a small deps object. Use `t.mock.fn` and `mock.timers` for spies and fake time, and never sleep to wait for an event. No real network, no real home directory; use `fs.mkdtemp` and clean up in `after`.
- **Await every async assertion**: `await assert.rejects(fn(), /boom/)`. A test that returns a promise nobody awaits passes vacuously.
- A `// @ts-expect-error` line in a test asserts that a bad call does not compile, and it fails if the call starts compiling.
- Export pure parse and render helpers and test them directly, then test the glue (DOM, `chrome.*`, hooks) with a fake of the world beneath it.

### Lint, format, and typecheck are the verify gate

```jsonc
// package.json "scripts"
"typecheck": "tsc --noEmit",
"lint": "eslint .",
"format:check": "prettier --check .",
"test": "node --test",
"check": "npm run typecheck && npm run lint && npm run format:check && npm test"
```

Name the scripts `typecheck`, `lint`, `format:check`, and `test`: tooling that detects a repo's verify gate looks for exactly those. Cheapest and most informative first, and run the same command locally and in CI (`actions/setup-node` with the package cache, `npm ci`, `npm run check`).

- **`tsc --noEmit` is not optional.** esbuild, Vite, `tsx`, and Node's type stripping all erase types without checking them, so without this step type errors ship. Use `tsc -b` for project references.
- **ESLint** with flat config (`eslint.config.js`) and typescript-eslint's type-aware presets: `tseslint.configs.strictTypeChecked` with `languageOptions.parserOptions.projectService: true`. The rules that earn their keep are `no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check`, `no-explicit-any` with the `no-unsafe-*` family, `consistent-type-imports`, `ban-ts-comment`, and `no-unnecessary-condition`. Add `no-console` in library code so output goes through one module.
- **Formatter**: Prettier or Biome, whichever the repo has, run with `--check` in the gate. Formatting is not a review topic. Biome alone is a sound choice for a small project, but keep `tsc --noEmit` either way.
- Suppress a lint rule on the narrowest line with a reason (`// eslint-disable-next-line rule -- why`) and report unused directives.
- Pin the runtime (`engines`, `.nvmrc`) and the TypeScript version so the gate means the same thing on every machine.

---

## Platform notes

### Plain JavaScript

The same rules apply; the checker is `tsc` reading JSDoc. Put `// @ts-check` at the top of a file, or set `"allowJs": true`, `"checkJs": true`, `"noEmit": true` in a `tsconfig.json` or `jsconfig.json` so `tsc --noEmit` stays the gate.

```js
// @ts-check
/** @import { Result } from './types.js' */

/**
 * @typedef {Readonly<{ port: number, hosts: readonly string[] }>} Config
 */

/**
 * @param {unknown} raw
 * @returns {Result<Config>}
 */
export function parseConfig(raw) { /* ... */ }
```

Use `@param`, `@returns`, `@type`, `@typedef`, `@template`, and `@satisfies`. `@import` (TypeScript 5.5+) replaces `import type`. Put shared types in a `types.d.ts` and reference them with `@import`. Staying in JS with JSDoc suits files with no build step: content scripts, single-file CLIs, and small pages loaded with `<script type="module">`. Move to `.ts` when generics, unions, or the file count make JSDoc the harder way to write types. A `.mjs`/`.cjs` extension or `"type"` in `package.json` fixes the module format; ESM is already strict, so skip `"use strict"`.

Node 22.18+ and 24 run `.ts` files directly by stripping types. That supports only erasable syntax (no `enum`, `namespace`, or constructor parameter properties), so set `erasableSyntaxOnly: true` and keep `tsc --noEmit` in the gate.

### Node CLIs

Keep the entry file thin: `#!/usr/bin/env node`, parse arguments (`util.parseArgs`), call a `run(args, io)` that takes stdout, stderr, `env`, and any fetch or clock it needs and returns an exit code, then `process.exitCode = await run(...)`. Data goes to stdout and diagnostics to stderr; failure exits non-zero; a `--json` flag gives scripts something stable. Build paths with `node:path` and `URL`/`fileURLToPath`, never hard-coded `/`, and expect CRLF. Read stdin with `for await (const chunk of process.stdin)`.

### Browser apps

- Insert data with `textContent` or `createElement`, never `innerHTML` (XSS); sanitise first if HTML is unavoidable.
- `querySelector` returns `T | null`: narrow it, or use a small `must(selector)` helper that throws.
- Use `addEventListener(..., { signal })` for teardown and avoid inline handlers (CSP).
- Wrap `localStorage` and `sessionStorage` in `try/catch` (they throw when blocked or full) and validate what you read back.
- Check `res.ok` on every `fetch`, with a timeout signal.
- A small app can ship as plain modules with an import map and no build step.

Layout, visual design, and accessibility are not this skill's job.

### Manifest V3 Chrome extensions

- **The service worker is ephemeral.** It is stopped after about 30 seconds idle and restarted by events, so module-level variables are a cache at best. Keep state in `chrome.storage.session` or `.local`, and re-read after each `await`. `localStorage` does not exist there.
- **Register every event listener synchronously at the top level** of the service worker, not after an `await` or inside a callback, or the event that woke it is missed. Use `chrome.alarms` instead of `setInterval` or long timeouts.
- **Messages are untrusted input.** Type the listener's message as `unknown`, validate the shape (a discriminated union on `type`), and check `sender.id === chrome.runtime.id` plus `sender.tab`/`sender.url` where the origin matters. An `async` listener does not keep the channel open on every Chrome version: return `true` and call `sendResponse` later.

```ts
chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  const parsed = parseMessage(msg)   // Result: validates the shape
  if (!parsed.ok) {
    sendResponse({ ok: false, error: parsed.error })
    return false
  }
  void handle(parsed.value, sender).then(sendResponse, (e: unknown) =>
    sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }),
  )
  return true   // keep the channel open for the async response
})
```

- Use the promise forms of `chrome.*` APIs, with `@types/chrome` for types. `chrome.storage` values come back `unknown` in spirit: they may predate the current version of the extension, so validate and migrate on read.
- No `eval`, `new Function`, or remotely hosted code; bundle everything. Ask for the fewest `permissions` and `host_permissions`, and use `optional_permissions` for rare ones. Content scripts run in an isolated world: talk to them with messages, not shared globals, and check `event.origin` and `event.source` on `window.postMessage`.
- Unit-test handlers as plain functions given a fake `chrome` object.

### Claude Code mods

Mod hooks and `.tsx` tests are ordinary TypeScript under the plugin kit's `tsconfig` (the mod's `tsconfig.json` extends it: `strict`, `noUncheckedIndexedAccess`, `moduleResolution: bundler`, `noEmit`). Do not loosen it; run `tsc --noEmit` in the mod folder. Keep hook handlers cheap and total: catch and report errors inside the hook, and never delay the host's own work. Export the pure parse and render helpers and test them directly; give the `world()` beneath the mod (git, file system, clock, commands) in-memory fakes, as the existing tests do. Engine and host rules (what a hook may do, how the test kit behaves) come from the plugin kit's own documentation and types, not from this reference.

---

## The pragmatism spectrum

| Phase | Types | Boundaries | Verification |
|-------|-------|------------|--------------|
| **Prototype** | `// @ts-check` with JSDoc, or loose TS; local `as`/`any` with a note | Trust input you control | Run it |
| **Correct** | `strict` + `noUncheckedIndexedAccess`; no `any`; unions for state | Validate every trust boundary; `cause` on rethrow | `tsc --noEmit` + eslint + tests |
| **Hardened** | Plus `exactOptionalPropertyTypes`, `strictTypeChecked`, branded IDs, `erasableSyntaxOnly` where types are stripped | Schema library, sender checks, versioned storage migrations | One `check` script in CI, lockfile + `npm ci`, dependency review |

Start at the rung the code needs. A throwaway script does not need a schema library; a message handler in an extension always needs a validator.

---

## Conclusion

The throughline is one design philosophy: **make the compiler do the work it can, and validate the data it cannot see.** Strict config, `unknown` over `any`, unions with exhaustive switches, `readonly` by default, `satisfies` for tables, one validator at each boundary, errors that keep their `cause`, promises that are awaited and cancellable.

The counterbalance matters as much: no schema library, branded type, or dependency until the code needs one; the platform before a package; and the lint-and-typecheck gate, not review comments, enforcing the mechanical rules. TypeScript rewards incrementally increasing rigor. Start with code the compiler accepts, then tighten the types and the boundaries where a bug would actually cost something.
