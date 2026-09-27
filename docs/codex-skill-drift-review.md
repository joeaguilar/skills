# Codex skill drift review — 2026-09-04

The initial review considered the 28 Claude `SKILL.md` changes since the baselines in
`codex/PARITY.tsv` against their Codex ports. This is a semantic reconciliation,
not a request to make the trees identical. Seven existing skills receive useful
behavior changes; 21 retain their platform-specific behavior. No new skill is
ported or installed during that initial review. The subsequently authorized
implementation below adds nine ports and prunes unnecessary Codex rules.
No Claude-owned file is changed.

## Implemented follow-up

Added nine Codex skills with invocation metadata and capability registry entries:

| Port | Codex treatment |
|---|---|
| spec-writer | Grounded specifications, testable acceptance, and questions limited to material unknowns. |
| feature-build | Bounded feature delivery with verification; preserves requested coaching without repeating settled approvals or using arbitrary quality scores. |
| mission | The current core-first workflow, existing tracker or a local checklist, inherited model settings, and proof through the real entry point. |
| auto-versioning | Project-specific CI guidance and a tested, read-only stable SemVer planner. The source's generic publishing workflows were not copied; manifest and release policy require tailored integration. |
| changelog | Audience-aware notes from a verified range. The Changelog Curator agent delegates to this method through an explicit registry dependency. |
| code-audit | Bounded repository coverage and reproducible findings; no invented percentages, default issue filing, or automatic implementation. |
| security-audit | Threat and reachability analysis with evidence. The Backend Security Auditor agent uses this shared method through an explicit dependency. |
| react-review | Discover the actual framework, compiler configuration, and house standards before judging code; remove fixed stack choices and numerical style quotas. |
| unity-bridge | Preserve the installed PowerShell/file-queue protocol, distinguish timeout from cancellation, follow tests to completion, and verify editor state. |

Pruned repeated approval prompts from Blitz, Sprint, Sprint Review, and Roadmap
where existing authorization already covers the next step. Sprint now drafts
acceptance criteria itself and requires the four-label visual gate only when
the user or project requests it. Commit-message references are leads requiring
acceptance evidence, not proof that a ticket is done. Roadmap accepts grouped
filing selections instead of requiring per-row questions.

Overdrive now diagnoses flaky checks instead of treating an eventual green run
as sufficient, resolves dependency cycles from evidence instead of ticket number,
preserves unidentified temporary/lock files, and respects the harness concurrency
limit. Its worker contract permits verified file-scoped formatting. Attribution
follows repository/user policy rather than a mandatory invented Codex identity.
Fastlane routes to the newly available Mission and Feature Build methods.

The registry now describes **64 primitives: 45 skills, 17 agents, 2 commands**.
JSON and YAML entries match. Nine source baselines were added after adaptation.
The external Impeccable provider and unfinished Heroic draft are documented as
intentional repository parity exceptions. The validator's no-Ruby fallback now
accepts quoted colon-space scalars instead of falsely rejecting them.

Follow-up verification:

- Full cross-tree validation with strict staleness: **0 errors, 0 warnings**;
  Codex deep validation and registry validation pass.
- Skill Creator validation passes for the nine new skills and nine edited
  workflow entrypoints; PyYAML 6.0.2 was installed only into a temporary directory
  for validation. Registry JSON/YAML semantic equality also passes.
- Seven release-planner tests pass in disposable Git repositories, covering
  bump precedence, breaking changes, initial/tagged states, reruns, dirty-file
  preservation, reachable tags, explicit bases, prerelease restrictions, and
  shallow-history rejection. No remote or live release was used.
- JavaScript syntax checks and `git diff --check` pass.
- Browser smoke verifies the root redirect, 64/45/17/2 counts, and selection and
  Markdown rendering of the new ports. New nodes occupy additional scrollable
  rows; the existing dense layout was not redesigned.

These are canonical repository changes; global installations remain unchanged.
The Unity instructions have not been exercised against a live bridge-enabled
editor. CI guidance requires project-specific workflow validation when used;
the bundled planner tests do not establish a working release pipeline.

The updated baselines record the source versions considered in these decisions.
A retained port has a documented no-change decision below; its baseline is not
evidence that the Claude instructions were copied. Future source changes still
require a fresh review. This review covers entrypoint drift and the execution
references affected by it, not an exhaustive historical audit of every bundled
asset or script.

## Decisions that apply across the review

- **Commit behavior stays workflow-specific.** Do not spread the new blanket
  `always commit` default into navigation, reviews, planning, prompt storage, or
  shell setup. Preserve the existing Codex contracts: for example, Blitz leaves
  review/commit to the user; Overdrive and Forge Change explicitly include scoped
  orchestrator commits. User instructions and repository policy remain controlling.
