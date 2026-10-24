---
name: kgr
description: "Use for structural codebase questions: symbol references and callers, showing a definition, signatures only, blast radius of a change, dead code, repo orientation, most-complex files, imports, cycles, orphans, dependency paths, or architecture rules in supported languages. Do not use for literal text, comments, config values, unsupported languages, or when the exact file is already known."
---

# kgr - Codebase Navigation

`kgr` parses imports, definitions, and call sites for 19 languages: py, ts, js, rs, java, c, cpp, go, zig, cs, objc, swift, rb, php, scala, lua, ex, hs, sh. Run it first for structural codebase questions; fall back to `rg` and direct file reads for strings, comments, config values, and unsupported languages. This port tracks kgr v0.6.1; if a flag is rejected, `kgr --version` and `kgr agent-info` are the source of truth.

When parsing output, always pass:

- `--format json`
- `--no-progress` (`kgr slice` never scans, so it has no such flag)

Skip those flags only when the user will read the raw tree, table, or text output. Warnings go to stderr, so stdout JSON stays parseable. `-l <lang>` filters any scanning command to one language. `PATH` is the last argument and defaults to `.`.

## Command Map

| User asks | Run |
| --- | --- |
| Orient me, give me a tour of this repo. | `kgr orient --format json --no-progress .` |
| Where is `foo` used? Find callers/references. | `kgr refs foo --format json --no-progress .` |
| Show me the definition or body of `foo`. | `kgr show foo .` (`-c N` context, `-k fn\|class\|method`, `--all`, `--no-linenos`; `--format json` to parse) |
| Show lines 40-80 of a file (any file type). | `kgr slice path/to/file:40-80` (`-c N` for +/- context, `--max N` lifts the 500-line cap) |
| Signatures only, API surface of a file or dir. | `kgr skeleton path/to/dir_or_file` (text is already token-minimal; `-f json` to parse) |
| What breaks if I change `foo`? Blast radius. | `kgr impact foo --format json --no-progress -d 3 .` |
| Is `foo` dead code or safe to delete? | `kgr dead foo --format json --no-progress .`, then follow "Before deleting code" |
| Which files are most complex? Hotspots. | `kgr hotspots --format json --no-progress -t 10 .` |
| Who imports `path/to/file.py`? | `kgr query --who-imports path/to/file.py --format json --no-progress .` |
| What does `path/to/file.py` depend on? | `kgr query --deps-of path/to/file.py --format json --no-progress .` |
| Is there a dependency path from A to B? | `kgr query --path-between A B --format json --no-progress .` |
| Are there cycles or circular imports? | `kgr query --cycles --format json --no-progress .` (`--largest-cycle` for the worst one) |
| Are there orphan or unreachable files? | `kgr query --orphans --format json --no-progress .` |
| What files are most depended on? | `kgr query --heaviest -t 20 --format json --no-progress .` |
| What symbols are defined where? | `kgr symbols --format json --no-progress .` (large on a whole repo; scope `PATH` or use `-l`) |
| Are architecture rules violated? | `kgr check --format json --no-progress --exit-zero .` |
| Show the whole dependency graph. | `kgr graph --format json --no-progress .` |
| Produce a visual or human-readable graph. | `kgr graph`, `kgr graph -f mermaid`, or `kgr graph -f dot` |

Bare `kgr` equals `kgr graph .`. Useful scan flags: `--first-party` (graph/check/query: drop `vendor/`, `third_party/`, `external/` from orphan and heaviest summaries; files stay in the graph), `--no-external` / `--show-external`, and `-o <file>` for graph output.

## Core Workflows

### Orient in a repo

For "help me understand this repo" or first-pass orientation, run:

```bash
kgr orient --format json --no-progress .
kgr check --format json --no-progress --exit-zero .
kgr hotspots --format json --no-progress -t 10 .
```

`orient` returns file and edge counts, languages, entry points (files nothing imports, so tests and scripts appear too), heaviest files, cycle and orphan counts, and external packages. `--exit-zero` keeps the same JSON (including `"ok": false`) but exits 0, so expected cycle or rule findings do not cancel sibling commands; prefer it to `|| true`, which also hides real failures such as a bad path or broken config. Hotspot score is function count times average function length; test files rank high. Then read the heaviest files via `kgr skeleton <dir>` or `kgr symbols --format json --no-progress -l <lang> .`. In large or mixed-language repos, scope `PATH` or add `-l <lang>`.

