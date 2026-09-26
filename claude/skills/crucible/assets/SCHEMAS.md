# crucible — file schemas (single source of truth)

Every tool in `assets/` reads and writes these shapes. **No tool may invent a field.** All paths are
relative to the repo root; `<dir>` is the artifact directory (default `.crucible`).

Layout inside `<dir>`:

```
<dir>/CONTRACT.json          negotiated contract — TRUTH for axes, thresholds, instruments, targets
<dir>/RUBRIC.md              GENERATED from CONTRACT.json for critic prompts — never hand-edited
<dir>/STATUS.md              route ledger + generated score tables + resume block
<dir>/manifest.json          sha256 of every copied engine file (integrity gate)
<dir>/tools/                 copied engine: gate.mjs evidence.mjs cover.mjs testreport.mjs iteration.js
<dir>/baseline/<target>.json iteration-0 evidence report (failure snapshot + metric befores)
<dir>/spec/<target>_iter<N>.json
<dir>/evidence/<target>_iter<N>.json           aggregated evidence report
<dir>/evidence/<target>_iter<N>.behaviors.json blind test-author's behavior->test map
<dir>/evidence/raw/                            instrument stdout/artifacts (junit.xml, lcov.info, ...)
<dir>/critiques/<target>_iter<N>[.<critic>].json
<dir>/PLATEAU-<target>.md    written when a target goes terminal
```

---

## 1. CONTRACT.json

```json
{
  "version": 1,
  "artifactDir": ".crucible",
  "cap": 40,
  "bar": 8,
  "codexSeat": true,
  "targets": [
    {
      "name": "parser",
      "sourceGlobs": ["src/parser/**"],
      "testGlobs": ["tests/parser/**"],
      "cap": 40,
      "bar": 8
    }
  ],
  "axes": [
    {
      "name": "correctness",
      "anchors": { "3": "...", "5": "...", "8": "...", "10": "..." }
    }
  ],
  "instruments": [
    {
      "id": "test",
      "kind": "command",
      "cmd": "npm test -- --reporter=junit --outputFile=.crucible/evidence/raw/junit.xml",
      "cwd": ".",
      "timeoutMs": 600000,
      "produces": "junit",
      "artifact": ".crucible/evidence/raw/junit.xml",
      "extract": null,
      "note": null
    }
  ],
  "hard": {
    "testInstrument": "test",
    "allowNewFailures": false,
    "coverage": { "instrument": "cov", "min": 0.7 },
    "behaviorMap": true,
    "instrumentsMustRun": true,
    "metrics": [
      { "id": "lint_errors", "instrument": "lint", "op": "<=", "threshold": 0 }
    ]
  }
}
```

Field rules:

