---
name: kgr
description: "Source graph with kgr: refs, callers, definitions, imports, dead code, cycles, orphans, dependency paths, architecture checks."
---

# kgr - Codebase Navigation

`kgr` parses imports, definitions, and call sites for Python, TypeScript, JavaScript, Rust, Java, C, C++, and Go. Run it first for structural codebase questions; fall back to `rg` and direct file reads for strings, comments, config values, and unsupported languages.

When parsing output, always pass:

- `--format json`
- `--no-progress`

Skip those flags only when the user will read the raw tree or table output.

## Command Map

| User asks | Run |
| --- | --- |
| Where is `foo` used? Find callers/references. | `kgr refs foo --format json --no-progress .` |
| Is `foo` dead code or safe to delete? | `kgr dead foo --format json --no-progress .` |
| Who imports `path/to/file.py`? | `kgr query --who-imports path/to/file.py --format json --no-progress .` |
| What does `path/to/file.py` depend on? | `kgr query --deps-of path/to/file.py --format json --no-progress .` |
| Is there a dependency path from A to B? | `kgr query --path-between A B --format json --no-progress .` |
| Are there cycles or circular imports? | `kgr query --cycles --format json --no-progress .` |
| Are there orphan or unreachable files? | `kgr query --orphans --format json --no-progress .` |
| What files are most depended on? | `kgr query --heaviest --format json --no-progress .` |
| What symbols are defined where? | `kgr symbols --format json --no-progress .` |
| Are architecture rules violated? | `kgr check --format json --no-progress .` |
| Show the whole dependency graph. | `kgr graph --format json --no-progress .` |
| Produce a visual or human-readable graph. | `kgr graph`, `kgr graph -f mermaid`, or `kgr graph -f dot` |

## Core Workflows

### Orient in a repo

For "help me understand this repo" or first-pass orientation, run:

```bash
kgr check --format json --no-progress . || true
kgr query --heaviest --format json --no-progress .
kgr query --orphans --format json --no-progress .
kgr symbols --format json --no-progress .
```

Run them in parallel when practical; keep `|| true` on `kgr check` so expected cycle or rule failures do not cancel sibling commands. In mixed-language repos, add `-l <lang>` when only one ecosystem matters.

### Replace rg-then-read for symbols

Use `kgr refs <symbol> --format json --no-progress .` to get definitions plus parsed references with file, line, context, and kind. If no references appear, confirm with `kgr dead <symbol> --format json --no-progress .`.

### Before deleting code

Always check reachability before suggesting deletion:

- Symbols: `kgr dead <name> --format json --no-progress .`
- Files: `kgr query --who-imports <file> --format json --no-progress .`

Treat `dead: false` carefully. A self-reference inside the defining file can make a symbol look alive. Filter references whose `file` differs from the definition file; if none exist, also confirm the containing module is imported by its ecosystem, such as Rust `mod` declarations or Python imports.

### Audit architecture rules

If `.kgr.toml` contains `[[rules]]`, use `kgr check --format json --no-progress .` and inspect `rule_violations[]` entries with `rule`, `from`, `to`, and `severity`. Use `kgr query --path-between <from> <to>` to explain an import chain. Do not run `--update-baseline` unless the user explicitly asks; it permanently suppresses violations during migrations.

### Broad or visual analysis

Use `kgr graph --format json --no-progress .` for broad structure questions; it returns `files`, `edges`, `cycles`, `orphans`, `roots`, and `external_deps`. For visual output, use Mermaid or DOT. Confirm before sending graph text to a third-party renderer.

## Gotchas

- Symbol queries match names, not fully qualified paths. If multiple modules define `normalize`, filter by file path or use `-l <lang>`.
- External dependencies are hidden from tree output by default. Use `--show-external`, `--no-external`, or `external_deps` from graph JSON as appropriate.
- `kgr check` exits 1 for detected cycles or rule violations. Read the JSON; do not treat that alone as a tool failure.
- Do not parse default tree output. Use JSON or table output for automation.
- Do not run `kgr upgrade` without explicit user request; it rebuilds kgr from source.

### Orphan and dependency caveats

- C/C++ vendored headers can dominate `--heaviest`. Filter `vendor/`, `third_party/`, and `external/`, or rerun with a language filter.
- Rust structural orphans commonly include `build.rs`, `src/main.rs`, `src/bin/*.rs`, `examples/`, `benches/`, `tests/`, and vendored sources. Rust dependency counts can be low because `mod` and re-export edges may be undercounted; confirm with symbol refs before calling code dead. If `lib.rs` appears orphaned, check workspace membership and who imports it.
- Rust enum variants in match patterns, traits in bounds, and derive-only type usage may be undercounted. If counts look suspiciously low, cross-check with `rg '\bName\b'` in Rust files before concluding dead code.
- JS/TS structural orphans commonly include Vite/Webpack/Rollup/Next/Astro/Svelte/Tailwind/PostCSS/Babel/Tsup configs, Vitest/Jest/Playwright/Cypress configs and setup files, ESLint/Prettier configs, global ambient `.d.ts` files, tests, Storybook stories, file-system routes, workers loaded by string path, scripts run from `package.json`, and HTML entry points such as Vite `index.html`.
- A `.d.ts` next to a same-base-name source file is a module type companion, not a structural global; treat it with that source file.
- Python structural orphans commonly include pytest tests, `conftest.py`, Django `manage.py`, `wsgi.py`, and `asgi.py`.
- Go structural orphans commonly include `cmd/*/main.go` and `*_test.go`; Java and Kotlin commonly include test files and framework entry points loaded by classpath scanning.

## When Not to Use kgr

- String literals, comments, log messages, or config values: use `rg`.
- A specific file is already known: read that file directly.
- Renames or edits: kgr is read-only; use it to locate code, then edit through the normal Codex workflow.
- Unsupported languages: use `rg` and targeted file reads.

## Reporting

Give the answer, not the raw command output. Cite locations as `path/to/file:LINE` from JSON. For large results, summarize counts and show only the most relevant entries.
