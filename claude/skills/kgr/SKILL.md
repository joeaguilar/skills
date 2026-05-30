---
name: kgr
description: Use kgr (polyglot source dependency knowledge graph CLI) to navigate, audit, and reason about a codebase instead of falling back on grep+read loops. Trigger this skill ANY time the user asks to find references to a symbol, locate where something is defined, check if code is dead/unused, trace who imports a file, map dependencies, find cycles or orphans, audit architecture rules, or get oriented in an unfamiliar repo — even if they don't say the word "kgr". Phrases that should fire this skill include "where is X used", "find all callers of", "is this function still used", "what depends on this file", "show me the dependency graph", "any circular imports", "give me a tour of this codebase", "what's dead code here", and similar codebase-exploration asks. Prefer kgr over grep+Read whenever a kgr subcommand fits the question.
---

# kgr — codebase navigation skill

`kgr` is a polyglot dependency + symbol graph CLI (Python, TypeScript, JavaScript, Rust, Java, C, C++, Go). It answers structural questions about a codebase faster and more accurately than grep+read, because it parses real imports/definitions/call-sites instead of matching strings.

**Default rule:** if a user question maps to a kgr subcommand, run kgr *first*. Only fall back to grep/Read when kgr can't answer (e.g. matching string literals, comments, or a language kgr doesn't support).

## Always pass these flags when you'll parse the output

- `--format json` — structured, parseable
- `--no-progress` — silences the progress bar so JSON is clean

Skip them when *the user* will read the output and tree/table is friendlier.

## Question → command mapping

Use this table to pick the right command. Don't guess — match the user's question to a row.

| User asks… | Run |
|---|---|
| "Where is `foo` used?" / "find callers of `foo`" / "find references to `foo`" | `kgr refs foo --format json --no-progress .` |
| "Is `foo` dead code / safe to delete?" | `kgr dead foo --format json --no-progress .` |
| "Who imports `path/to/file.py`?" | `kgr query --who-imports path/to/file.py --format json --no-progress .` |
| "What does `path/to/file.py` depend on?" (transitive) | `kgr query --deps-of path/to/file.py --format json --no-progress .` |
| "Is there a path from A to B?" | `kgr query --path-between A B --format json --no-progress .` |
| "Any cycles? / circular imports?" | `kgr query --cycles --format json --no-progress .` |
| "Any orphan / unreachable files?" | `kgr query --orphans --format json --no-progress .` |
| "What are the most-depended-on files?" | `kgr query --heaviest --format json --no-progress .` |
| "Give me a table of contents / what's defined where" | `kgr symbols --format json --no-progress .` |
| "Health-check the architecture" / "any rule violations" | `kgr check --format json --no-progress .` |
| "Show me the whole dependency graph" (broad analysis) | `kgr graph --format json --no-progress .` |
| User wants a *visual* or human-readable tree | `kgr graph` (tree, default) or `-f mermaid` / `-f dot` |

## Workflows

### Orienting in an unfamiliar codebase

When the user says "help me understand this repo" or you've just been dropped into one:

1. `kgr check --format json --no-progress . || true` — is anything structurally broken (cycles, rule violations)? The `|| true` neutralizes the exit-1 that fires on cycle-detection so a parallel batch doesn't cancel siblings.
2. `kgr query --heaviest --format json --no-progress .` — the most-imported files are the load-bearing modules; read those first. In mixed-language repos add `-l <lang>` for the language you actually care about.
3. `kgr query --orphans --format json --no-progress .` — orphans are dead modules or entry points; useful to know which (see "Per-ecosystem caveats" for which orphans are structural-not-dead in your stack).
4. `kgr symbols --format json --no-progress .` — full table of contents to find concepts by name.

Run all four in parallel (with the `|| true` on step 1). Then report back to the user with what you found and decide next steps together.

### Replacing the grep-then-read loop for symbol lookup

Old workflow:
1. `grep -rn "def foo"` to find the definition
2. `grep -rn "foo("` to find call-sites
3. Read each match to filter false positives

New workflow:
- `kgr refs foo --format json --no-progress .` returns `{definitions: [...], references: [{file, line, context, kind}, ...]}` in one shot, with line context, parsed (no false positives from strings/comments).

If `references` is empty, the symbol is dead — confirm with `kgr dead foo`.

### Before deleting a symbol or file

ALWAYS run `kgr dead <name> --format json --no-progress .` before suggesting a deletion. If `dead` is `false`, list the references back to the user before proposing the change. For files, use `kgr query --who-imports <file>`.

