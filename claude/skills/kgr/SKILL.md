---
name: kgr
description: Use kgr (polyglot code-graph CLI, 19 languages) to navigate, audit, and reason about a codebase instead of grep+read loops. Trigger this skill ANY time the user asks to find references or callers of a symbol, show or locate a definition, see signatures only, check whether code is dead or unused, learn what breaks if X changes, trace who imports a file, find cycles or orphans, rank the most complex files, audit architecture rules, or get oriented in an unfamiliar repo — even if they don't say the word "kgr". Phrases that should fire it include "where is X used", "find all callers of", "is this still used", "what breaks if I change X", "orient me in this repo", "give me a tour of this codebase", "show me the definition of X", "signatures only", "which files are the most complex", "what depends on this file", "any circular imports", "what's dead code here". Prefer kgr over grep+Read whenever a kgr subcommand fits the question.
---

# kgr — codebase navigation skill

`kgr` is a polyglot dependency + symbol graph CLI. It parses 19 languages (py, ts, js, rs, java, c, cpp, go, zig, cs, objc, swift, rb, php, scala, lua, ex, hs, sh). It answers structural questions about a codebase faster and more accurately than grep+read, because it parses real imports/definitions/call-sites instead of matching strings.

**Default rule:** if a user question maps to a kgr subcommand, run kgr *first*. Only fall back to grep/Read when kgr can't answer (e.g. matching string literals, comments, or a language kgr doesn't parse).

