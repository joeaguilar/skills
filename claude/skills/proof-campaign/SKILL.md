---
name: proof-campaign
description: Run a roadmap-bounded autonomous agent campaign where agents only close work they can prove with tests, evidence, screenshots, and full verify gates. Uses `campaign/{N}-...` artifacts, compact status, a 200k-token work-cap window, large wave execution, scout discovery, automatic review/retro, and script-rendered PO HTML reports. Trigger when the user types `/proof-campaign`, `/campaign`, `/auto-blitz`, asks to "run a proof campaign", "auto-agent-blitz the roadmap", "run a campaign from the roadmap", "autonomously clear and expand the backlog", or similar. Use when the user wants more work than `/sprint` with less ceremony and hard verification evidence. Do NOT trigger for planning only (use `/sprint` or `/roadmap`), execution only (use `/blitz`), traditional PO-gated sprint review (use `/sprint-review`), or one-off issue creation (use `itr`).
---

# /proof-campaign - roadmap-bounded proof work

Run a campaign: a roadmap-bounded autonomous work window where the planner keeps agents moving until the approved roadmap slice is proved done, split, or blocked.

This is intentionally separate from `/sprint`. `/sprint` is ceremony-heavy and sprint-sized. `/proof-campaign` is larger, quieter, roadmap-led, and agent-verifiable.

`/roadmap` owns the long-view product map. The campaign reads roadmap rows, asks what total scope should be complete, pushes back if it will exceed the campaign work cap, then executes only the approved slice.

## Invocation

```text
/proof-campaign [input] [--scope "§A.1-§A.4"] [--goal "..."] [--work-cap 200k] [--concurrency N] [--scouts 0|1|2] [--max-waves N] [--verify "..."] [--auto-next-campaign] [--roadmap-update] [--dry-run]
/campaign ...
/auto-blitz ...
```

Defaults:

- `work-cap`: `200k` work tokens — applies to the **main orchestrator agent only**. Subagents (workers, scouts, reviewer) have their own independent context budgets and will collectively far exceed 200k; that is expected and desired. The cap governs orchestrator saturation, not total project work. When the orchestrator nears cap, draft and split into another campaign.
- `concurrency`: 5 workers.
- `scouts`: 2 read-only scouts when budget allows; 1 when shell/session pressure is high.
- `verify`: auto-detect like `/blitz`.
- `roadmap-update`: off; default is an update packet, not direct `docs/ROADMAP.md` edits.
- `auto-next-campaign`: off; planner may draft the next campaign, but not execute it without this flag or explicit approval.

## Quick-Start Questionnaire (no-flag invocation)

When the user invokes `/proof-campaign` (or `/campaign`, `/auto-blitz`) with **no flags** and no inline brief, run a quick `AskUserQuestion` questionnaire to collect the key options before Phase 0. Keep it to 3-4 questions max — this is the "quick and dirty" path.

Recommended questions:

1. **Scope source** — Auto-pick next ❌/🟡 roadmap rows (recommended) / Use current `itr` backlog / Describe inline
2. **Auto-next-campaign** — Off, draft only (recommended) / On, chain into next campaign automatically
3. **Roadmap updates** — Packet only, leave `docs/ROADMAP.md` alone (recommended) / Safe direct edits to `<!-- auto -->` rows
4. **Scout intensity** — 2 scouts, full discovery (recommended) / 1 scout, light / 0 scouts, workers only

**Completing the questionnaire counts as the Phase 1 approval gate.** Do not ask for a second "yes/amend/split/abort" confirmation; proceed straight into Phase 0 preflight and Phase 2 state build using the chosen flags. Still print the compact preflight and plan summary as info, but skip the explicit approval prompt.

If the user passes any flag, an inline brief, or a scope path, **skip the questionnaire** and use the standard Phase 1 approval gate as written.

## Compact Output Contract

Use fixed-shape status lines. Put detail in artifacts.

```text
campaign C3 W4
  scope: §A.3-§A.5  work: 118k/200k
  done: 14  active: 5  queued: 9  drafted-next: 6
  gate: npm test + lint green
  risk: 1 quarantine, 2 rows likely split
  next: verify -> reprioritize -> W5
```

Shared language:

