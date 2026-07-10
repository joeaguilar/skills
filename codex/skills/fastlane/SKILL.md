---
name: fastlane
description: "Use when the user asks which multi-agent workflow to choose, invokes $fastlane, or wants to optimize execution speed while controlling safety, scope, drift, and verification. Route to an available workflow only; do not execute that workflow until its own invocation and safety contract are satisfied."
---

# Fastlane

Fastlane is a routing skill. It inspects the request and project, then chooses
the safest fast multi-agent workflow to run. It does not replace or implicitly
launch the selected workflow. After choosing, hand back an explicit `$skill`
invocation and let that skill enforce its own safety contract.

Treat repeated candidate names as one candidate. If multiple variants of a
candidate exist, prefer the platform-native Codex skill, then installed local
skills, then user-provided skill text.

## Candidate Set

Consider only workflows discovered in the current environment. The scanner may
find compatibility-installed skills outside the canonical Codex tree; label
those as compatibility providers rather than assuming they are portable.

- `$proof-campaign` (when installed): roadmap-bounded, evidence-first campaign with async PO
  reports and strong drift control. Best for broad roadmap slices, product
  proof, and work where objective evidence matters more than raw velocity.
- `$blitz`: execution-only backlog clearance with conflict-free waves and
  two approval gates. Best for a prepared backlog or sprint where tasks already
  have bounded file ownership and the user wants speed without commits.
- `$dual-blitz`: two isolated main-agent lanes, each running an inner blitz.
  Best when a large backlog splits cleanly into two disjoint subsystems. Do not
  use when lanes might share files, lockfiles, generated output, schemas,
  migrations, route tables, or API contracts.
- `$overdrive`: autonomous plan, execute, and review loop with per-wave commits
  and rollback points. Best when the user wants end-to-end sprint clearance,
  accepts orchestrator commits and a clean or explicitly isolated worktree, and can provide visual smoke verdicts
  or use `--auto` with a real time/wave cap.
- `$run-the-rivers-dry`: maximum-autonomy completion mode for hard, broad, or
  ambiguous problems. Best when the user asks Codex to go all-in and persist
  until proven complete. Use `--mortal` when the user wants normal prose.

You may also recommend another available workflow when it is clearly safer:
`$sprint` for planning only, `$roadmap` for missing roadmap alignment,
`$sprint-review` for review only, `$pre-mortem` for risky plans, or
`$alignment` when human-agent expectations are unclear.

## Preflight

1. Read local instructions first: `AGENTS.md`, `CODEX.md`, scoped docs, and any
   current sprint/campaign artifacts that define workflow rules.
2. Run the read-only scanner when shell access is available:

   ```bash
   codex/skills/fastlane/scripts/fastlane-scan.sh .
   ```

   If the skill is installed elsewhere, run the script from that skill folder.
   The scanner is a signal source, not an authority.
3. Identify user intent:
   - execution-only backlog clearance
   - plan plus execute plus review
   - roadmap-bounded campaign
   - two-session split
   - one hard end-to-end problem
   - planning/review only
4. Identify constraints:
   - desired autonomy level and approval gates
   - time or wave budget
   - security/compliance/secrets risk
   - tolerance for git commits and auditable revert commits
   - visual smoke-test availability
   - whether scope must stay inside roadmap rows, sprint stories, or tracker IDs
5. Inspect project safety:
   - git repo, clean tree, branch state, baseline commits
   - tracker availability and open backlog size
   - verify gate availability
   - `kgr`/code graph availability
   - roadmap/sprint/campaign state and stale artifacts
   - shared files: lockfiles, package manifests, migrations, schemas, generated
     output, route tables, build config, CI config

If no verify gate is detectable and the user has not supplied one, do not start
high-concurrency execution. Recommend a planning/scouting workflow or ask for a
verify command.

## Decision Rubric

Score candidates with these factors. Prefer the highest-scoring safe option, not
the most autonomous option.

