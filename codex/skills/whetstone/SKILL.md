---
name: whetstone
description: "Polish one artifact: critique/revise draft, spec, prompt, design, doc, or small code artifact until quality bar/pass budget."
metadata:
  short-description: Polish one artifact through revision passes
---

# Whetstone

Use this skill when the user already has one artifact and wants it made sharper.
The loop is cooperative: critique names fixable weaknesses, revision applies
them, and Codex keeps the best version rather than shipping a regression.

## Trigger Boundary

Use `whetstone` for a bounded artifact:

- a spec, plan, prompt, doc, or explanation
- a design proposal or API contract draft
- a small focused code artifact where "better" can be judged against a bar

Do not use it for normal implementation, broad refactors, adversarial challenge,
or multi-agent voting. If there is no artifact or no quality bar, frame those
first.

## Workflow

1. **Set the bar.** Define what "sharp" means for this artifact: correctness,
   clarity, completeness, testability, brevity, style, edge cases, or another
   task-specific standard.
2. **Choose a pass budget.** Default to 2-3 passes. Use at most 5 unless the user
   explicitly asks for deeper polishing.
3. **Critique the current best.** Identify concrete, located weaknesses and what
   must be preserved. If subagents are available, use an independent critic for
   high-stakes artifacts.
4. **Revise narrowly.** Apply the critique without erasing what already works.
5. **Compare against the prior best.** Keep the revision only if it improves the
   artifact against the bar. If it regresses, keep the prior best.
6. **Stop on bar met, convergence, or budget spent.** Two weak or regressive
   passes usually means the artifact has converged.
7. **Deliver the best version.** Include a short note on what changed and any
   remaining gap against the bar.

## Critique Shape

Each critique should include:

- **Improvements:** ranked, concrete fixes.
- **Keep:** what already works and must not be lost.
- **Bar check:** criteria currently met and unmet.
- **Verdict:** meets bar, close, or needs work.

## Write Mode

When polishing a file, preserve the prior best before editing. If a pass
regresses, restore the best version. Do not commit, push, or reformat unrelated
files.