- `G` = loop goal.
- `Q` = executable queue.
- `W` = worker wave.
- `S` = scout-discovered work.
- `V` = verify gate.
- `E` = evidence.
- `R` = auto-review/retro.
- `PO` = async smoke-test owner.
- `C` = campaign.
- `cap` = work-token campaign window.

### Compression Levels

- `compact` default: short sentences, no filler, technical terms exact.
- `ultra`: status lines only unless blocked.
- `normal`: fuller prose for ambiguity, security, destructive actions, or user request.

Borrow the useful Caveman rule: **brain stays big, mouth stays small**. Compression must never remove ordering, safety, acceptance criteria, exact commands, paths, errors, scope boundaries, or proof evidence. Use normal English for irreversible actions, security, credentials, legal/compliance concerns, or ambiguous scope.

## Definition of Agent-Verified Done

Every closed item must have objective evidence. PO smoke testing is async acceptance, not the done gate.

An item is `agent-verified` only when all apply:

- Acceptance criteria are observable and mapped to evidence.
- Owned-file diff matches the ticket or bundle scope.
- Full repo verify gate exits zero after the wave.
- Targeted tests were added or updated for changed behavior when practical.
- UI-touching or user-visible/behavioral changes require **runtime evidence** — drive the actual flow end-to-end and/or capture a Playwright screenshot (use `/verify` plus the playwright plugin). A green verify gate or successful build is NOT sufficient for these: a written value is not a wired feature.
- For a "wrote a value" change, prove the **read site** consumes it — exercise the path that reads the value, not just the write.
- Runtime evidence is scoped to UI/behavioral diffs only. Pure non-UI work (refactors, backend-only logic, docs, config with no user-visible surface) is exempt — the verify gate is its done gate; don't stall it hunting for a screenshot.
- Docs/config/migrations are verified when touched.
- No known red tests, lint, type errors, missing screenshots, or untracked manual-only checks remain.
- Evidence is recorded in the loop artifact.

If any requirement cannot be satisfied, do not close as done. Mark `blocked`, `quarantined`, or `needs-human` and keep moving on unrelated work.

## Campaign Artifacts

Use a campaign namespace, not `sprint/`:

```text
campaign/
  CURRENT
  campaign-001-YYYY-MM-DD-<slug>/
    campaign.json
    queue.json
    evidence.json
    ledger.json
    notes.md
    reports/
      changelog.html
      smoke-test.html
      roadmap-update.html
      retro.html
```

State files are compact JSON. PO-facing files are rendered HTML. Use `scripts/render_campaign_report.py` instead of hand-writing HTML in context.

## Phase 0 - Intake and Roadmap Scope

Resolve input in this order:

1. Explicit path or inline brief.
2. `docs/ROADMAP.md`, repo-root `ROADMAP.md`, then roadmap artifacts under `roadmap/`.
3. Tracker backlog (`itr` default), especially `roadmap-stub,needs-sprint,product-backlog`.
4. Locked spec: `docs/REWRITE_SPEC.md`, `docs/SPEC.md`, `README.md`, then `CLAUDE.md`.
5. Existing `campaign/CURRENT`.
6. Recent conversation.

Read project conventions:

- `sprint/config.yml` if present.
- `STORY_STYLE.md` if present.
- `AGENTS.md` / `CLAUDE.md` for workflow constraints.
- Existing `sprint/*` artifacts for local style.

Read the roadmap using `/roadmap`'s contract:

- Roadmap is a bridge, not authority. Spec defines scope; `itr` defines execution state.
- Campaign scope must be expressed as roadmap rows whenever a roadmap exists.
- Prefer next ❌/🟡 rows in trajectory order; if no trajectory, dependency order and wide dependencies first.
- Campaign scope must name what will be complete in total: rows to turn ✅, rows expected to remain 🟡, and rows intentionally out of scope.
- Preserve `<!-- po:override -->` and any cell without `<!-- auto -->`; those are PO-owned.
- Treat `roadmap-stub` issues as pullable only after drafting real AC/evidence.
- Push back when requested scope exceeds the work cap; propose splits into campaign-N and campaign-N+1.
- If the campaign goal diverges from roadmap suggestion, record `ROADMAP_DIVERGENCE_NOTE`.

Preflight:

