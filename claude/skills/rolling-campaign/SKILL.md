---
name: rolling-campaign
description: "Chain roadmap-bounded proof campaigns back-to-back, each leg in a fresh cleared context via an external headless driver (`scripts/chain.sh`); every leg proves its work, writes `handoff.json` with an honest continue/halt call, and the next leg resumes with zero in-context dependency. Trigger: `/rolling-campaign`, \"chain campaigns\", \"keep running campaigns until the roadmap is done\". NOT for a single campaign that fits one context (use /proof-campaign)."
---

# /rolling-campaign - chained proof campaigns across fresh contexts

Run a **chain** of proof campaigns. Each campaign is a roadmap-bounded, agent-verified work window (plan → waves → verify → evidence). What makes this a chain: when one campaign finishes, it writes a resumable **handoff** and a brand-new process picks up the next campaign in a **cleared context** — so a roadmap slice larger than any single orchestrator context can be driven end-to-end without a human babysitting each reset.

A skill cannot clear its own context. The context reset is therefore owned by an **external driver** (`scripts/chain.sh`) that relaunches `/rolling-campaign` as a new process per leg. This skill's job is to make every leg **fully resumable from disk** and to emit an **honest continue/halt decision** so the driver keeps going on progress and stops on a wall — never relaunching into a red verify gate or a needs-human block.

## Invocation

```text
/rolling-campaign [input] [--scope "§A.1-§A.7"] [--goal "..."] [--work-cap 200k] [--concurrency N] [--scouts 0|1|2] [--verify "..."] [--max-campaigns N] [--seed | --resume] [--roadmap-update] [--dry-run]
/chain-campaign ...
```

Two entrypoints — the whole skill turns on which one runs:

| Flag | Who runs it | Behavior |
|---|---|---|
| `--seed` (default on first run) | human, interactive | Approve the chain gate once, run **one** campaign leg, write `handoff.json`, then **stop**. This is the single human authorization that licenses the whole chain. |
| `--resume` | `scripts/chain.sh`, headless | No questionnaire, no approval gate. Read the previous leg's `handoff.json`, promote the drafted next campaign to active, run one leg, write a fresh `handoff.json`, exit. |

Defaults:

- `work-cap`: `200k` work tokens **per leg**, main orchestrator only. Subagents (workers, scouts, reviewer) spend independent budgets and collectively far exceed this; that is expected. When a leg's orchestrator nears cap, it draws the leg to a close and drafts the next campaign — cap pressure is a normal, non-halting reason to roll.
- `max-campaigns`: `8` legs, then the driver stops (rerun to extend). A runaway backstop, not a target.
- `concurrency`: 5 workers per wave. `scouts`: 2 when budget allows, 1 under session pressure. `verify`: auto-detect like `/blitz`.
- `roadmap-update`: off; each leg emits a roadmap-update packet, it does not rewrite `docs/ROADMAP.md`.
- `dry-run`: off; seed-only preview. Run Phase 0 intake + the Phase 1 chain plan, print the plan block, stop. No approval prompt, no `chain/` artifacts, no `itr` writes, no leg executed — nothing for the driver to resume.

## Why the driver exists (the context-clear reality)

`/loop` and in-context "auto-next" both keep running in the **same** conversation — context accumulates and never clears, which defeats the entire point. The only way to genuinely clear between campaigns is a **fresh process per leg**. `scripts/chain.sh` provides that: each iteration is a new `claude -p` invocation = a cleared context. The handoff on disk is the sole thread between legs.

Seed once, then hand off to the driver:

```text
# 1. Seed (interactive — you approve the chain here):
/rolling-campaign --seed --scope "§A.1-§A.7"
# 2. Drive (headless — clears context each leg, halts on a wall).
#    CLAUDE_ARGS grants the permission mode a headless leg needs to edit + verify:
CLAUDE_ARGS="--permission-mode acceptEdits" claude/skills/rolling-campaign/scripts/chain.sh .
```

## Roles & artifacts

- **You (Product Owner):** approve the chain once at the seed gate; review rendered reports async; read the halt reason if the chain stops.
- **Orchestrator (per leg):** plans the leg, runs waves, verifies, writes state + handoff. A fresh one each leg — it knows nothing but what the handoff and campaign JSON tell it.
- **Workers / scouts / reviewer (per wave):** isolated subagent contexts; do the work, discover follow-ups, check evidence.
- **Driver (`chain.sh`):** relaunches the orchestrator per leg, reads `handoff.json`, decides to continue or halt.