- **Do not import the repeated oath prompts.** They add rhetoric and impossible
  universal promises rather than useful task instructions. Preserve concrete
  scope, verification, and evidence requirements instead.
- **Scheduling and acceptance are different states.** Human-only visual acceptance
  does not need an implementation worker, but excluding it from the queue does
  not prove completion. Keep its issue open and report the required verdict.
  Codex can inspect UI and screenshots; do not classify all visual work as human-only.
- **Use evidence to repair plans.** Normalize paths, check symbols, account for
  directories and shared contracts, and recheck ownership when scope grows.
  An obvious rename need not become a new user approval gate. Ambiguous scope or
  competing live ownership does need resolution before overlapping writes.
- **Keep task boundaries meaningful.** Do not force unrelated issue creation,
  repeated checks, a WebAssembly target, or closure of unscheduled retro actions
  merely because one Claude project adopted those practices.

## Per-skill reconciliation

| Skill | Decision | Source delta and Codex treatment |
|---|---|---|
| alignment | Retain | Only a blanket commit rule was added. The Codex interview stays conversation-focused. |
| blitz | Adapt | Add directory/doc/API contention, current-path checks, existing-work protection, run-end markers, ownership rechecks, test-target linting, scoped formatting, and pending-human scheduling. Resolve the existing contradiction that invited workers to repair neighbor files. Retain Codex's commit contract. Do not import forced pauses for every stale path, same-file section ownership, mandatory unrelated issue filing, duplicate checks, or universal wasm compilation. |
| bootstrap-project-docs | Retain | The new commit default is not a scaffold requirement. Keep the Codex document set and existing overwrite controls. |
| code-roast | Retain | Commit policy does not improve a conversational review. Keep grounded findings and the requested tone. |
| dual-blitz | Adapt | Park human-only acceptance outside both lanes and surface it at closeout. Do not add a new default combined commit or weaken lane isolation. |
| fastlane | Retain | New Claude cross-model routes depend on its harness. Its new Mission description also describes an older councils/chains design, not the current Mission source. Keep discovery of available Codex workflows and their actual commit contracts. |
| forge-change | Retain | Its existing explicit invocation already includes one scoped local commit. The source's blanket rule adds nothing. |
| gauntlet | Retain | The source adds routing to Claude's nonvisual Crucible. Keep Codex's visual goal/gate implementation; do not route to an unavailable primitive. |
| gatr | Retain | Running a gate does not independently authorize committing the work it checks. Preserve the gate/logging utility. |
| git-identity-check | Retain | Configuration audit and optional fixes do not need a generic commit rule; history rewriting remains excluded. |
| itr | Retain | Filing a ticket does not require a universal commit of a tracked database. Preserve project tracker conventions. |
| kgr | Retain | Read-only structural navigation gains nothing from commit guidance. |
| overdrive | Adapt | Exclude confirmed human-only acceptance before planning/dispatch and on every queue rebuild/resume. Handle a run with zero executable tasks, retain pending evidence, collect verdicts at smoke review, and guard epic/goal completion. Keep existing orchestrator commits. Do not adopt the source's claim that excluding these tasks resolves them. Update the worker contract so it cannot close them prematurely or repair live neighbors. |
| plr | Retain | Preserve local/profile/global storage and existing user scope; no automatic commit rule for prompt edits. |
| ponytail | Retain | Minimal-change guidance needs no new git behavior. |
| pre-mortem | Adapt | Clarify that applying guardrails produces a revised plan, never live-code or infrastructure changes. A file needs a requested output target. Drop oath/commit additions. |
| roadmap | Retain | Keep Codex's roadmap reconciliation workflow; source adds only a blanket artifact-commit policy. |
| run-the-rivers-dry | Adapt | Hand off explicitly human-only verdicts without repeated worker attempts. Preserve incomplete acceptance in the final status and any active goal; reject the source's automatic success declaration and blanket commit policy. |
| rust-best-practices | Retain | Language guidance should not acquire independent git behavior. |
| scout-strike | Retain | Keep reconnaissance-led implementation and ownership. Do not add oath prompts or broaden the default commit behavior. |
| shadow-duel | Retain | Preserve bounded adversarial verification; no oath or default commit for a verdict/artifact workflow. |
| shell-prompt | Retain | Installing a prompt is not a request to commit into a possibly separate dotfiles repository. |
| spicy-code-roast | Retain | Keep topical research and grounded review; commit decisions belong to any separately requested implementation. |
| sprint | Adapt | Surface retro actions within existing planning gates; allow reasoned retention rather than forced closure. Verify current files/symbols, shared surfaces, persistence/undo/read paths, branch scope, and first-close signoff when project policy requires it. Distinguish human-only acceptance tasks. Do not mandate one giant story for every subsystem, a question for every conditional phrase, or default artifact commits. |
| sprint-review | Adapt | Include open human-acceptance stories in Demo, record explicit verdict/carryover, close accepted stories only after other checks and the existing write gate, and keep goal-critical pending acceptance visible in epic/final state. Reuse carryover issues where possible. No new default commits. |
| story-style | Retain | Writing ticket conventions does not need the source's new commit default. |
| whats-next | Retain | Keep report-only default and explicit `--start`; starting an item follows project execution/git conventions rather than a new skill-wide commit rule. |
| whetstone | Retain | Keep cooperative revision and the best artifact; do not add oath prompts or replace the current review/commit boundary. |