### Replace rg-then-read for symbols

- `kgr refs <symbol> --format json --no-progress .` returns `symbol`, `ambiguous`, `definitions`, and parsed `references` with file, line, context, kind, and callee.
- `kgr show <symbol> .` prints the body straight from source. It prints the first match plus `also: path:line (kind)` pointers, and exits 1 with near-miss suggestions for an unknown name. Printed paths are relative to the scanned `PATH`, while `kgr slice` resolves against the current directory, so prefix pointers with `PATH` when slicing.
- `kgr slice file:START-END` reads a numbered window of any file, including `.toml`, `.md`, and logs.

If `ambiguous` is `true`, the name has several definitions and `references` is empty on purpose. Do not read that as unused. Pick a definition from `definitions[]` and rerun with `--defined-in <file>` (accepted by `refs` and `dead`).

### Before deleting code

Always run `kgr dead <name> --format json --no-progress .` before suggesting deletion, then branch on the fields instead of trusting `dead` alone:

- `found: false` (`dead: null`): the name is not in the parsed project (typo or unparsed language). Never a removable verdict.
- `ambiguous: true` (`dead: null`): several definitions; rerun with `--defined-in <file>`.
- `dead: false`: read `cross_file_references[]`, not `references[]` (which also holds same-file hits). If it is empty (`status: self_only_references`), the symbol is live only if its own-file callers are live; also confirm the containing module is imported by its ecosystem, such as Rust `mod` declarations or Python imports.
- `dead: true`: a candidate, not proof. kgr misses aliased imports (`import {x as y}`), functions passed as values or paths without call parens (`map(util::f)`), enum variants and types used only as paths or match patterns (`Kind::A`), calls inside macros, JSX tags, decorators, and receiver calls like `p->m()`. Cross-check with `rg -w <name>` before deleting, and read `caveat` (it flags string-literal mentions that hint at dynamic use).
- `status` strings differ between kgr builds; branch on `dead`, `found`, `ambiguous`, and `cross_file_references`.
- `--defined-in` narrows to the defining file plus its importers, so it misses callers that need no import edge (Go same-package, Rust `crate::` and workspace-crate paths, Java/C# same-namespace) and can report `dead: true` for live code. Sanity-check a scoped `dead: true` with an unscoped `refs`.

For files, use `kgr query --who-imports <file> --format json --no-progress .`.

### Blast radius

`kgr impact foo --format json --no-progress -d 3 .` returns `symbol`, `found`, `definitions`, and `impact[]` entries with `file`, `depth` (1 is direct), and `calls_symbol`. It is transitive importers of the defining file(s), not a call graph: same-crate Rust callers, Go same-package callers, and cross-crate Rust callers do not appear (a method with 15 call sites in 6 files reported a single dependent). Use `impact` for the affected-files shortlist and `refs` for actual call sites; an empty `impact` is not proof that nothing breaks. An unknown name returns `found: false` with an `error` field (exit 0).

### Audit architecture rules

If `.kgr.toml` contains `[[rules]]`, run `kgr check --format json --no-progress .` (exit 0 clean, 1 cycles or error-severity violations, 2 operational failure such as a bad path or broken config). Output is `ok`, `cycles[]`, `orphans[]`, `rule_violations[]`, `suppressed`, plus `syntax_errors` with `--syntax` and `skipped_unsupported` when files were skipped. Inspect `rule_violations[]` entries with `rule`, `from`, `to`, and `severity` (`warn` prints but does not fail). Use `kgr query --path-between <from> <to>` to explain an import chain. Do not run `--update-baseline` unless the user explicitly asks; it permanently suppresses violations during migrations.

The table name is `[[rules]]` (plural). A misspelled `[[rule]]` is silently ignored and `check` reports clean, so verify the spelling when a repo passes rules you expect to fire. To scaffold rules, `kgr init` writes `.kgr.toml` (`--force` overwrites; only when asked). Other `.kgr.toml` keys: `exclude`, `languages`, `max_file_size_kb`, `format`, `first_party`, `vendor_globs`.

### Broad or visual analysis

Use `kgr graph --format json --no-progress .` for broad structure questions; it returns `files`, `edges`, `cycles`, `roots`, `orphans`, `test_entries`, `structural_entries`, `external_deps`, and `skipped_unsupported` when relevant. Add `--symbols` to embed each file's symbol definitions. For visual output, use Mermaid or DOT. Confirm before sending graph text to a third-party renderer.

## Gotchas

- Languages outside the 19 (Kotlin, Perl, Vue, and others) are skipped with a stderr summary and a `skipped_unsupported` array in graph/check/orient JSON. Coverage is then partial; use `rg` on those files.
- Edge quality varies by language. Import graphs are strong for TS/JS/Python and Rust inside one crate. Go same-package, Java/C# same-namespace, and Rust cross-crate imports (workspace siblings count as external) yield few or no edges, so orphans, cycles, `--path-between`, and `impact` are unreliable there; lean on `refs`, `show`, and `skeleton`.
- Symbol queries match names, not fully qualified paths. If multiple modules define `normalize`, `refs` and `dead` flag `ambiguous`; use `--defined-in` or `-l <lang>`.
- External dependencies are hidden from tree output by default. Use `--show-external`, `--no-external`, or `external_deps` from graph JSON as appropriate.
- `kgr check` exits 1 for detected cycles or error-severity rule violations and 2 for operational failure. Read the JSON; do not treat exit 1 alone as a tool failure. Use `--exit-zero` when batching with other commands.
- Scans write `.kgr-cache.json` into the scanned root (and beside a single-file argument) unless `KGR_NO_CACHE=1` is set. Set it when scanning a repo you should not write into; otherwise do not commit the file, and add it to `.gitignore` if the repo lacks it.
- Do not parse default tree output. Use JSON or table output for automation.
- Do not run `kgr upgrade` without explicit user request; it rebuilds kgr from source.

### Orphan and dependency caveats

kgr already keeps these out of `orphans` and `check`: test files (`tests/`, `__tests__/`, `*_test.*`, `test_*`, `*.test.*`, `*.spec.*`, reported as `test_entries`), Cargo targets (`build.rs`, `src/main.rs`, `src/bin/*`, `examples/`, `benches/`, `tests/`, reported as `structural_entries` with a `reason`), and JS/TS structural files (tool and test configs, setup files, Storybook, root-level `main`/`index`/`server` entries, file-system routes, ambient `.d.ts`, scripts named in `package.json`, files an HTML `<script>` references). A `.d.ts` next to a same-base-name source is that module's type companion, not a global; treat the pair as one unit.

Still treat these as structural, not dead, when they appear in `orphans`:

- Python: `conftest.py`, `manage.py`, `wsgi.py`, `asgi.py`, standalone scripts.
- Go: `cmd/*/main.go`. Java and Kotlin: framework entry points loaded by classpath scanning.
- Shell scripts, workers loaded by string path (`new Worker(new URL(...))`), and anything a framework or runner loads by convention.
- C/C++ vendored headers dominate `--heaviest` in mixed repos. Use `--first-party`, `-l <lang>` (for example `-l rs`), or drop `vendor/`, `third_party/`, and `external/` paths from the JSON.

For Rust, treat reference counts as a lower bound: enum variants and types used only as paths or match patterns, macro bodies, derive-only types, and cross-crate uses are undercounted. If a count is suspiciously low (zero or just the definition), cross-check with `rg -w <name> --glob '*.rs'` before calling it dead, and check `Cargo.toml` workspace members before calling a crate unused.

## When Not to Use kgr

- String literals, comments, log messages, or config values: use `rg`.
- A specific file is already known: read that file directly (`kgr slice` only for a bounded window).
- Renames or edits: kgr does not edit source; use it to locate code, then edit through the normal Codex workflow.
- Unsupported languages: use `rg` and targeted file reads.

## Reporting

Give the answer, not the raw command output. Cite locations as `path/to/file:LINE` from JSON. For large results, summarize counts and show only the most relevant entries. When a verdict rests on a caveat above (`dead: true`, an empty `impact`, a language with weak edges), say so.