Artifacts live under a `chain/` namespace so a chain is distinguishable from a one-shot `/proof-campaign`:

```text
chain/
  CURRENT                      -> symlink to the active leg folder
  chain.json                   chain-level ledger: legs run, cumulative scope, halts
  leg-001-YYYY-MM-DD-<slug>/
    campaign.json queue.json evidence.json ledger.json    (compact JSON state)
    handoff.json               the resume + continue/halt contract for the NEXT leg
    notes.md
    reports/                   changelog.html smoke-test.html roadmap-update.html retro.html
  leg-002-.../
    ...
```

State files are compact JSON; PO-facing files are rendered HTML. Use `scripts/render_leg_report.py` (or the campaign renderer it wraps) instead of hand-writing HTML in context. See `scripts/SCHEMA.md` for the `handoff.json` and `chain.json` contracts.

## Definition of agent-verified done (per item, per leg)

A leg may close an item only with objective evidence. All must hold:

- Acceptance criteria observable and mapped to evidence.
- Owned-file diff matches the ticket/bundle scope.
- Full repo verify gate exits zero after the wave.
- Targeted tests added/updated for changed behavior when practical.
- UI-touching or user-visible/behavioral change requires **runtime evidence** — drive the flow end-to-end and/or capture a Playwright screenshot (`/verify` + playwright). A green gate or successful build is NOT sufficient: a written value is not a wired feature. For a "wrote a value" change, prove the **read site** consumes it.
- Runtime evidence is scoped to UI/behavioral diffs only. Pure non-UI work (refactor, backend logic, docs, config) is exempt — the verify gate is its done gate.
- Evidence is recorded in the leg's `evidence.json`.

If a requirement cannot be met, do not close as done: mark `blocked` / `quarantined` / `needs-human`, file it, and keep moving on unrelated work. A blocked item is accepted output, **not** a halt trigger — the leg proceeds and succeeds around it (see the never-stuck gate below).

## Never-stuck guarantee — the three-attempt hard gate

The workflow must **always terminate** — never hang, never spin, never loop. Every retry loop in a leg is hard-capped at **3 attempts**. When a gate requires something Claude cannot achieve after 3 rounds, the skill does **not** keep trying: it converts the blocker into a filed issue and moves on.

**`blocked` is a terminal, accepted, NON-gating outcome.** This is the rule that keeps the skill from getting stuck: a leg's success is **never** conditioned on the blocked count reaching zero. Do not re-open, retry, or wait on a deflected item — once filed to `itr` and quarantined, it is *done being worked* for this run. Nothing downstream (leg completion, the reviewer pass, the handoff `continue` decision) may gate on "unblock everything first." A leg with blocked items is a **successful** leg; the blocked items are expected output, captured as issues for a human. Gating on zero-blocked is the exact trap that gets agents stuck — this skill forbids it. A leg's *actual* completion gate is only: **verify green on the non-deflected scope, and every deflected item has a filed `itr` issue.**

Gates this cap governs (each independently, 3 attempts): verify-gate repair after a red wave · a worker's per-bundle retries · rate-limit cascade recoveries · loading a drafted next campaign on `--resume` · resolving a roadmap/PO ambiguity the leg tried to self-answer.

**Deflection is by design — it produces a PO-smoke item, not a failure.** Not every legitimate piece of work can pass an automated green gate; some genuinely needs a human PO's insight or a manual smoke test. Routing that work to the PO is the workflow **succeeding at its boundary**, not failing. The agent proves what is agent-provable and hands the rest to the human as a clean, well-captured smoke queue. Treat blocked/deflected items as expected, first-class output — the natural second deliverable alongside the agent-verified work.

On the 3rd failed round, **deflect**:

1. File an `itr` issue capturing the full problem — the gate, exactly what it required, the 3 attempts and their errors/output, why Claude couldn't satisfy it (esp. "needs PO judgment / manual smoke"), the owned files/scope, and the repro/verify command. Label it `rolling-campaign,blocked,needs-human`.
2. Mark the item `blocked` in `queue.json` with `source: "itr#<n>"`. **Never mark it `verified`** — a deflected item is blocked-and-filed, honestly not done. Record the ref in the handoff's `deflected_issues`.
3. **Add it to the PO smoke-test list** (`ledger.smoke_test.items`, with a `questions_for_po` entry when the blocker is a judgment call) so it renders in `smoke-test.html` as an actionable item the PO can unblock — that report *is* the human's queue.
4. Isolate and continue: quarantine the deflected scope so the verify gate goes green on everything else, then keep executing unrelated work.