## Initial translation recommendations

The following recommendations informed the implementation above. Prioritize
decision-changing guidance over generic
checklists and avoid duplicating an existing Codex agent or externally installed skill.

| Candidate | Usefulness and required adaptation |
|---|---|
| spec-writer + feature-build | Highest-priority pair: a spec-to-feature path below sprint scale. Keep testable acceptance, real file ownership, and verification. Scope interviewing to material unknowns, distinguish coached approval from already-authorized execution, and remove subjective A-grade loops/default commits unless part of the requested workflow. |
| mission | Strong candidate for direct delivery of a runnable core, then demonstrated gaps. Port the current lean source, not `old-mission-skill-ab` or Fastlane's stale description. Use Codex tools and inherited model settings; avoid rigid tracker-choice pauses when existing context suffices. Do not copy the blanket ban on other skills: required frontend/hosting/tool guidance may still apply. Preserve concrete end-to-end proof rather than councils and ledgers. |
| auto-versioning | Valuable operational payload with scripts and release templates, not just advice. Before porting, inspect/test generated workflows in scratch repositories for supported manifests, permissions, release triggers, and branch policy. Installing CI must not itself trigger an unrequested release. No live release tests were performed here. |
| changelog | Useful audience-aware release documentation, but `codex/agents/changelog-curator.md` already overlaps. Reconcile with that provider before adding a second primitive. Derive the requested range from actual history and avoid inventing migration notes or impact. |
| code-audit | Useful for whole-repository review beyond a PR diff. Bound coverage and parallelism, prove findings from files, avoid invented numerical improvement estimates, and write a report only where requested or established by project convention. |
| security-audit | Useful for system threat modeling; overlaps `backend-security-auditor.md`. Reconcile the provider, keep evidence/reachability and audit scope, and avoid boilerplate compliance conclusions or compulsory exhaustive checklists. |
| react-review | Conditional candidate, not a literal port. The current source hardcodes stack choices and numeric style/coverage limits, and assumes compiler/data-fetching behavior without checking project configuration. Retain demonstrated React correctness checks; discover the actual React/Next/compiler setup and house standards first. |
| unity-bridge | Strong for projects with the bridge package. Its PowerShell/file-queue protocol is usable from Codex; preserve actual `.claude-bridge` protocol paths and package names rather than mechanically renaming them. Verify queue timeout, deferred execution, and editor-focus behavior in a bridge-enabled project before declaring the port operational. |

Do not duplicate Impeccable merely to make this repository's trees match: it is
already available in this session from an external skills root. Do not port the
untracked Heroic draft, old Mission experiment, or Claude-specific Crossfire
harnesses as a side effect of this review.

## Initial review validation (before implementation)

- `git diff --check`: passed.
- `node --check codex/explorer/app.js`: passed.
- `node --check codex/scripts/skill-tree.js`: passed.
- `node codex/scripts/skill-tree.js validate`: passed; 55 primitives, including
  36 skills. No registry metadata or enablement changes were needed.
- All 28 baselines match their reviewed source versions and have a per-skill
  decision in this report.
- `validate-skills.sh --strict-staleness`: **3 errors, 0 staleness warnings**.
  Before this pass it reported the same 3 errors and 28 staleness warnings.
  The remaining errors are missing repository peers for the untracked `heroic`
  draft and externally installed `impeccable`, plus the Codex validator's
  no-Ruby fallback flagging the already-double-quoted description in
  `codex/agents/tdd-workflow-coach.md` because it contains a colon-space.
- `codex/scripts/validate-codex-skills.sh`: reports that same fallback YAML
  finding; its registry check passes. The shell tools run with Git Bash's
  `/usr/bin` and `/mingw64/bin` explicitly on PATH on this Windows machine.
- Skill Creator's `quick_validate.py` could not run because PyYAML is absent
  from both available Python runtimes. No dependency was installed to work
  around this. The changed skills retain their existing frontmatter.

The instruction review walked through: a human-only backlog with zero workers;
implementation plus deferred PO smoke; a dependent blocked by a human verdict;
ordinary agent-verifiable UI work; directory/new-file ownership collisions;
existing user edits; and applying a pre-mortem to a plan rather than live code.
This was a static contract review, not an independently executed agent evaluation
or a live sprint. Global installations remain unchanged.