- Tracker: default `itr`; run `itr stats` and `itr agent-info` when available.
- Code graph: use `kgr` when present; otherwise grep/rg.
- Verify gate: detect like `/blitz` unless `--verify` supplied.
- Dirty worktree: inspect before assigning agents; never revert unrelated user changes.
- Token budget: default `work_cap_tokens=200000` for the **main orchestrator agent**; reserve 20% for repair, review, and reporting. Subagent context usage does not count against this cap — workers, scouts, and the reviewer each spend their own budget independently.
- Agent budget: compute `workers + scouts + reviewer <= safe concurrency`; verification outranks scouts.

Print one compact preflight:

```text
proof-campaign preflight
  G: <one-line goal>
  scope: <roadmap rows | requested input | unresolved>
  cap: 200k work tokens, 20% reserve
  roadmap: docs/ROADMAP.md | ROADMAP.md | absent; next=<row>
  tracker: itr | other | none
  graph: kgr | rg
  verify: <cmd>
  agents: <workers> workers + <scouts> scouts + 1 reviewer
  campaign: campaign-<N>-<date>-<slug>
```

If no roadmap exists, allow campaign from backlog/spec, but mark `roadmap=absent` and include a final suggestion to run `/roadmap`.

## Phase 1 - Campaign Plan and Single Gate

Planner owns the campaign plan:

- Group work into large bundles by roadmap row, file ownership, dependency, and behavior.
- Each bundle must fit one worker agent or one worker wave.
- Declare owned files when confident.
- Declare forbidden/shared files for same-wave agents.
- Split only when file conflicts or verification boundaries require it.
- Defer unrelated roadmap sections to product backlog.
- Pull from roadmap only when the section is ❌/🟡, in v1 boundary, and traceable to `G`.
- Convert `roadmap-stub` issues into executable work only after adding observable AC and evidence requirements.
- Estimate token work cost coarsely: S=10k, M=25k, L=60k, XL=120k+. Adjust using repo complexity.
- Push back if selected work cannot fit `work_cap - reserve`; split or create a next campaign draft.

Include scout policy in the plan:

- `scout-roadmap`: read-only. Finds next valuable tickets from ROADMAP/spec/gaps.
- `scout-sprint-lite`: read-only. Runs the useful parts of `/sprint` decomposition in summary form: goal fit, AC, file hints, dependencies, risk, and DoD. No PO gates.
- `scout-review`: read-only. Looks for missing tests, docs, cleanup, and follow-up bugs from completed work.

Scouts draft work; the orchestrator files approved in-scope drafts in batches. Do not let each scout run its own tracker writes.

Ask for exactly one go-ahead — **unless the quick-start questionnaire already ran**, in which case the questionnaire answers are the approval; print the plan summary as info only and proceed to Phase 2.

```text
proof-campaign plan
  G: <goal>
  scope: <roadmap rows; intended final statuses>
  cap: <estimated work tokens>/<200k orchestrator>, reserve <20%>  # subagents uncapped
  Q: <N> executable items in <M> bundles
  W: <wave count estimate>, concurrency <N>
  S: <0|1|2> scouts drafting follow-up work while workers run
  V: <verify command>
  roadmap: <rows used | divergence noted | absent>; update=<packet-only | safe-direct>
  may draft next campaign: yes
  may execute next campaign: <yes only if --auto-next-campaign>
  PO gets: rendered HTML reports, not live gates

Approve campaign? (yes / amend / split / abort)        # skip if questionnaire ran
```

After `yes`, the PO has authorized:

- Executing in-scope queue items.
- Reprioritizing, appending, and filing work that traces to approved roadmap rows, verification gaps, or explicit carryover.
- Creating draft next-campaign artifacts when scope exceeds cap or scouts find enough follow-up work.
- Automatic review, retro, campaign artifact updates, and roadmap update packet.

The go-ahead does not authorize silently rewriting `docs/ROADMAP.md` when `/roadmap` would require PO confirmation: drift, v1 boundary, trajectory, orphan, or PO-owned cells remain async PO work.

Stop for destructive actions, secrets/access, legal/security ambiguity, or scope that does not trace to the campaign.

## Phase 2 - Campaign State Build

Create `campaign.json`, `queue.json`, `evidence.json`, and `ledger.json`. See `scripts/SCHEMA.md` for the JSON contract — every field, every enum, every cross-file reference the renderer reads. Stay inside the schema; the renderer tolerates missing optional fields but extra unknown fields are silently dropped.

