# crucible — default axis catalog

Phase 0 drafts `CONTRACT.json` by picking the relevant subset of these axes and tuning each anchor to the
project. **Anchors are the reason a score means anything** — a model improvising anchors per run is how a 7
becomes "effectively an 8". Reword an anchor to fit the domain; do not delete the 3/5/8/10 rungs.

Rules for any axis, catalog or custom:

- `name` matches `^[a-z][a-z0-9_]*$`. Custom axes are welcome; anchors are mandatory.
- An axis a project cannot instrument is scored `null` and BLOCKS closure until it is measured or waived
  with cited evidence (`--waive <target>:<axis>` on the `Gate flags:` line).
- Six to eight axes is the working range. Below four, the rubric stops discriminating; above eight, critics
  spread thin and every round scores a 7.

---

## correctness

Does the code do what the behavior list says, including at the edges?

- **3** — Known-wrong on the declared behaviors; happy path only; edge cases visibly unhandled.
- **5** — Declared behaviors work; boundaries (empty, max, concurrent, malformed) are unconsidered.
- **8** — All declared behaviors hold; boundaries handled deliberately with the choice visible in the code.
- **10** — Behaviors hold under adversarial input; invariants are stated and enforced at the type or assert level.

## test_quality

Do the tests constrain behavior, or do they pass no matter what the code does?

**Unscorable without a mutation experiment** (SCHEMAS.md §5): break one behavior, run the suite, cite the
output, revert. A test that survives its own mutation is a finding, not a passing grade.

- **3** — Tests assert reachability ("it returns something"); mutation survives untouched.
- **5** — Real assertions on the happy path; mutating an edge case leaves the suite green.
- **8** — Every declared behavior has a test that FAILS when that behavior is broken; failure messages name the expectation.
- **10** — Boundaries and error paths are pinned too; the suite localizes a regression to one behavior.

## api_design

Is the interface hard to misuse?

- **3** — Callers must know internals; ordering rules and required setup are implicit.
- **5** — Workable but leaky: stringly-typed options, silent defaults, misuse compiles and runs.
- **8** — Names say what they do; invalid states are unrepresentable or rejected loudly; defaults are safe.
- **10** — The obvious call is the correct one; the type signature alone teaches correct usage.

## readability

Can the next person change this safely without archaeology?

- **3** — Intent unrecoverable without running it; names mislead; unexplained magic values.
- **5** — Followable with effort; long functions mixing levels of abstraction.
- **8** — One job per unit, names carry intent, comments explain WHY not WHAT, house style matched.
- **10** — Structure makes the domain legible; the shape of the code is an argument for its correctness.

## error_handling

What happens on the bad day?

- **3** — Errors swallowed, logged and continued, or surfaced as raw stack traces.
- **5** — Errors propagate but lose context; the caller cannot distinguish causes.
- **8** — Every failure mode is handled or explicitly propagated with context; messages name the input and the expectation.
- **10** — Failures are typed and exhaustively handled; partial failure leaves consistent state; recovery is tested.

## performance

Is the cost profile deliberate and measured?

Score `null` unless a registered instrument produced a number — an unmeasured performance score is decoration.

- **3** — Measured regression against baseline, or an obvious super-linear path on realistic input.
- **5** — No regression, no measurement; complexity unexamined.
- **8** — Measured against the contract's threshold and inside it; hot paths identified with numbers cited.
- **10** — Comfortably inside budget with headroom shown, and the tradeoff that bought it is documented.

## security

Does this widen the attack surface?

- **3** — Injection, unvalidated input crossing a trust boundary, secrets in code or logs.
- **5** — Common cases handled; authorization/ownership checks inconsistent across entry points.
- **8** — Inputs validated at the boundary, authz checked at every entry, secrets externalized, dependencies clean.
- **10** — Threat model stated for the target; misuse is tested; the least-privilege choice is the default one.

## docs_dx

Can someone use and operate this without asking the author?

- **3** — No documentation; setup discoverable only by reading source or failing.
- **5** — Public surface documented, rationale and operational behavior absent.
- **8** — Usage, contracts, and failure modes documented at the call site; a newcomer runs it from the README alone.
- **10** — Documented decisions with alternatives rejected and why; examples are executable and covered by the suite.

## ux_visual  *(optional — UI-bearing targets only)*

For pixel-level and interaction quality on a UI target. If the whole target is visual, prefer `/gauntlet` —
it carries a verified pixel instrument. This axis is for the UI slice of an otherwise non-visual target.

- **3** — Layout breaks at common viewports; state changes give no feedback; contrast fails WCAG AA.
- **5** — Correct but unconsidered: default spacing, no empty/loading/error states, keyboard path incomplete.
- **8** — Consistent spacing and type scale, all four states designed, keyboard and screen-reader paths work, AA met.
- **10** — Motion and hierarchy actively guide the eye; reduced-motion and high-contrast honored; feels deliberate at every viewport.

## operability  *(optional — services and long-running processes)*

- **3** — Failures are invisible until a user reports them; no logs worth reading.
- **5** — Logs exist; no structure, no correlation id, no health signal.
- **8** — Structured logs with correlation, health/readiness signals, key metrics emitted, runbook for known failures.
- **10** — The system explains its own degradation; alerts map to actions; rollback is one documented command.