**Critical: `dead: false` does NOT mean "in use."** kgr counts a symbol as "not dead" if it has *any* reference, including references inside its own defining file. A self-referential symbol whose containing module is never imported is still unreachable. Before trusting `dead: false`, filter the `references` array for entries whose `file` differs from the `definition.file` — if there are zero cross-file references, the symbol is functionally dead even if kgr says otherwise. Pair this with a structural check: for a Rust file, confirm that some `mod foo;` or `pub mod foo;` declaration in the parent module actually pulls it into the build; for Python, confirm an importing module exists; etc.

### Auditing architecture rules

If the repo has a `.kgr.toml` with `[[rules]]`, `kgr check` enforces them. When the user says "make sure this PR doesn't break the layering" or "check architecture":

1. `kgr check --format json --no-progress .`
2. Parse `rule_violations[]`. Each entry has `{rule, from, to, severity}`.
3. For each violation, optionally `kgr query --path-between <from> <to>` to show the user the exact import chain.
4. `--update-baseline` is for tolerated-during-migration violations. Don't run it without the user explicitly asking — it permanently suppresses violations.

If there's no `.kgr.toml` and the user wants to set up rules, suggest `kgr init` to scaffold one.

### Broad / open-ended analysis

For "I want to understand the structure of X" or "compare these two modules", `kgr graph --format json --no-progress .` returns the full graph (`files`, `edges`, `cycles`, `orphans`, `roots`, `external_deps`). Filter/aggregate that JSON in code rather than running many smaller queries.

For a *visual* deliverable, use `kgr graph -f mermaid` (paste into mermaid.live) or `kgr graph -f dot | dot -Tsvg > graph.svg`. Confirm with the user before uploading anything to a third-party renderer.

## Key gotchas

- **Languages supported**: py, ts, js, rs, java, c, cpp, go. For others (e.g. Ruby, Kotlin, Swift), kgr is silent — fall back to grep.
- **Symbol queries match by name**, not by fully-qualified path. If two modules define `normalize`, `kgr refs normalize` returns both definitions and all references; disambiguate by file path in the JSON, or filter with `-l <lang>`.
- **External deps** (npm, pypi, etc.) don't appear in the tree by default. Use `--show-external` for tree/table, or read `external_deps` from `kgr graph --format json`.
- **Hide third-party noise** with `--no-external` when you only care about first-party structure.
- **Exit codes**: `kgr check` exits 1 on errors (used in CI). Don't treat exit 1 as "the tool failed" — read the JSON. **Parallel-run trap**: if you launch `kgr check` in the same parallel batch as other kgr commands and the repo has any cycles or rule violations, the exit-1 will fire and your harness may cancel the sibling tool calls before they finish. Either run `kgr check` sequentially first, or append `|| true` to neutralize the exit code (e.g. `kgr check --format json --no-progress . || true`) when batching with `kgr query`/`kgr symbols`/etc.
- **Don't pipe `kgr graph` tree-format into a parser**; pick `json` or `table`.
- **`kgr upgrade`** rebuilds kgr from source. Don't run it without explicit user request — it's not a per-repo operation.

### Per-ecosystem caveats

These come up constantly and will mislead you if you don't account for them. The single biggest failure mode is misclassifying *structural* orphans (config files, framework entry points, build scripts) as dead code — every ecosystem has its own set, and kgr can't model any of them.

- **Vendored C/C++ headers dominate `--heaviest` in mixed-language repos.** A repo with a vendored library (LibRaw, OpenSSL, etc.) will show its internal `.h` files at the top with dozens of dependents — those numbers are real `#include` counts but tell you nothing about *project* structure. Always re-run with a language filter for the language you actually care about, e.g. `kgr query --heaviest -l rs --format json --no-progress .`, or pre-filter the JSON to drop `vendor/`, `third_party/`, `external/` paths.

- **Rust / Cargo structural orphans.** kgr doesn't model Cargo's build graph, so the following almost always show up in `--orphans` and are NOT dead code — ignore them when reporting:
  - `**/build.rs` (build scripts; Cargo invokes them)
  - `**/src/bin/*.rs` and `**/src/main.rs` (bin targets)
  - `**/examples/*.rs`, `**/benches/*.rs`, `**/tests/*.rs` (Cargo-managed entry points)
  - Vendored sources under `vendor/`, `third_party/`, etc.