**Early deflect — don't spend attempts you already know will fail.** The 3-cap is a ceiling, not a quota. If the **first** attempt reveals a failure cause that is *deterministic and attempt-invariant* — two more identical rounds would fail the same way — do **not** run rounds 2 and 3. Short-circuit straight to deflect after attempt 1, and update the ticket with why it was cut short (e.g. *"Deterministic: needs PO smoke on staging data; identical retries cannot change the result — deflected after 1 attempt"*). The test: *would the next attempt change any input the outcome depends on?* If nothing would differ, retrying is theater.

- **Qualifies for early deflect (stop at 1):** missing/withheld credential or access · needs PO judgment or a product decision · depends on unbuilt work · required tool/environment absent · requirement genuinely ambiguous · an external service structurally (not transiently) unavailable.
- **Does NOT qualify (take the full 3):** flaky/nondeterministic tests · rate-limit/overload (its own cascade cap governs) · partial-progress failures where each round advances · anything where a *different approach* on the next round is plausible.

When early-deflecting, file or **update** the existing `itr` issue with the invariance reason, mark `blocked`, add it to the PO smoke list, and record it in `deflected_issues` with `attempts: 1`. Then move on. Erring toward the full 3 attempts is the default; early deflect requires a concrete, stated invariant cause — it is not an excuse to skip a retry that might have worked.

**What "closed and successful" means here — the honest reading.** The *execution case* closes successfully: the skill run ends cleanly with the blocker filed, instead of hanging on an impossible gate. It does **not** mean the unfinished work is marked done — the `itr` issue is the truthful record that a human must finish it. This deliberately preserves "a written value is not a wired feature / don't close work without evidence": deflection files honestly, it never fakes completion.

**Isolable vs foundational:**

- *Isolable* (the blocker is specific items): deflect + quarantine + continue the leg. The chain rolls on (`continue: yes`).
- *Foundational* (the blocker stops all further verification — e.g. the build itself won't compile and can't be narrowed after 3 rounds): file a P1 blocker `itr` issue, then terminate the chain **gracefully** — write `continue: no` with `halt_reason` naming the issue, render reports, exit clean. A graceful halt with a filed issue is the success case for an impossible foundation; an infinite retry is the failure case.

**Termination invariant:** every inner loop is 3-capped, and the driver halts on no-progress (below), so a leg always ends in exactly one of — advance to the next leg · deflect item(s) + continue · file blocker + clean halt. There is no path that loops forever.

### Convergence — deflected work is done work; the chain must recognize it

The steamroll failure: a leg deflects a hard item to `itr#88`, a later leg's scout or planner sees `itr#88` in the backlog, treats it as fresh work, re-attempts it, fails, re-deflects — the chain grinds forever on its own rejected work. Two rules prevent it:

1. **Deflected issues are permanently out of scope.** Every deflection is recorded in the handoff's `deflected_issues` and accumulated in `chain.json`. That cumulative set is carried forward in every handoff, so each **fresh** leg (which remembers nothing else) loads it and **excludes those ids from the `ready`/candidate pool.** The scout-roadmap and planner filter them out. A deflected item is never re-pulled — by anyone, ever, for the rest of the chain. Human follow-up on the `itr` issue is what reopens it, outside this run.

2. **A chain whose only remaining work is deflected work is DONE — and that is success, not a wall.** Before drafting the next campaign, subtract the cumulative deflected set from the candidate work. If nothing provable is left — i.e. the only things still "open" are the PO-smoke issues this chain already filed — emit `continue: no` with `stop_condition: only_deflected_remains` and a `halt_reason` like *"Chain converged: N items agent-verified, M handed to the PO as smoke-test items (itr#..). No agent-provable work remains — over to the PO."* This is the **designed** terminal state: the agent finished everything a green gate can prove and delivered the rest as a clean PO-smoke queue. Report it as a successful completion, and point the PO at `smoke-test.html`.

The mental model is loop-until-dry where **"dry" = no NEW provable work**, and deflected issues never count as new. A chain always converges: each leg either proves work (shrinking the roadmap remainder) or deflects it (moving it permanently out of scope) — the provable remainder strictly decreases, so it reaches zero.

