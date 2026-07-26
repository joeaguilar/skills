# Chain 1: wordfreq CLI

**Ordering-claim:** core counting logic must exist before CLI wiring; CLI wiring must exist before
end-to-end tests can verify it.

**Value-claim:** a single-file stdlib-only CLI that prints top-N word frequencies is independently
shippable and satisfies the full ask (no further chains needed).

**Assumptions:**
- A1 (assumed-by-default): "words" = maximal runs of alphanumeric/underscore chars (regex `\w+`),
  punctuation stripped, case folded to lowercase. Numbers count as words.
- A2 (assumed-by-default): ties broken by count desc, then word ascending (lexicographic on the
  lowercased word).
- A3 (assumed-by-default): `--top N` with N <= 0 or non-integer is a usage error (argparse handles
  non-integer; N<=0 needs explicit validation). Missing/unreadable file -> clear stderr message,
  exit code 1, no traceback.

**Kill criteria:** none fired expected (scope is small/complete); if unittest need exceeds trivial
effort or CLI oracle fails after 2 rework cycles, council.

**Budget alloc:** entire mission budget (single chain).