This skill tracks kgr v0.6.1. If a flag here is rejected, `kgr --version` and `kgr agent-info` (the CLI's own guide) are the source of truth.

## Always pass these flags when you'll parse the output

- `--format json` — structured, parseable (`-f json`)
- `--no-progress` — silences the progress bar so JSON is clean (`slice` never scans, so it has no such flag)

Skip them when *the user* will read the output and tree/table/text is friendlier. Warnings (e.g. skipped unsupported files) go to stderr, so stdout JSON stays parseable. `-l <lang>` filters to one language on every scanning command. `PATH` is always the last argument and defaults to `.`.

## Question → command mapping

Use this table to pick the right command. Don't guess — match the user's question to a row.

| User asks… | Run |
|---|---|
| "Orient me" / "tour of this repo" / "what is this codebase" | `kgr orient --format json --no-progress .` |
| "Where is `foo` used?" / "find callers of `foo`" | `kgr refs foo --format json --no-progress .` |
| "Show me the definition of `foo`" / "print `foo`'s body" | `kgr show foo .` (text; `-c 5` adds context, `-k fn\|class\|method` picks one, `--all` prints every match, `--no-linenos` for raw) |
| "Show lines 40–80 of `file`" (any file, parsed or not) | `kgr slice path/to/file:40-80` (`-c N` for ± context, `--max N` lifts the 500-line cap) |
| "Signatures only" / "API surface" of a file or dir | `kgr skeleton path/to/dir_or_file` (text is already token-minimal; `-f json` for parsing) |
| "What breaks if I change `foo`?" / blast radius | `kgr impact foo --format json --no-progress -d 3 .` (`-d` caps depth) |
| "Is `foo` dead code / safe to delete?" | `kgr dead foo --format json --no-progress .` — then read "Before deleting" below |
| "Which files are the most complex / biggest hotspots?" | `kgr hotspots --format json --no-progress -t 10 .` |
| "Who imports `path/to/file.py`?" | `kgr query --who-imports path/to/file.py --format json --no-progress .` |
| "What does `path/to/file.py` depend on?" (transitive) | `kgr query --deps-of path/to/file.py --format json --no-progress .` |
| "Is there a path from A to B?" | `kgr query --path-between A B --format json --no-progress .` |
| "Any cycles? / circular imports?" | `kgr query --cycles --format json --no-progress .` (`--largest-cycle` for the worst one) |
| "Any orphan / unreachable files?" | `kgr query --orphans --format json --no-progress .` |
| "What are the most-depended-on files?" | `kgr query --heaviest -t 20 --format json --no-progress .` |
| "Give me a table of contents / what's defined where" | `kgr symbols --format json --no-progress .` (big on a whole repo; scope PATH or `-l`) |
| "Health-check the architecture" / "any rule violations" | `kgr check --format json --no-progress --exit-zero .` |
| "Show me the whole dependency graph" (broad analysis) | `kgr graph --format json --no-progress .` |
| User wants a *visual* or human-readable tree | `kgr graph` (tree, default) or `-f mermaid` / `-f dot` |

Bare `kgr` equals `kgr graph .`. Scan-wide flags worth knowing: `--first-party` (graph/check/query: drop `vendor/`, `third_party/`, `external/` from orphan and heaviest summaries; files stay in the graph), `--no-external` / `--show-external` (third-party nodes), `-o <file>` (graph output to a file).

## Workflows

### Orienting in an unfamiliar codebase

When the user says "help me understand this repo" or you've just been dropped into one:

1. `kgr orient --format json --no-progress .` — one call: file/edge counts, languages, entry points, heaviest files, cycle and orphan counts, external packages. Entry points are files nothing imports, so tests and scripts show up there too. In a big or mixed repo, scope `PATH` to a subdirectory or add `-l <lang>`.
2. `kgr check --format json --no-progress --exit-zero .` — anything structurally broken (cycles, rule violations)? `--exit-zero` keeps the same JSON (`"ok": false` included) but exits 0, so a parallel batch doesn't cancel siblings. Prefer it to `|| true`, which also hides real failures (bad path, broken config).
3. `kgr hotspots --format json --no-progress -t 10 .` — where the complexity lives (score = function count × average function length). Test files rank high; ignore them unless asked.
4. `kgr skeleton <dir>` on the load-bearing directories (the `heaviest` files from step 1), or `kgr symbols --format json --no-progress -l <lang> .` for the full table of contents.

Run 1–3 in parallel. Then report what you found and decide next steps together.

### Replacing the grep-then-read loop for symbol lookup

Old workflow: `grep -rn "def foo"`, then `grep -rn "foo("`, then Read each match to filter false positives.

New workflow:
- `kgr refs foo --format json --no-progress .` returns `{symbol, ambiguous, definitions: [...], references: [{file, line, context, kind, callee}, ...]}` in one shot, parsed (no false positives from strings/comments).
- `kgr show foo .` prints the body straight from source (replaces `grep -n` + `sed -n`). It prints the first match plus `also: path:line (kind)` pointers; exits 1 with near-miss suggestions when the name is unknown. Printed paths are relative to the scanned `PATH`, while `kgr slice` resolves against the current directory, so prefix pointers with `PATH` when slicing.
- `kgr slice file:START-END` reads a numbered window of any file (`.toml`, `.md`, logs included) — use it instead of `sed -n 'X,Yp'`.

**Ambiguous names:** if `ambiguous` is `true`, the name has several definitions and `references` comes back **empty on purpose**. Do not read that as "unused". Pick a definition from `definitions[]` and rerun with `--defined-in <file>` (accepted by `refs` and `dead`), or disambiguate by hand.

### Before deleting a symbol or file

ALWAYS run `kgr dead <name> --format json --no-progress .` before suggesting a deletion, then branch on the fields. Do not trust `dead` alone.

- `found: false` (`dead: null`) — the name isn't in the parsed project: a typo or an unparsed language. **Never** a removable verdict.
- `ambiguous: true` (`dead: null`) — several definitions; rerun with `--defined-in <file>`.
- `dead: false` — read `cross_file_references[]`, not `references[]` (which also holds same-file hits). If `cross_file_references` is empty (`status: self_only_references`), the symbol is live only if its own-file callers are live; also confirm the containing module is actually pulled in (Rust `mod foo;`, a Python import, etc.).
- `dead: true` — a **candidate**, not proof. kgr misses aliased imports (`import {x as y}`), functions passed as values or paths without call parens (`map(util::f)`), enum variants and types used only as paths or match patterns (`Kind::A`), calls inside macros, JSX tags, decorators, and receiver calls like `p->m()`. Cross-check with `rg -w <name>` before deleting. Read `caveat` too (it flags string-literal mentions that hint at dynamic use).
- `status` strings differ between kgr builds; branch on `dead`, `found`, `ambiguous` and `cross_file_references`.
- `--defined-in` narrows to the defining file plus the files that import it, so it misses callers that need no import edge (Go same-package, Rust `crate::`/workspace-crate paths, Java/C# same-namespace) and can report `dead: true` for live code. Always sanity-check a scoped `dead: true` with an unscoped `refs`.

For files, use `kgr query --who-imports <file>`.

### Blast radius ("what breaks if I change X")

`kgr impact foo --format json --no-progress -d 3 .` returns `{symbol, found, definitions, impact: [{file, depth, calls_symbol}]}`: the transitive *importers* of the file(s) defining `foo`, with `depth` 1 = direct and `calls_symbol` marking files that actually name it. It is file-level import reachability, not a call graph: same-crate Rust callers, Go same-package callers and cross-crate Rust callers don't show up (e.g. a method with 15 call sites in 6 files reported a single dependent). Use `impact` for the affected-files shortlist and `refs` for the actual call sites; if `impact` is empty, that is not proof nothing breaks. An unknown name returns `found: false` with an `error` field (exit 0).

### Auditing architecture rules

If the repo has a `.kgr.toml` with `[[rules]]`, `kgr check` enforces them. When the user says "make sure this PR doesn't break the layering" or "check architecture":

1. `kgr check --format json --no-progress .` (exit 0 clean, 1 cycles/error-severity violations, 2 operational failure such as a bad path or broken config). Output: `{ok, cycles[], orphans[], rule_violations[], suppressed}`, plus `syntax_errors` with `--syntax` and `skipped_unsupported` when files were skipped.
2. Parse `rule_violations[]`. Each entry has `{rule, from, to, severity}` (`warn` prints but doesn't fail).
3. For each violation, optionally `kgr query --path-between <from> <to>` to show the user the exact import chain.
4. `--update-baseline` is for tolerated-during-migration violations. Don't run it without the user explicitly asking — it permanently suppresses violations.
5. The table is `[[rules]]` (plural). A misspelled `[[rule]]` is silently ignored and check reports clean — if a repo "passes" with rules you expect to fire, check the spelling.

If there's no `.kgr.toml` and the user wants rules, suggest `kgr init` to scaffold one (`--force` overwrites; never without being asked). Other `.kgr.toml` keys: `exclude` (skip globs), `languages`, `max_file_size_kb`, `format`, `first_party`, `vendor_globs`.

### Broad / open-ended analysis

For "I want to understand the structure of X" or "compare these two modules", `kgr graph --format json --no-progress .` returns the full graph (`files`, `edges`, `cycles`, `orphans`, `roots`, `test_entries`, `structural_entries`, `external_deps`, and `skipped_unsupported` when relevant). Add `--symbols` to embed each file's symbol definitions. Filter/aggregate that JSON in code rather than running many smaller queries.

For a *visual* deliverable, use `kgr graph -f mermaid` (paste into mermaid.live) or `kgr graph -f dot | dot -Tsvg > graph.svg`. Confirm with the user before uploading anything to a third-party renderer.

## Key gotchas

- **Languages parsed**: py, ts, js, rs, java, c, cpp, go, zig, cs, objc, swift, rb, php, scala, lua, ex, hs, sh. Files in other languages (Kotlin, Perl, Vue, …) are skipped with a stderr summary and a `skipped_unsupported` array in graph/check/orient JSON — graph coverage is then partial; grep those files.
- **Edge quality varies by language.** Import graphs are strong for TS/JS/Python and Rust inside one crate. Go same-package, Java/C# same-namespace and Rust cross-crate (workspace siblings count as external) yield few or no edges, so orphans, cycles, `--path-between` and `impact` are unreliable there. Lean on `refs`/`show`/`skeleton` in those stacks.
- **Symbol queries match by name**, not by fully-qualified path. If two modules define `normalize`, `refs`/`dead` flag `ambiguous` — disambiguate with `--defined-in` or `-l <lang>`.
- **External deps** (npm, pypi, etc.) don't appear in the tree by default. Use `--show-external` for tree/table, or read `external_deps` from `kgr graph --format json`. `--no-external` hides them.
- **Exit codes**: `kgr check` exits 1 on cycles or error-severity violations (used in CI) and 2 on operational failure. Don't treat exit 1 as "the tool failed" — read the JSON. **Parallel-run trap**: a `kgr check` that exits 1 can make a harness cancel sibling tool calls in the same batch. Pass `--exit-zero` when batching.
- **Scans write `.kgr-cache.json`** into the scanned root (no flag to disable it). Don't commit it; add it to `.gitignore` if the repo lacks it.
- **Don't pipe `kgr graph` tree-format into a parser**; pick `json` or `table`.
- **`kgr upgrade`** rebuilds kgr from source. Don't run it without explicit user request — it's not a per-repo operation.

### Per-ecosystem caveats

kgr already keeps these out of `orphans`/`check`: test files (`tests/`, `__tests__/`, `*_test.*`, `test_*`, `*.test.*`, `*.spec.*` → `test_entries`), Cargo targets (`build.rs`, `src/main.rs`, `src/bin/*`, `examples/`, `benches/`, `tests/` → `structural_entries` with a `reason`), and JS/TS structural files (tool and test configs, setup files, Storybook, root-level `main`/`index`/`server` entries, file-system routes, ambient `.d.ts`, scripts named in `package.json`, files an HTML `<script>` references). A `.d.ts` next to a same-base-name source is that module's type companion, not a global; treat the pair as one unit.

Still treat these as structural, not dead, when they appear in `orphans`:
- Python: `conftest.py`, `manage.py`, `wsgi.py`/`asgi.py`, standalone scripts.
- Go: `cmd/*/main.go`. Java/Kotlin: framework entry points loaded by classpath scanning.
- Shell scripts; workers loaded by string path (`new Worker(new URL(...))`); anything a framework or runner loads by convention.
- Vendored C/C++ headers dominate `--heaviest` in mixed repos. Use `--first-party`, `-l <lang>` (e.g. `-l rs`), or drop `vendor/`/`third_party/` paths from the JSON.

For Rust, treat reference counts as a lower bound: enum variants and types used only as paths or match patterns, macro bodies, derive-only types and cross-crate uses are undercounted. If a count is suspiciously low (zero or just the definition), cross-check with `rg -w <name> --glob '*.rs'` before calling it dead, and check `Cargo.toml` workspace members before calling a crate unused.

## When NOT to use kgr

- Searching string literals, comments, log messages, config values → `grep` / `Grep` tool.
- Reading a specific file you already know the path to → `Read` tool (`kgr slice` only when you want a bounded window).
- Renames/edits → kgr is read-only for source; use Edit after locating with `kgr refs`.
- Languages outside the parsed set → grep.

## Reporting back to the user

When you run kgr, tell the user the *answer*, not the command output. Cite files as `path/to/file.py:LINE` from the JSON. If the result is large (e.g. dozens of references), summarize counts and show the most relevant entries — don't dump the whole array. When a verdict rests on a caveat above (`dead: true`, an empty `impact`, a language with weak edges), say so.

## Principles

- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. kgr itself never edits source — a run leaves nothing to commit except the untracked `.kgr-cache.json`, which stays out of commits.