### Visual-gate-only work is pre-deflected — hand it to the PO, never spend a wave on it

A ticket whose only deliverable is the PO's own visual smoke against a Visual Gate block (`LOOK AT / IGNORE / EXPECTED / CONFOUNDERS`) — tagged `visual-gate-only`, or visual-scope with no agent-implementable code — cannot be agent-proven, ever. Treat it as **pre-deflected**: on sight, *without* spending any of the 3-attempt cap, add it to the PO smoke-test list (`ledger.smoke_test.items`) and to `deflected_issues` + the cumulative `deflected_all` exclusion set, and mark it `blocked` in `queue.json` (never `verified`). It renders in `smoke-test.html` — the async report that **is** the human review — and, being in `deflected_all`, no fresh leg or scout ever re-pulls it (same steamroll guard as any deflected item). For the convergence check it counts exactly like a deflected item: a chain whose only remaining work is visual-gate-only tickets is **done** (`stop_condition: only_deflected_remains`) — success, over to the PO. This differs from a ticket with real code work *plus* a visual gate: that one runs a wave and only its final smoke defers to the report.

### Stuck-risk ledger — anticipated failure modes and their guard

| Risk | Could get stuck how | Guard |
|---|---|---|
| Verify gate flaps / never green | repair loop iterates forever | 3-attempt cap → deflect isolable / graceful halt if foundational |
| Attempts 2–3 are knowably futile (deterministic cause) | wastes two rounds on a guaranteed failure | early deflect after attempt 1 with a stated invariant cause; update the ticket, move on |
| Rate-limit cascade / API down | respawn workers forever | 3 recovery cap → file `itr`, clean halt |
| Worker hangs or never returns | orchestrator waits forever | bounded wait, then count as a failed attempt (3-cap) |
| Leg crashes before writing a handoff | driver relaunches the same stale `continue: yes` forever | driver's **no-progress signature check** (`from_leg`+`ended_at`+`chain.index`) → halt, don't relaunch |
| `continue: yes` but next campaign not actually prepared | `--resume` finds nothing to run, spins/errors | resume validates `prepared` + dir exists; if not, rewrite handoff `continue: no` + file `itr`, exit clean |
| Scouts keep drafting work; `roadmap_remaining` never empties | chain runs to `max-campaigns` doing thin work | scope fixed to seed-approved rows only; `--max-campaigns` cap; no-progress leg detection |
| Leg verifies 0 items yet re-drafts the same next scope | chain churns identical legs to the cap | two consecutive no-progress waves ⇒ halt; identical next-scope with 0 verified ⇒ halt |
| Roadmap/PO ambiguity blocks planning | leg waits on a human that isn't there | 3 self-resolve attempts → file `itr` question, mark `needs-human`, halt or route around |
| `chain/CURRENT` stale / broken symlink | driver reads an old handoff forever | driver re-resolves each iteration + no-progress signature check |

## Announce: Phase 0 — Seed intake (`--seed` only; `--resume` skips this)

Resolve scope in this order: explicit path/brief → `docs/ROADMAP.md` / root `ROADMAP.md` / `roadmap/` → tracker backlog (`itr` default) → locked spec (`docs/REWRITE_SPEC.md`, `docs/SPEC.md`, `README.md`, `CLAUDE.md`) → recent conversation.

Read project conventions: `sprint/config.yml`, `STORY_STYLE.md`, `AGENTS.md`/`CLAUDE.md`, existing `sprint/*` / `campaign/*` / `chain/*` artifacts.

Read the roadmap as a bridge, not authority (spec defines scope; `itr` defines execution state):

- Express the **whole-chain** scope as roadmap rows: which rows the chain aims to turn ✅, which stay 🟡, which are out of scope.
- Prefer next ❌/🟡 rows in trajectory order; else dependency order, wide dependencies first.
- Preserve `<!-- po:override -->` and any cell without `<!-- auto -->`.
- If the chain goal diverges from the roadmap suggestion, record a divergence note in `chain.json`.

Preflight (print one compact block):

```text
rolling-campaign preflight
  chain goal: <one line — the whole slice this chain will prove>
  chain scope: <roadmap rows across all legs | unresolved>
  per-leg cap: 200k work tokens, 20% reserve   # subagents uncapped
  max legs: <N>
  tracker: itr | other | none     graph: kgr | rg
  verify: <cmd>
  agents/leg: <workers> workers + <scouts> scouts + 1 reviewer
  seed leg: leg-001-<date>-<slug>
```

