# Adversarial review and red checks

The how-to behind two always-on rules in `~/.claude/CLAUDE.md`: **Adversarial
review** and **Tests prove themselves**. The config primitive links this file to
`~/.claude/ADVERSARIAL-REVIEW-AND-RED-CHECKS.md`. Open it when one of those
rules fires, not before.

Both rules exist for the same reason: a builder checking its own work finds what
it expected to find. A review in the builder's context agrees with the builder's
reasoning, and a test written by reading the implementation asserts what the code
does, not what it should do. Each rule moves the check somewhere the builder's
assumptions can't reach.

The two checks catch different failures. A red check proves a test is tied to the
behavior; it cannot tell you whether that behavior is correct. The reviewer judges
correctness against the acceptance criteria. Run both.

## When they apply

To **behavior changes**: code whose result a user, a caller or a test can observe.
Not to docs, comments, pure renames, formatting, or moving code without changing it.

Skip the reviewer, but keep the red check, for a change you can state in one
sentence that adds no branch: a constant, a string, a one-token fix.

When a skill carries its own stricter version (crucible's mutation-backed
`test_quality`, crossfire-blitz's cross-model review, forge-change's duel), the
skill's version governs. When the user says something already works, the
**Trust stated verification** rule governs: don't rerun it to check them.

## Adversarial review

### The seat

- A **fresh agent**: it never saw the builder's plan, reasoning or self-assessment.
  Those anchor it to the builder's view.
- On the **`reviewer` role** from `~/.claude/MODELS.md`, so a different model than
  the builder. A Claude reviewer goes through the Agent tool's `model` parameter;
  a GPT reviewer goes through `codex-seat`.
- **Read-only.** It reports; the builder repairs.
- Give the agent a description that starts with `review:` (for example
  `review: retry backoff`), so session metrics can count it.

### The brief

Give it the diff (pasted, or the base SHA and paths), the acceptance criteria as
text, and the gate command. Nothing else. Don't tell it what you expect it to find.

```
Try to break this change. Acceptance criteria:
<criteria, verbatim>

Diff: <diff, or "git diff <base-sha> -- <paths>">
Gate: <command>

Find inputs, states or call sequences where the change gives a wrong result,
crashes, loses data, regresses existing behavior, or misses a criterion. For each:
file:line · severity · the concrete failing input or counterexample · the fix.
Severity: blocker (a criterion unmet, or a wrong result, crash or data loss on a
reachable input), major (wrong on an edge case the criteria cover, or a regression
elsewhere), minor (wrong on an unlikely input, or a missing error path).
No style comments and no praise. If nothing breaks, say "no findings".
```

### Judging the findings

- A finding counts only with a **concrete failing input, counterexample, or quoted
  line plus the criterion it breaks**. Vague worries, style, and "consider X" are
  discarded; say which ones you discarded.
- Reproduce a finding by writing it as a test. If the test fails on the current
  code, the finding is real, and that test stays: it was red-checked by construction.
- Repair **blockers and majors**, narrowly. Fix minors when the fix is small and in
  scope. Rerun the gate after any repair.
- Review again only when a blocker landed or the repair touched a new boundary.
  **Cap: 3 review rounds.** Then stop and hand the user the remaining findings.
- Never downgrade an unanswered blocker to a caveat.

## Red checks: tests prove themselves

A test counts as evidence only after you have seen it fail for the right reason.
A red from a compile error, a missing import or a crashing fixture is not a red:
the **assertion** has to fail.

Record every red run as `gatr run --tag red-<name> -- <test command>`. It exits
non-zero by design, and that non-zero exit is the evidence. Then run the green
check under its normal tag. Session metrics count the `red-` tags.

### Form A: red before green

For new behavior and bug fixes.

- **Test first** (preferred): write the test, run it, see it fail on the assertion,
  then implement and see it pass.
- **Test written after the change:** take the source change out without touching
  the test, run the test, and put the change back:
  ```sh
  git diff -- <source paths> > "$SCRATCH/src.patch"   # $SCRATCH: a temp dir outside the repo
  git apply -R "$SCRATCH/src.patch"
  gatr run --tag red-<name> -- <test command>          # expect the assertion to fail
  git apply "$SCRATCH/src.patch"
  git diff --stat                                      # confirm the change is back, whole
  ```
  Don't use `git stash`: it takes the test with it and can sweep up unrelated work.
- **Bug fix:** the test has to reproduce the bug on the unfixed code. A test that
  passes before the fix doesn't cover the bug.

### Form B: mutation

For checking that the tests on changed code actually constrain it.

1. Pick 1–3 changed lines whose behavior the acceptance criteria name.
2. Break one: flip a comparison, negate a condition, return a constant or an empty
   value, delete a call, shift a boundary by one.
3. Run the tests that cover it as `gatr run --tag red-<name>`. At least one must fail.
4. Restore the line and confirm `git diff` shows only the intended change.
5. A mutation that no test catches is a test gap: add or tighten a test, then break
   the line again to show the new test catches it.

Never mutate a test file. Never leave a mutation in the tree, and never commit one.

Hand mutation is enough for one change. When the question is the quality of a whole
module's tests, use a mutation tool scoped to the changed files (whole-repo runs take
hours): `cargo-mutants` for Rust (`--in-diff <diff file>`), Stryker for JS/TS
(`--mutate <glob>`), `mutmut` for Python.
