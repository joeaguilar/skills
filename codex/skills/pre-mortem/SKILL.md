---
name: pre-mortem
description: "Pre-mortem: assume plan failed, rank failure modes, launch/migration/rollout risks, guardrails; not ordinary planning."
metadata:
  short-description: Rank failure modes before committing
---

# Pre-Mortem

Use this skill before a risky commitment. The core move is inversion: assume the
plan failed, then work backward to identify how it died, what early signal would
have warned us, and what guardrail would have prevented or caught it.

## Trigger Boundary

Use `pre-mortem` for plans with meaningful downside:

- migrations, launches, rollouts, and operational changes
- architecture bets or large refactors
- multi-team or dependency-heavy delivery
- UX or adoption-sensitive product changes

Do not use it for normal implementation planning. Do not ask whether the plan
will succeed; assume it failed and inspect why.

## Workflow

1. **State the failed plan.** Restate the plan in one paragraph, then declare the
   failure scenario: the plan was attempted and failed.
2. **Pick failure axes.** Choose 3-6 axes that fit the plan. Common axes:
   technical, dependency/integration, scope/complexity, rollout/operations,
   adoption/UX, security/privacy, timeline/business window.
3. **Investigate each axis.** If subagents are available, assign one axis per
   agent. Otherwise run separate passes. Keep each axis focused on its own way
   the plan died.
4. **Rank the modes.** Deduplicate overlapping failures and rank by likelihood
   multiplied by impact. Cross-axis agreement should raise priority.
5. **Derive guardrails.** For each important failure mode, name an early-warning
   signal and a specific guardrail: test, milestone, rollback plan, design change,
   monitoring, owner, decision gate, or scope reduction.
6. **Harden when asked.** If the user asked to apply the pre-mortem, revise the
   plan with the guardrails. Otherwise deliver the ranked risk list.

## Failure Mode Shape

For each mode, capture:

- **Failure mode:** a concrete scenario, not a generic risk.
- **Axis:** where it belongs.
- **Likelihood:** high, medium, or low.
- **Impact:** fatal, severe, moderate, or contained.
- **Early signal:** what would show up before the failure is irreversible.
- **Guardrail:** the prevention or detection mechanism.

## Stop Rules

- If a fatal mode has no viable guardrail, say the plan is not sound as posed.
- If the axes return only generic risks, rerun the framing with sharper axes.
- Do not bury the highest-ranked risks under a long undifferentiated list.