- `axes[].name` — `^[a-z][a-z0-9_]*$`, unique. This list REPLACES gauntlet's hardcoded `AXES`.
- `axes[].anchors` — keys exactly `"3" "5" "8" "10"`, each a non-empty string.
- `targets[].name` — `^[A-Za-z0-9._-]+$`, unique. `sourceGlobs` and `testGlobs` must not intersect
  (the Spec phase's disjoint-ownership rule; `gate.mjs --validate-contract` checks literal-prefix overlap).
- `targets[].cap` / `targets[].bar` override the top-level values for that target only.
- `instruments[].kind` — `"command"` (a shell command), `"tool"` (an MCP/skill flow — Chrome, unity-bridge:
  `cmd` is null, `note` states the exact invocation and required output shape), or `"probe"` (a script
  committed into the target repo). Only `kind:"command"` and `kind:"probe"` are runnable by `evidence.mjs`;
  a `"tool"` instrument's result is written into the evidence report by the orchestrator with a cited transcript.
- `instruments[].produces` — one of `junit`, `tap`, `cargo-json`, `pytest-json`, `go-json`, `lcov`,
  `cobertura`, `coveragepy`, `raw`.
- `instruments[].extract` — how to pull a metric number from output: `null`, or
  `{ "type": "regex", "pattern": "...", "group": 1 }`, or `{ "type": "json", "path": "a.b[0].c" }`.
  Applied to the artifact when present, else to stdout.
- `hard.metrics[].op` — one of `<=`, `<`, `>=`, `>`, `==`.

## 2. spec/<target>_iter<N>.json  (Spec phase output)

```json
{
  "iteration": 3,
  "target": "parser",
  "behaviors": [
    { "id": "B1", "statement": "rejects an unterminated string literal with a caret-positioned error",
      "source": "critiques/parser_iter2.json#findings[0]" }
  ],
  "interface": [
    { "symbol": "parse(input: string): Result<Ast, ParseError>", "file": "src/parser/index.ts", "note": null }
  ],
  "ownership": { "builder": ["src/parser/**"], "testAuthor": ["tests/parser/**"] }
}
```

- `behaviors[].id` — `^B[0-9]+$`, unique within the iteration. This id is the join key for functional coverage.
- Iteration 0 (baseline) writes a spec with `behaviors: []` and no ownership fan-out.

## 3. evidence/<target>_iter<N>.behaviors.json  (blind test-author output)

```json
{
  "iteration": 3,
  "target": "parser",
  "map": [
    { "behavior": "B1", "test": "parser B1 rejects unterminated string", "file": "tests/parser/lex.test.ts" }
  ]
}
```

**Naming convention (load-bearing):** the test's own name MUST contain its behavior id as a standalone
token, matched by `\bB<N>\b`. `testreport.mjs` resolves a behavior to a PASSING test by that token first
and falls back to exact `test` name equality. A behavior whose test is missing, failing, or skipped is
NOT satisfied.

## 4. evidence/<target>_iter<N>.json  (evidence.mjs output)

```json
{
  "iteration": 3,
  "target": "parser",
  "instruments": [
    { "id": "test", "kind": "command", "ran": true, "exit": 1, "durationMs": 8123,
      "artifact": ".crucible/evidence/raw/junit.xml", "stdoutPath": ".crucible/evidence/raw/test.iter3.out",
      "error": null }
  ],
  "tests": {
    "passed": 42, "failed": 1, "skipped": 0,
    "failures": ["parser B2 handles nested groups"],
    "baselineFailures": ["legacy round-trips fixtures"],
    "newFailures": ["parser B2 handles nested groups"],
    "fixedFailures": []
  },
  "coverage": {
    "changedLines": 120, "coveredLines": 101, "ratio": 0.842, "min": 0.7, "pass": true,
    "files": [ { "path": "src/parser/lex.ts", "changed": 40, "covered": 38 } ]
  },
  "behaviors": { "declared": ["B1","B2"], "satisfied": ["B1"], "missing": ["B2"] },
  "metrics": [ { "id": "lint_errors", "value": 0, "op": "<=", "threshold": 0, "pass": true } ],
  "notes": []
}
```

`evidence.mjs` NEVER writes a `layer1` verdict field. Computing layer-1 pass/fail is `gate.mjs`'s job and
`gate.mjs` recomputes it from the parts above — the referee does not accept a self-reported verdict.

## 5. critiques/<target>_iter<N>[.<critic>].json  (critic output)

```json
{
  "iteration": 3,
  "target": "parser",
  "critic": "opus",
  "scores": { "correctness": 8, "test_quality": 7, "readability": null },
  "findings": [
    { "axis": "test_quality", "score": 7, "region": "tests/parser/lex.test.ts:40-58",
      "defect": "B1 test asserts only that an error is returned, not its position",
      "fix": "assert the caret column equals 12 for the fixture input",
      "evidence": { "instrument": "test", "cmd": "npm test -- -t 'B1'", "output": "1 passing" } }
  ],
  "mutation": {
    "behavior": "B1",
    "mutation": "removed the column field from ParseError construction in src/parser/lex.ts:88",
    "command": "npm test -- -t 'B1'",
    "output": "1 passing  <- test survived the mutation",
    "testFailed": false,
    "reverted": true
  }
}
```

Validator rules (`gate.mjs --validate`):

- `scores` must contain EXACTLY the contract axis names; each value an integer 1-10 or `null`.
- Each finding requires `axis`, `score`, `region`, `defect`, `fix`; `axis` must be a contract axis;
  `evidence` is required when the finding asserts a measured claim (`evidence.instrument` must be a
  contract instrument id).
- **If `scores.test_quality` is non-null, the `mutation` block is REQUIRED** and needs
  `behavior`, `mutation`, `command`, `output`, boolean `testFailed`, and `reverted: true`.
  A `test_quality` score with no mutation experiment is an invalid critique, not a low score.
- Panel rounds write one file per critic (`.opus`, `.opus2`, `.codex` suffixes); the merged
  median verdict is written to the unsuffixed path and is the file the gate reads.

## 6. baseline/<target>.json

The iteration-0 evidence report verbatim (section 4 shape, `iteration: 0`), plus:

```json
{ "capturedAt": "2026-08-19", "metricsBefore": [ { "id": "lint_errors", "value": 14 } ] }
```

`tests.failures` from this file is the `baselineFailures` set for every later iteration.

## 7. manifest.json

```json
{ "version": 1, "files": { "tools/gate.mjs": "<sha256 hex>", "tools/evidence.mjs": "<sha256 hex>" } }
```

`gate.mjs --verify-engine` recomputes every hash and exits 1 on any mismatch, naming the drifted file.