Queue lanes:

- `ready`: agent-verifiable, scoped, has AC/evidence plan.
- `candidate`: likely useful but needs refinement or file inference.
- `parked`: out-of-scope, human-dependent, over cap, or insufficiently verifiable.
- `next_campaign`: valid work that should not fit this campaign.

Use compact JSON records: `id`, `title`, `source`, `roadmap_rows`, `lane`, `status`, `owned_files`, `forbidden_files`, `acceptance`, `verify`, `evidence_needed`, `token_estimate`, `deps`, `risk`.

Use batch reads and one planner pass for unknown file sets. Do not spawn one planner per ticket.

## Phase 3 - Execute Waves and Reprioritize

For each wave:

1. Pick the largest conflict-free set of `ready` bundles.
2. Spawn one worker per bundle.
3. Keep scouts running only if agent/session budget allows.
4. While workers run, refine candidates, update JSON state, and decide whether to reprioritize the next wave.

Worker prompt requirements:

- Own only listed files.
- Do not use write-mode formatters that affect the whole repo.
- Run targeted checks, then full verify gate.
- Produce evidence summary with commands and last relevant output.
- Close/update tracker only after verification is green.
- Report changed files and evidence, not a long narrative.

Between waves:

- Run the full verify gate from the orchestrator.
- If green, mark wave `verified`.
- If red, assign a repair agent or repair locally when small.
- If still red, quarantine the culprit and continue only if unrelated waves remain safe.
- Update token-work estimate. If cap pressure is high, stop after current wave and draft next campaign.

## Phase 4 - Scout Loop

Run 1-2 scout agents while workers execute. Scouts are always read-only. The initial gate may authorize the orchestrator to file their in-scope drafts in batches.

### scout-roadmap

Input: goal, roadmap artifact, locked spec, open backlog, current queue.

Output: compact JSON or markdown table of candidate tickets:

- roadmap section id/title/status
- title
- source
- why now
- observable AC
- likely files
- verify/evidence plan
- priority
- risk
- linked/stub itr ids
- in-scope yes/no

Roadmap scout rules:

- Prioritize ❌/🟡 sections in v1 boundary.
- Prefer trajectory order when present; otherwise dependency order with wide dependencies first.
- Never execute v2, excluded, orphaned, or removed-section appendix rows unless the user's goal explicitly reopens them.
- Never infer completion from title-keyword matches alone. Linked `itr` or direct proof evidence is required.
- If the requested campaign cannot complete the approved rows within cap, propose the split and which rows move to `next_campaign`.

### scout-sprint-lite

Input: goal, candidate backlog, STORY_STYLE.md, current queue, sprint DoD.

Output: compact ticket drafts:

- title
- goal fit
- acceptance criteria
- likely files
- blocked-by / dependency notes
- risk
- Definition of Done additions
- agent-verifiable yes/no

### scout-review

Input: recent wave diffs, evidence matrix, verify output, docs.

Output candidate tickets for:

- missing tests/e2e/screenshot evidence
- docs that changed behavior but were not updated
- bugs/regressions observed during verification
- cleanup that blocks later work

### Bash/session budget rule

Use fewer, broader scouts. Do not spawn a scout per issue. Prefer:

- one batched scout prompt with many candidates
- one orchestrator-owned `itr batch` or small grouped `itr add` run
- one wave planner pass per wave
- one full verify run per repo between waves

If active shells/agents are constrained, pause scouts first, never verification.

## Phase 5 - Autonomous Triage

For scout output:

- `ready + in-scope + agent-verifiable`: file or add to `ready`; eligible for same loop.
- `candidate`: refine in next planning gap.
- `next_campaign`: write into a draft campaign folder; do not execute unless `--auto-next-campaign`.
- `parked`: add to PO smoke-test appendix or product backlog; do not execute.
- `needs-human`: document question in `smoke-test.md`; continue elsewhere.

Do not ask PO during the loop unless the answer changes scope, secrets, legal/security posture, or irreversible data.

## Phase 6 - Agent Review

After each verified wave, run a reviewer pass and update `evidence.json`:

- Check evidence against AC.
- Check diff for owned-file drift and accidental scope creep.
- Check `git diff --stat` against queue.
- Check screenshots/e2e artifacts exist for UI changes.
- Check tracker state matches queue state.