- **JS/TS structural orphans.** kgr doesn't know about Vite, Vitest, Jest, ESLint, Storybook, Next.js, etc. The following are normally orphans in `--orphans` output and are NOT dead — ignore them when reporting:
  - **Build/dev tool configs**: `vite.config.{ts,js,mjs}`, `vite.config.d.ts`, `webpack.config.*`, `rollup.config.*`, `next.config.*`, `astro.config.*`, `svelte.config.*`, `tailwind.config.*`, `postcss.config.*`, `babel.config.*`, `tsup.config.*`
  - **Test configs and setup files**: `vitest.config.*`, `jest.config.*`, `playwright.config.*`, `cypress.config.*`, plus the setup files those configs reference (e.g. `src/setupTests.ts`, `vitest.setup.ts`, `jest.setup.ts`)
  - **Lint/format configs**: `eslint.config.{js,mjs,cjs}`, `.eslintrc.*`, `prettier.config.*`
  - **Ambient type files** — but only `.d.ts` files that declare *globals*, not per-module declarations:
    - By name: `vite-env.d.ts`, `global.d.ts`, `globals.d.ts`, `env.d.ts`, `*.global.d.ts`, anything in a top-level `types/` or `@types/` directory
    - Or by contents: the file uses `declare global { ... }` or has a top-level `declare module '<bare-specifier>'` augmentation
    
    A `.d.ts` that sits next to a same-base-name source file (e.g. `foo.d.ts` alongside `foo.ts` or `foo.js`) is the *type companion* for that module — NOT structural. Keep it in the candidate-orphans list and treat it as one unit with its source file.
  - **Test files**: `**/*.{test,spec}.{ts,tsx,js,jsx}` — discovered by the test runner's glob, not imported
  - **Storybook**: `**/*.stories.{ts,tsx,js,jsx}` and `.storybook/*.{ts,js}`
  - **Framework file-system routes**: Next.js `pages/**`, `app/**` (`page.tsx`, `layout.tsx`, `route.ts`); Remix `app/routes/**`; SvelteKit `src/routes/**`; Astro `src/pages/**` — the framework loads these by convention
  - **Worker / service-worker files** loaded by string path (e.g. `new Worker(new URL('./worker.ts', import.meta.url))`) — kgr doesn't trace `new URL(...)` constructions
  - **`scripts/**/*.{js,cjs,mjs,ts,sh}`** invoked via `package.json`'s `scripts` block, plus top-level standalone scripts (`debug.js`, anything else launched directly with `node`)
  - **HTML entry points**: Vite's real entry is `index.html` referencing `src/main.tsx` via a `<script>` tag — kgr won't follow that, so `src/main.tsx` (or `src/index.tsx`) may show as an orphan
  
  When you see one of these in the orphans list, drop it from the "real orphans" set silently. Only files OUTSIDE these patterns are worth investigating.

- **Other ecosystems**: Python — pytest test files (`test_*.py`, `*_test.py`), `conftest.py`, Django `manage.py`, app `wsgi.py`/`asgi.py`. Go — `cmd/*/main.go` bin targets, `*_test.go`. Java/Kotlin — `*Test.{java,kt}`, framework entry points loaded by classpath scanning. Same logic: kgr doesn't model the runner/framework, so its orphans list will include them.

- **Rust dependency counts look artificially low.** Within-crate `mod foo;` usage and re-exports often don't surface as cross-file edges the way C/C++ `#include` does, so first-party `.rs` files in a workspace frequently show 0–3 dependents even when heavily used. Don't conclude "nothing depends on this" from a low number on a Rust file — confirm with `kgr refs <symbol-from-the-file>` before claiming dead code. (TS/JS/Python don't have this problem — file-level imports are traced cleanly.)

- **A whole crate's `lib.rs` showing as orphan** can mean (a) the crate is genuinely unused in the workspace, or (b) it's only consumed via `pub use` re-exports kgr didn't trace. Check `Cargo.toml` workspace members and `kgr query --who-imports <crate>/src/lib.rs` before recommending removal.

- **kgr's Rust grammar undercounts enum variants used in match-arm patterns.** A reference like `Foo::Bar(x) => ...` inside a `match` is parsed as a pattern, not as a call/use, and frequently doesn't show up in `kgr refs Foo` or `kgr refs Bar`. Practical rule: for Rust enum types and variants, treat the kgr reference count as a *lower bound*. If the count looks suspiciously low (especially zero or only the defining line), cross-check with `grep -rn '\bFoo\b' --include='*.rs'` before concluding it's dead. The same caution applies to traits used only in `impl`/`where` bounds, and to types used only in derive macros.

## When NOT to use kgr

- Searching string literals, comments, log messages, config values → `grep` / `Grep` tool.
- Reading a specific file you already know the path to → `Read` tool.
- Renames/edits → kgr is read-only; use Edit after locating with `kgr refs`.
- Languages outside the supported set → grep.

## Reporting back to the user

When you run kgr, tell the user the *answer*, not the command output. Cite files as `path/to/file.py:LINE` from the JSON. If the result is large (e.g. dozens of references), summarize counts and show the most relevant entries — don't dump the whole array.
