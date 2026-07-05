---
name: shadow-duel
description: "Adversarial verification: red-team claim/plan/design/fix/artifact, challengers and judge, stress-test holes."
metadata:
  short-description: Red-team an artifact before trusting it
---

# Shadow Duel

Use this skill when the user wants truth under pressure. A proposer states what
must hold, challengers try to break it with concrete counterexamples, and the
judge either accepts a revision or declares the artifact broken.

## Trigger Boundary

Use `shadow-duel` for one artifact or claim that needs adversarial scrutiny:

- a plan with hidden assumptions
- a code fix that might miss edge cases
- an architecture decision with failure modes
- a proof, explanation, or migration strategy that should survive challenge

Do not use this for routine review. Do not use it to polish prose. Do not turn it
into a debate transcript; the deliverable is the verdict and the hardened
artifact, if it survives.

## Workflow

1. **Frame the artifact.** State the exact claim, design, fix, or artifact under
   test and the bar it must clear.
2. **Run challengers.** Use 1-3 independent challenge passes. If subagents are
   available, keep them blind to each other. Each challenger must produce one
   concrete strongest strike, not a vague concern list.
3. **Judge the strikes.** Classify each strike against the bar:
   `fatal`, `wound`, `scratch`, or `miss`. Discard off-bar or unsupported attacks.
4. **Revise only as needed.** If a real strike lands and the artifact can be
   repaired, revise narrowly to answer that strike while preserving what worked.
5. **Repeat once if risk remains.** A second round is enough for most Codex use.
   Stop earlier if a full challenger round lands no meaningful strike.
6. **Deliver a verdict.** Report `holds`, `holds with caveats`, or `broken`, with
   the deepest cut, how it was answered, and remaining scars.

## Challenger Output Shape

Each challenger should return:

- **Strike:** the single strongest flaw, or `no kill`.
- **Proof:** counterexample, failing case, contradiction, or missing requirement.
- **Severity:** fatal, wound, scratch, or miss.
- **Confidence:** high, medium, or low.

## Judging Rules

- A concrete counterexample beats confident reasoning.
- A strike only matters if it violates or weakens the stated bar.
- Do not launder `broken` into `caveat`. If the claim fails as posed, say so.
- A `holds` verdict means it survived this duel, not that it is universally proven.