If reviewer finds gaps, create repair work and run it before final signoff when it affects done-ness. Non-blocking improvements become backlog candidates.

## Phase 7 - Stop Conditions

Stop launching new waves when any fire:

- In-scope queue empty.
- Work cap pressure: estimated next wave would push the **orchestrator** beyond remaining cap after reserve (subagent budgets are not counted here).
- `max_waves` reached.
- Two consecutive no-progress waves.
- Full verify gate cannot be made green.
- Foundational task blocked.
- Required user decision is missing.

Never stop with unreported active agents. Resolve or close every background worker before final output.

## Phase 8 - Render PO Reports

No interactive sprint review. No PO retro gate. Write compact state first (per `scripts/SCHEMA.md`), then render reports:

```text
python3 <skill>/scripts/render_campaign_report.py campaign/<folder>/campaign.json --out campaign/<folder>/reports
```

Stdlib-only; runs on any Python 3.8+. Add `--report changelog|smoke-test|roadmap-update|retro` to re-render just one.

The renderer creates:

- `changelog.html`: verified changes, blocked/parked work, files, commands, per-wave history.
- `smoke-test.html`: async PO checklist with interactive checkboxes (state persisted in localStorage), per-item fail-mark, and a "copy results as markdown" button.
- `roadmap-update.html`: evidence-backed roadmap row update packet.
- `retro.html`: automatic retro, friction signals, process fixes, follow-up candidates. Adaptive depth — clean run renders a single line.

Roadmap write policy:

- Default: render `roadmap-update.html`; do not rewrite `docs/ROADMAP.md`.
- Safe direct update is allowed only with `--roadmap-update` or an explicit amended approval of `update=safe-direct`, and only when every touched cell is `<!-- auto -->`, linked to closed verified work, and has no drift, v1-boundary, trajectory, orphan, or `<!-- po:override -->` ambiguity.
- If any roadmap condition would trigger `/roadmap` Gate 1 or Gate 2, record the proposed change in `roadmap-update.html` and leave `docs/ROADMAP.md` untouched.
- Dedup roadmap stubs by section token before filing. Never double-file `roadmap-stub` issues.

## Final Output

Keep final chat short:

```text
proof-campaign complete
  campaign: campaign/<folder>
  scope: <roadmap rows>
  verified: <N>
  blocked: <N>
  parked/next: <N>/<N>
  work: <used>/<cap>
  verify: green | red <reason>
  reports:
    changelog: <path>
    smoke test: <path>
    roadmap update: <path>
    retro: <path>
  PO next: run smoke-test.html async
```

## Principles

- One approval starts the autonomous campaign.
- Verification replaces live PO acceptance.
- PO reviews rendered reports async.
- Scouts expand the backlog while workers execute, but only with traceable, agent-verifiable work.
- Campaign state lives in compact JSON; HTML comes from the renderer.
- File ownership controls parallelism.
- Full verify gate controls wave advancement.
- Automatic retro happens every run, but stays small.
- Roadmap defines total campaign scope; the campaign pushes back when scope exceeds cap.
- Planner may reprioritize, append, and draft next campaigns inside the approved roadmap boundary.
- Original `/sprint`, `/blitz`, `/sprint-review` remain available for slower, higher-ceremony work.

## Don't

- Don't mutate the original sprint/blitz/review/roadmap skills for this workflow.
- Don't keep asking PO to approve every wave.
- Don't close work without objective evidence.
- Don't execute scout-discovered work that does not trace to the approved goal.
- Don't treat roadmap rows as generic TODOs; obey v1 boundary, trajectory, linked-itr, and sentinel rules.
- Don't silently rewrite `docs/ROADMAP.md` when `/roadmap --update` would require PO confirmation.
- Don't hand-write rich HTML in the main context; use the renderer script.
- Don't exceed the work cap by cramming; split into another campaign.
- Don't execute a drafted next campaign unless `--auto-next-campaign` or explicit approval says so.
- Don't spawn one agent per candidate ticket during planning.
- Don't let scouts consume capacity needed for verification or repair.
- Don't produce a giant retro transcript.
- Don't use terse output for destructive, security, credential, or ambiguous operations.
- Don't leave background agents running at final.