If no roadmap exists, allow chaining from backlog/spec but mark `roadmap=absent` and suggest `/roadmap` in the final report.

## Announce: Phase 1 — Chain plan & single gate (`--seed` only)

Plan the **chain**, not just one leg:

- Slice the roadmap scope into leg-sized campaigns. Each leg must fit one orchestrator context under `work_cap - reserve`.
- Order legs by dependency; foundational rows first.
- Declare, per leg, the owned/forbidden file boundaries you can foresee (later legs refine from the handoff).
- Estimate coarse token cost per leg: S=10k M=25k L=60k XL=120k+.
- Name the halt boundary: what would make the chain stop early (verify unfixable, needs-human, roadmap slice complete).

Ask for exactly one go-ahead. This single approval authorizes the entire chain — the driver relaunching per leg is that approval continuing, not a new decision.

```text
rolling-campaign plan
  chain goal: <goal>
  legs: <N> campaigns, ~<tokens>/leg, <max-campaigns> cap
  scope: <rows; intended final statuses>
  leg 1: <slug> — rows <...>, ~<tokens>
  leg 2: <slug> — rows <...>, ~<tokens>   (drafted from leg 1's handoff)
  ...
  V: <verify command>
  clears context between legs via scripts/chain.sh (fresh process each leg)
  halts on: verify-unfixable | needs-human | slice-complete | max legs
  PO gets: rendered HTML reports per leg, async

Approve the chain? (yes / amend / abort)
```

`--dry-run` stops here: print the plan block, then exit — skip the approval question, write nothing, run no leg.

After `yes`, the PO has authorized executing in-scope legs, reprioritizing/appending traceable work, drafting each next campaign, automatic review/retro/reporting, and the context-clearing relaunch. It does **not** authorize destructive actions, secret/access changes, legal/security-ambiguous work, or silently rewriting `docs/ROADMAP.md`. Those halt the chain for a human.

## Announce: Phase 2 — Run one leg

This runs identically under `--seed` (leg 1) and `--resume` (leg N). Under `--resume`, first load the previous handoff:

1. Read `chain/CURRENT/handoff.json`. If it is missing, malformed, or `continue != "yes"`, **do nothing and exit 0** — the driver should not have called, and failing safe beats double-running.
2. Verify the drafted `next_campaign.dir` exists on disk with promoted queue items. Promote its `next_campaign`-lane items to `ready`. Set this leg's scope from `handoff.next_campaign`. Carry `verify_gate` forward (no re-detect needed).
3. **Load `handoff.deflected_all` and treat it as a hard exclusion set** for this leg and its scouts — none of those `itr` ids may re-enter the `ready`/candidate pool. If, after excluding them, no agent-provable work remains, do not run a wave: write `continue: no`, `stop_condition: only_deflected_remains`, and report the chain converged (success, over to the PO).
4. Point `chain/CURRENT` at this new leg folder.

Then run the campaign leg:

- Build compact state: `campaign.json`, `queue.json`, `evidence.json`, `ledger.json` (schema in `scripts/SCHEMA.md`). Batch reads; one planner pass for unknown file sets — never one planner per ticket.
- **Waves:** pick the largest conflict-free set of `ready` bundles → one worker per bundle → between waves run the full verify gate from the orchestrator. Green ⇒ mark `verified`. Red ⇒ repair agent or local fix, **capped at 3 rounds** (see the never-stuck gate below); still red after 3 ⇒ isolate: deflect the failing scope (file `itr` + mark `blocked`), quarantine it out, and get the gate green on the rest before continuing.
- **Worker contract:** own only listed files; no repo-wide write-mode formatters; targeted checks then full gate; produce an evidence summary (commands + last relevant output); close/update the tracker only after the gate is green; report changed files + evidence, not narrative. A worker gets **at most 3 attempts** per bundle; the 4th failure deflects the bundle.
- **Scouts (read-only):** 1–2 running while workers execute, drafting in-scope follow-ups the orchestrator files in batches. Pause scouts before verification under session pressure — never the reverse.
- **Rate-limit cascade guard:** if several workers fail identically at once (API 429/overloaded, empty structured returns), treat it as rate-limiting, not bundle failure: pause ~60s, halve concurrency, respawn only the failed workers, do not count the attempt against any bundle. **Cap recoveries at 3** — if the cascade persists past 3, it is an environment blocker, not campaign work: file an `itr` issue and halt the chain cleanly (`continue: no`), never spin.
- **Reviewer pass** after each verified wave: evidence vs AC, owned-file drift, `git diff --stat` vs queue, screenshots for UI changes, tracker state vs queue. Gaps become repair work (if they affect done-ness, subject to the same 3-attempt cap) or backlog candidates. The reviewer **never re-opens a deflected item** — a filed `itr` blocker is closed for this run.