| Factor | Prefer | Penalize |
|---|---|---|
| Speed | Prepared backlog, clear file ownership, green verify gate, `kgr`, clean tree, independent tasks | unclear files, no gate, frequent shared files, many unknown dependencies |
| Security | explicit scope, no secrets, read-only scout phase, human gates around sensitive actions | credentials, production data, auth/payment/security changes without constraints |
| Project safety | clean git baseline, rollback plan, isolated ownership, full verify gate | dirty tree, generated files, migrations, lockfiles, cross-lane dependencies |
| Scope creep | roadmap rows, sprint stories, tracker IDs, acceptance criteria, non-goals | broad brief, no stop condition, scout-discovered work not tied to goal |
| Drift | current roadmap/backlog, valid `sprint/CURRENT`, evidence-backed updates | stale tracker, stale roadmap, invalid CURRENT files, long-running branch drift |
| Autonomy fit | user asks to proceed hands-off and accepts the workflow's gates | user wants coached approval, no commits, no stashing, or step-by-step control |

Safety overrides speed. Security, destructive operations, credentials, legal
ambiguity, or unclear production impact require a narrower workflow or explicit
user approval before execution.

## Workflow Selection

Use this default routing after applying the rubric:

- Choose `$proof-campaign` only when a Codex-compatible provider is installed and roadmap scope, evidence, reports, and drift
  control dominate. Use it for broad work where the output should be a campaign
  artifact with proof and async PO review.
- Choose `$blitz` when a sprint/backlog already exists and the user wants
  execution waves, not planning or review. It is the safest fast default for
  bounded open tickets.
- Choose `$dual-blitz` only when two isolated lanes are obvious. If file
  ownership is uncertain, lanes are imbalanced, or shared artifacts exist, park
  the split and use `$blitz` or an available evidence-first workflow.
- Choose `$overdrive` when the user wants autonomous plan-execute-review and the
  repo can support commits, auditable reverts, tracker updates, and visual smoke gates.
  Avoid it when a dirty tree cannot be isolated safely or when the user does not
  want orchestrator commits.
- Choose `$run-the-rivers-dry` when the problem is not primarily a prepared
  backlog or roadmap slice, and the user wants maximum persistence on one broad
  goal. Add `--mortal` unless the user explicitly wants the chronicle style.

## Output Contract

Print a compact recommendation before handing off:

```text
🏁🏎️🔥 fastlane recommendation
  pick: ⚡ $<workflow> <suggested flags>
  confidence: 🟢 high | 🟡 medium | 🔴 low
  reason: <one sentence>
  speed: ⚡ <why this is fast enough>
  safety: 🛡️ <key guardrail>
  scope: 🎯 <approved boundary>
  drift: 🧭 <roadmap/backlog/git risk>
  avoid: 🚧 <workflow> because <specific risk>
  next: ▶ explicitly invoke $<workflow> and follow its gates
```

Use the same visual language in scanner output and chat recommendations:
`🟢` means safe/high confidence, `🟡` means caution/medium confidence, and
`🔴` means blocked/low confidence. Use `🧪` for verify gates, `🧠` for code
graph signals, `🛡️` for risk, `🏁` for scores, and `⚡` for the final pick.

If confidence is low, ask one concise question or recommend a dry run. Do not
launch multiple orchestration workflows against the same backlog or sprint.

## Handoff

After the user explicitly invokes or approves the selected `$skill`, load and follow it. Do not blend
procedures across workflows unless the selected skill explicitly composes them.

Pass through the relevant constraints:

- selected scope or tracker query
- verify gate
- concurrency/time/wave cap
- roadmap update policy
- dirty-tree or git constraints
- security caveats
- normal prose preference for `$run-the-rivers-dry --mortal`

## Don't

- Do not pick `$dual-blitz` for balanced-looking lanes that share files.
- Do not pick `$overdrive` just because it is powerful; it has git and smoke-test
  assumptions that must fit the project.
- Do not start high-concurrency execution without a verify gate.
- Do not let scout-discovered work expand the approved scope silently.
- Do not ignore dirty user work, stale sprint pointers, or platform-specific
  skill availability.