Compact status line while running:

```text
chain leg 3/8  W2
  scope: §A.4-§A.5  work: 118k/200k
  done: 9  active: 5  queued: 6  drafted-next: 4
  gate: npm test + lint green
  next: verify -> handoff decision
```

## Announce: Phase 3 — Draft next campaign & decide

Before ending the leg:

- If in-scope, traceable, agent-verifiable work remains for the chain, draft the **next** campaign on disk: create `leg-<N+1>-<date>-<slug>/`, write its `campaign.json` + `queue.json` with `next_campaign`-lane items, set `prepared: true`.
- Compute the **continue/halt decision** from the stop condition that ended this leg:

| Stop condition | `continue` | Why |
|---|---|---|
| Cap pressure; next campaign drafted | `yes` | more approved work; a fresh context resumes it |
| In-scope queue empty, more roadmap rows remain + next drafted | `yes` | keep advancing the slice |
| Blocked/deflected items present (any count) | *no effect* | blocked is accepted output, **never** a halt trigger — roll on around it |
| Verify red on **isolable** scope after 3 repair rounds | `yes` | deflect + quarantine the failing scope, gate green on the rest, continue |
| Verify red **foundational** (can't be narrowed) after 3 rounds | `no` | file P1 `itr`, graceful clean halt — never relaunch into a red wall |
| Roadmap slice complete / no in-scope work left | `no` | success — nothing to continue |
| Foundational task blocked / needs-human decision after 3 attempts | `no` | file `itr`, graceful halt; record the question in handoff + smoke-test |
| Two consecutive no-progress waves | `no` | spinning, not progressing |
| `--max-campaigns` reached (driver enforces too) | `no` | chain safety cap; rerun the driver to extend |

The distinction that avoids the stuck-trap: **blocked items never move the `continue` decision.** Only a *foundational* wall (nothing further can be verified) halts, and it halts **gracefully** with a filed issue — not by retrying. Isolable failures deflect and roll on.

Invariant: `continue: "yes"` **requires** `next_campaign.prepared: true` and the folder to exist. When genuinely uncertain whether more provable work remains, emit `continue: "no"` with a `halt_reason` — a clean stop with a filed issue is always safe, an infinite retry never is.

## Announce: Phase 4 — Render reports & write handoff

Never stop with unreported active agents — resolve or close every background worker first.

1. Write compact state, then render this leg's PO reports (`scripts/render_leg_report.py <leg>/campaign.json --out <leg>/reports`): `changelog.html`, `smoke-test.html`, `roadmap-update.html`, `retro.html` (adaptive — a clean leg renders a one-liner).
2. Append this leg to `chain/chain.json` (legs run, cumulative verified/blocked, halts).
3. Write `chain/<leg>/handoff.json` **and** mirror it to `chain/CURRENT/handoff.json` (see `scripts/SCHEMA.md`). This is the only artifact the driver reads.

Roadmap write policy: default renders `roadmap-update.html`; direct `docs/ROADMAP.md` edits only with `--roadmap-update` and only for `<!-- auto -->` cells linked to closed verified work with no drift/boundary/orphan/`po:override` ambiguity. Any ambiguity → packet only, roadmap untouched, and it becomes a halt-worthy PO question if it blocks progress.

## Announce: Phase 5 — Clear & continue (driver) OR halt

- Under `--seed`: print the leg summary + the handoff decision, then **exit**. Tell the PO to launch `scripts/chain.sh` to drive the rest.
- Under `--resume`: exit. `chain.sh` reads `chain/CURRENT/handoff.json`; on `continue: yes` (and under the leg cap) it relaunches a fresh `claude -p "/rolling-campaign --resume"` — a cleared context — and Phase 2 begins again for leg N+1. On `continue: no` the driver prints `halt_reason` and stops.

### The driver — `scripts/chain.sh`

Resume-only headless loop. Requires a human-seeded leg 1 to exist. Each iteration is a fresh process = a cleared context.

```text
scripts/chain.sh [repo-dir]        # env: PROOF_CHAIN_MAX (default 8), CLAUDE_BIN (default: claude),
                                   #      CLAUDE_ARGS (extra claude flags, word-split)
```

A headless (`-p`) leg cannot answer permission prompts — without a permissive mode its edits and gate commands are denied and the leg can't do real work. Pass one via `CLAUDE_ARGS`, e.g. `CLAUDE_ARGS="--permission-mode acceptEdits" scripts/chain.sh .`

It re-reads `chain/CURRENT/handoff.json` each iteration, relaunches only while `continue == yes`, and stops on `continue: no`, a nonzero `claude` exit, or a leg cap — `PROOF_CHAIN_MAX` caps this invocation (resets on rerun), while the handoff's `chain.max_campaigns` caps the chain overall (survives reruns; the skill enforces it too by emitting `continue: no`). Verify-red and needs-human halts surface to the operator instead of relaunching.

## Final output (per leg)

```text
rolling-campaign leg complete
  chain: chain/<folder>          leg: <N>/<max>
  scope: <roadmap rows>
  verified: <N>  blocked/deflected: <N> (itr#..)  parked/next: <N>/<N>
  work: <used>/<cap>   verify: green | red <reason>
  reports: changelog / smoke-test / roadmap-update / retro (paths)
  handoff: continue=<yes|no>  next=<leg-NNN | none>  [halt: <reason>]
  PO next: run smoke-test.html async | pick up deflected itr#.. | chain halted — see halt reason
```

## Principles

- One approval seeds the whole chain; the driver relaunching per leg is that approval continuing.
- The context clear is real: a fresh process per leg, not an in-context loop. The handoff on disk is the only thread between legs.
- Every leg is fully resumable from disk — a fresh orchestrator needs nothing but the handoff + campaign JSON.
- The continue/halt decision is honest and fail-safe: continue only on proven progress with the next campaign drafted; halt gracefully (with a filed issue) on a foundational wall, and when in doubt, halt.
- **Two deliverables, both first-class:** agent-verified work (green gate) *and* a PO-smoke queue (blocked/deflected items filed to `itr` + `smoke-test.html`). The second is not failure residue — it is the designed hand-off of work that needs human judgment a green gate can't give.
- **Never gate on zero-blocked.** `blocked` is terminal, accepted output — the workflow rolls on around it and succeeds. Gating on unblock-everything is the classic stuck-trap; this skill forbids it.
- **The chain converges:** each leg either proves work or deflects it out of scope, so the agent-provable remainder strictly shrinks to zero. When only PO-smoke items remain, the chain is done — hand them over, don't re-attempt them.
- Every retry is 3-capped; the 3rd failure deflects to a filed `itr` issue, never a 4th try. The workflow always terminates.
- Verification replaces live PO acceptance; the PO reviews rendered reports async, per leg.
- Campaign state is compact JSON; HTML comes from the renderer; file ownership controls parallelism.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. Each leg's orchestrator commits its verified work before writing the handoff — a fresh process must inherit committed state, not a dirty tree.

## Don't

- Don't try to clear context from inside the skill — that's the driver's job; the skill only writes a resumable handoff.
- Don't emit `continue: "yes"` without a `prepared` next campaign on disk.
- Don't relaunch the chain into a red verify gate or a needs-human halt — `continue: no` means stop.
- Don't run `--seed` and `--resume` together, and don't chain with an in-context auto-next loop (it never clears).
- **Don't ever pull a previously-deflected `itr` issue back into scope.** Re-attempting the chain's own rejected work is the steamroll trap — deflected issues are out of scope for the rest of the chain, permanently.
- **Don't keep going when the only work left is deflected issues.** That state means DONE (success), not "more backlog to clear" — stop and hand the issues to the human.
- Don't gate leg completion on zero-blocked; blocked is accepted terminal output.
- Don't close work without objective evidence, or execute scout work that doesn't trace to the approved chain goal.
- Don't silently rewrite `docs/ROADMAP.md` when a `/roadmap` gate would apply; render the packet and, if it blocks, halt for the PO.
- Don't leave background agents running at a leg's end, or stop with unreported active workers.
- Don't hand-write rich HTML in the main context; use the renderer script.
