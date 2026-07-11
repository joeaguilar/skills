---
name: crossfire-blitz
description: "Clear a backlog with a model-routed parallel blitz: each task goes to the cheapest model that clears its bar (gpt-5.6-terra via Codex for bulk/generalist work; opus/fable for taste-critical), is cross-reviewed by a DIFFERENT model before close, and escalates when a cheaper model misses. Trigger: `/crossfire-blitz`, \"multi-model blitz\", \"route tasks to the cheapest capable model\". NOT for a single-model blitz (use /blitz)."
---

# crossfire-blitz — model-routed parallel backlog clearance

A blitz where **the model is chosen per task, not per session.** Bulk/mechanical work goes to **gpt-5.6-terra** (the Codex generalist — cheap, intelligence 8), dropping to **gpt-5.5** as the cheapest floor for trivial mechanical work; user-facing / taste-critical work goes to **opus-4.8** or **fable-5**; every closed task is **cross-reviewed by a different model** than executed it. When a cheaper model's output misses the bar, the task is **redone by a smarter model without asking** — cost is a tie-breaker, never a reason to ship mediocre work.

By default crossfire-blitz **runs exactly like a plain blitz** — one **shared checkout**, disjoint-file waves, a self-healing full-repo verify gate between waves, **no commits** — and adds just two things: per-task **model routing** and a **cross-model review** before each close. The invariants carry straight over:

- **File ownership is the unit of parallelism.** No two tasks in a wave own the same file — so agents editing disjoint files in the shared tree never collide.
- **A self-healing verify gate between waves.** Each agent runs the full-repo gate; the shared tree is the convergence point. The wave doesn't advance on a red gate.

The one wrinkle Codex adds: the Codex companion allows only **one active task per checkout**, so by default **each wave carries at most one Codex task**, run in the shared tree via `codex exec -C` right alongside the Claude agents. That keeps the whole run in one tree and preserves blitz's model — including self-healing and no-commit.

**Opt-in `codex_parallel=on`** — for Codex-heavy backlogs that want *several* Codex tasks per wave running in parallel: Codex tasks then run in **orchestrator-managed git worktrees** off a committed run-branch base, integrated and committed per wave. This buys Codex throughput at the cost of blitz's self-healing and no-commit (the worktree machinery + its verified caveats live in Phases 4/6).

## Slash invocation

```
/crossfire-blitz [tracker=...] [verify=...] [concurrency=N] [max_waves=N] [time_budget=...] [repos=...] [fable=off|on] [--fable] [review=on|off] [codex_parallel=off|on] [defer_docs=auto|on|off]
```

| Arg | Default | Meaning |
|---|---|---|
| `tracker` | `itr` | Backlog source (any command that lists open tasks, e.g. `gh issue list ...`). |
| `verify` | auto-detect | Verify-gate command (Cargo / npm / pytest / go / Make — same detection table as a standard blitz). |
| `concurrency` | `5` | Max parallel agents per wave. |
| `max_waves` | unset | Hard cap on waves. |
| `time_budget` | unset | e.g. `2h`. Stop launching new waves once elapsed; in-flight wave finishes. |
| `repos` | `.` | Comma-separated repo paths in scope. |
| `fable` | `off` | Master gate for the (expensive) **fable-5** model. `off` → taste-critical work always routes to **opus-4.8**, and fable is never spent unattended. `on` (or the `--fable` alias) → fable-5 is available for hero/flagship taste surfaces and as the top escalation rung. A task can *request* fable in its body; under `fable=off` that request triggers an `AskUserQuestion` (off is the default option) rather than silently spending it. |
| `review` | `on` | Cross-model review gate before each close. `off` skips it (faster, less safety). |
| `codex_parallel` | `off` | `off` = shared-tree, ≤1 Codex task per wave, no commits (blitz-style). `on` = Codex tasks run in orchestrator-managed worktrees, several per wave, committed per wave on a run branch. |
| `defer_docs` | `auto` | Whether to pull shared prose/`.md` edits out of their tasks and batch them into one **consolidated docs wave** at the end. `auto` = detect shared-doc conflict cliques in Phase 2 and *offer* it; `on` = always defer; `off` = never (docs edit in place with their task). Deferring collapses the biggest needless serializer — a doc many tasks all touch — and often roughly halves the wave count. |

---

## The routing rubric (the core of this skill)

Every model score below is **higher = better**; `cost` is what the user pays, so a higher cost score means **cheaper**. Never use Haiku for anything.

| Model | Cost | Intelligence | Taste | Reached via |
|---|---|---|---|---|
| gpt-5.6-sol | 5 | 9 | 6 | Codex — `codex exec -m gpt-5.6-sol` (the smart Codex escalation rung). |
| gpt-5.6-terra | 6 | 8 | 5 | Codex — a `sonnet` wrapper agent running `codex exec -C <dir> -m gpt-5.6-terra -c model_reasoning_effort="high"` (implementation), `/codex:adversarial-review` runtime (review). **The default Codex generalist / bulk workhorse.** |
| gpt-5.6-luna | 7 | 8 | 4 | Codex — `codex exec -m gpt-5.6-luna` (cheaper terra-peer, lower taste). |
| gpt-5.5 | 9 | 7 | 5 | Codex — the `~/.codex/config.toml` default; cheapest floor for trivial mechanical work. |
| sonnet-5 | 5 | 5 | 7 | Agent/Workflow `model: 'sonnet'` |
| opus-4.8 | 7 | 7 | 8 | Agent/Workflow `model: 'opus'` |
| fable-5 | 2 | 9 | 9 | Agent/Workflow `model: 'fable'` |

**Executor assignment — classify each task, then route:**

1. **User-facing / taste-critical** — the task produces something a human sees or consumes (UI, UX, copy, error messages, public API/interface shape, docs). Taste must be **> 7** → **opus-4.8** (the default taste executor). **fable-5** is used only when `fable=on` *and* the surface is hero/flagship (or the task explicitly requested it — see the Fable gate). *Never a Codex model (terra/sol/luna/gpt-5.5) or sonnet-5 for the taste call — none clears the taste bar.*
2. **Bulk / mechanical** — clear-spec implementation, migrations, data transforms, mechanical refactors, backend logic with unambiguous acceptance → **gpt-5.6-terra** (the generalist; intelligence 8 is plenty; cheap). Drop to **gpt-5.5** only as the cheapest floor for the most trivial mechanical work (intelligence 7).
3. **Ambiguous / judgment-heavy but not user-facing** — needs real reasoning, cross-cutting, spec not airtight → **opus-4.8** (intelligence 7). Route to gpt-5.6-terra only if you can genuinely hand it off unsupervised.

**The Fable gate (cost control).** fable-5 is the strongest model but the most expensive (cost 2), so it is **off by default** and never spent unattended:

- **`fable=off` (default):** the router never assigns fable-5. Taste-critical → opus-4.8; the escalation ladder tops out at opus-4.8. If a task's body *requests* fable (e.g. a `needs: fable` marker, or "hero surface — use fable"), do **not** silently honor it — collect all such tasks and raise **one** `AskUserQuestion` during planning: options **"Fable off (Recommended)"** first, **"Fable on"** second. Off being first means an unattended/headless run (where `AskUserQuestion` can't be answered) **defaults to off** — fable is never enabled by accident. Pick "Fable on" → enable fable-5 for exactly those requesting tasks; "Fable off" → route them to opus-4.8.
- **`fable=on` / `--fable`:** fable-5 is available — the router assigns it to hero/flagship taste surfaces and to any task that requested it, no question asked.

**Reviewer assignment — always a *different* model than executed the task** (that difference is the "crossfire"):

- Codex-executed task (gpt-5.6-terra et al.) → reviewed by **opus-4.8** (or **fable-5** when `fable=on`).
- Claude-executed task → reviewed by a **Codex generalist** (gpt-5.6-terra via the `/codex:adversarial-review` runtime — cheap, independent perspective). For taste-critical work you may add a second flagship-taste reviewer — **fable-5, only when `fable=on`**; under `fable=off`, the Codex reviewer is the sole cross-reviewer (a same-model opus-reviews-opus pass is not a crossfire).
- A model never reviews its own output.

**Escalation ladder** (standing permission for the first three rungs — no need to ask): a task whose review surfaces a real (P0/P1) defect is **redone by the next-smarter model**: gpt-5.6-terra → **gpt-5.6-sol** → opus-4.8 → **fable-5**. The **fable rung is gated**: under `fable=off`, escalation tops out at opus-4.8. But **topping out is not the same as silently redoing at the same model.** When a task was *already executed at the ceiling* (opus-4.8 under `fable=off`) and its review still fails, "escalate to next-smarter" has no smarter rung left — the only same-tier move is **redo-by-same-model with the review findings spliced into the prompt**. Do that redo **once**; if it still fails, **do not silence the ceiling** — surface it to the user (or raise the Fable-gate `AskUserQuestion` for that task) and recommend one of the two real escalations above opus: **enable fable-5** for the task, or **route it to `gpt-5.6-sol` at ultra** (`codex exec -m gpt-5.6-sol -c model_reasoning_effort="high"`), which is also acceptable as a ceiling-breaker. Never quarantine an opus-executed task as "escalation exhausted" without first naming those two options — `fable=off` recommends against spending fable unattended, it does not forbid *recommending* it. Under `fable=on`, escalate straight through to fable with no question. Judge the output, not the price tag — escalating cost beats shipping the miss, *within the fable budget the user set.*

> **Codex reasoning-effort gotcha (bake this in).** Every `codex exec` in this skill omits an effort override by default, so it inherits `~/.codex/config.toml`'s `model_reasoning_effort` — which on some machines is set to `ultra`. The API **rejects `ultra`/`max` for gpt-5.5** (`Supported: none…xhigh`), so a bare `codex exec` on the config-default model **hard-fails on the very first task and blocks the whole Codex lane.** Fix: pin the effort explicitly on **every** `codex exec` invocation — implementation, worktree, and review — with `-c model_reasoning_effort="high"`. It is already baked into the canonical commands below; do not strip it.

> **Risky Codex tasks — effort floor per model (never run a risky task cheap).** On a **risky** task — one where a miss is costly, the spec is subtle, or the blast radius is wide — the reasoning effort is not negotiable: **gpt-5.6-luna must run at `ultra` only — NEVER `low` or `medium`** (`-c model_reasoning_effort="ultra"`); **gpt-5.6-terra must NEVER run at `low` or `medium`** (high or ultra only — the baked-in `"high"` satisfies this, bump to `"ultra"` for the riskiest). If a risky task doesn't justify that effort, or you're otherwise tempted to run it at low/medium on a Codex model, **do not** — **defer it to `sonnet`** (a Claude executor) instead. Low/medium Codex effort is for cheap, unambiguous, mechanical work only; a risky task at low/medium is how a subtle miss ships.

---

## Roles & artifacts

- **You (user)** — approve config (Phase 0) and the wave plan (Phase 3); rule on any hard quarantine.
- **Orchestrator (main agent)** — routes models, spawns executors, runs cross-model review, gates each wave, escalates on miss (and in `codex_parallel=on`, integrates + commits each wave).
- **Executor agents** — one per task, at its assigned model. Codex executors (default gpt-5.6-terra) run through Codex (see Phase 4).
- **Reviewer agents** — one per closed task, at a different model.
- **Artifacts** — a wave log at `sprint/{folder}/blitz/wave-{N}.md` (or `sprint/_unscoped/crossfire-blitz-{ts}.md` if no in-flight sprint), plus the tracker epic. Same layout as a standard blitz log, with an added **Model routing** column and a **Cross-model review** section. **Default (`codex_parallel=off`): no commits** — like a plain blitz, the user reviews and commits at the end. **`codex_parallel=on`:** each green wave is committed to a dedicated `crossfire-blitz/{ts}` run branch (never `main`, never pushed; worktree isolation forces it — Phase 6), handed to the user at the end to squash, merge, or discard.

Requires: git repo(s); the tracker on PATH; whenever any task routes to a Codex model (gpt-5.6-terra et al.), the **codex plugin** installed and authenticated (`/codex:setup` fixes it — it wraps the Codex CLI, whose `~/.codex/config.toml` defaults to gpt-5.5; select the executor model with `codex exec -m <model>`) so the `codex:codex-rescue` subagent and the `/codex:adversarial-review` runtime are reachable.

---

## Phase 0 — Preflight & confirm (BLOCKING)

**Announce: Phase 0 — Preflight.** Resolve config from args + auto-detection (tracker, dep-graph tool `kgr` if present, verify gate per repo — same detection as a standard blitz). Then **additionally**:

- Confirm the **codex plugin is installed and authenticated** if any task is likely to route to a Codex model (gpt-5.6-terra et al.) — locate the companion runtime: `ls -d ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs 2>/dev/null | sort -V | tail -1`, and confirm Codex auth (`codex login status`). Missing/unauthenticated → tell the user (`/codex:setup` / `codex login` is the fix) and offer to proceed **Claude-only** (route every bulk task to opus-4.8 instead — say so, and note the cost hit).
- **Only if `codex_parallel=on`:** confirm the harness supports **`isolation: 'worktree'`**, or that the orchestrator can `git worktree add` itself. Worktrees are what let *several* Codex tasks per wave run in parallel (the companion keys its job store on the worktree top-level and allows only one active `task` per store — distinct worktrees dodge the `Task … is still running` guard). If worktrees are unavailable, fall back to the default (`codex_parallel=off`, ≤1 Codex/wave in the shared tree) and say so.

Print the confirmation block and **wait** for explicit approval:

```
Crossfire-blitz preflight
  Tracker:      <list cmd> / <record cmd>
  Dep graph:    kgr present | absent — skipping
  Verify gate:  <cmd>   (per repo if multi)
  Concurrency:  <N>
  Repos:        <paths>
  Codex:        available (default exec model: gpt-5.6-terra; config default: gpt-5.5) | UNAVAILABLE — Claude-only fallback
  Execution:    shared-tree, ≤1 Codex/wave, no commits (default)
                | codex_parallel — Codex in worktrees, per-wave commit on crossfire-blitz/{ts}
  Taste exec:   opus-4.8
  Fable:        OFF — taste work → opus (default; fable never spent unattended)
                | ON — fable-5 available for hero surfaces + top escalation rung
                [N task(s) requested fable → will AskUserQuestion during planning]
  Review gate:  cross-model ON | OFF
  Defer docs:   AUTO — detect shared-doc cliques and offer a consolidated docs wave
                | ON — always batch shared .md edits into a final wave
                | OFF — docs edit in place with their task
  Stop when:    backlog empty | 2 no-progress waves | max_waves=<N> | time_budget=<T>

Will execute:
  1. Audit — list open tasks; kgr check per repo; read shared files
  2. Plan — resolve file ownership; build conflict map; ROUTE each task; cap ≤1 Codex/wave (default)
  3. Persist wave plan (with model routing) and confirm before Wave 1
  4. Run waves in the shared tree → cross-model review → escalate on miss → self-healing wave gate
     (codex_parallel: Codex tasks in worktrees → integrate → commit the wave)

Proceed? (or amend any of the above)
```

Amendments reprint; a decline stops.

## Phase 1 — Audit

**Announce: Phase 1 — Audit.** In parallel: list open tasks (full body — title, description, declared files, blockers, priority); `kgr check --format json --no-progress . || true` per repo if present; read shared files multiple tasks reference.

## Phase 2 — Plan & route

**Announce: Phase 2 — Plan.**

1. **Resolve file ownership.** Use each task's declared file list (itr `--files`, a `Files:` line, or frontmatter). For tasks without one, dispatch a single batched planner agent (`model: 'sonnet'`, read-only, no edits) that returns `[{task_id, files, confidence, reasoning}]` — same batched-planner contract as a standard blitz. Flag `confidence: low` tasks for the user.
2. **Build the conflict map.** Group tasks by every file they own; any file owned by ≥2 tasks is a **file conflict** (those tasks can't share a wave). Note **semantic neighbors**: a task that *consumes* a symbol, export, signature, schema, or route another task *introduces or changes* even when their files are disjoint. Honor declared `blocked-by`/`parent` too.

   **Docs consolidation (the single biggest packing win — offer it here).** Shared prose files — a `README.md`, `docs/*.md`, a `save-system.md` or `combat-system.md` that *many* tasks all append a note to — form the **largest, most needless conflict cliques** in a typical backlog: N tasks touching one doc means N tasks that can never share a wave, purely over prose. When `defer_docs` is `on`, or `auto` and Phase 2 finds any `.md`/prose file owned by ≥2 tasks: **strip the shared-doc edits out of their tasks' owned-file sets** (each task keeps its code files; its doc edit becomes a deferred note), and schedule **one consolidated docs wave at the end** that applies all of them together. Deleting those doc cliques from the conflict graph can **roughly halve the wave count** (observed: a 6-way `save-system.md` clique and a 5-way `combat-system.md` clique both collapsed to a single final wave). Under `auto`, present this as a recommendation in the Phase 3 plan (which cliques, how many waves it saves) rather than applying it silently; under `on` apply it and note it; under `off` leave docs in place. Carry each deferred doc note forward so the final wave has the full list.
**Set aside visual-gate-only tickets before routing.** A ticket whose only deliverable is the PO's own visual smoke against a Visual Gate block (`LOOK AT / IGNORE / EXPECTED / CONFOUNDERS`) — tagged `visual-gate-only`, or visual-scope with no agent-implementable code — has nothing to route: no model can implement or cross-review a human's eyes. Pull it out of the wave plan entirely — no executor, no reviewer, no escalation, no wave. This skill holds no live PO smoke, so leave it open and list it under `Deferred to /sprint-review — visual-gate-only` in the wave log and the Phase 8 report; the PO smokes it there. It never counts against the Phase 8 `backlog empty` stop and is never re-pulled. (A ticket with real code work *plus* a visual gate routes and runs normally; only its final smoke waits for `/sprint-review`.)

3. **Route each task** per the rubric above → assign `executor_model` and `reviewer_model` (different from executor). Record a one-line rationale per task ("mechanical migration → gpt-5.6-terra; reviewed by opus-4.8").
   - **Fable gate:** while routing, note any task whose body **requests fable** (a `needs: fable` marker or wording like "hero surface — use fable"). If `fable=off` and one or more tasks requested it, raise **one** `AskUserQuestion` before Phase 3: `question: "N task(s) request the fable-5 model (higher cost). Enable fable for them?"`, options **"Fable off (Recommended)"** (first) and **"Fable on"** (second). Default/first = off, so a headless run that can't answer keeps fable off. Apply the answer to those tasks' `executor_model` (opus-4.8 vs fable-5) and note it in the plan. Under `fable=on`, honor the requests directly with no question.
4. **Construct waves** — greedy bin-pack so that within a wave: (a) no two tasks share a file, (b) wave size ≤ `concurrency`, (c) blocked tasks land after their blocker, and (d) **at most one Codex task per wave** in the default mode (`codex_parallel=off`) — the Codex companion allows one active task per checkout, so extra Codex tasks spill to later waves. Under `codex_parallel=on`, drop rule (d): a wave may hold up to `concurrency` Codex tasks (each gets its own worktree).

   **Semantic neighbors — how strictly to split depends on the mode:**
   - **Default (shared tree):** semantic neighbors *may* share a wave, as in a plain blitz — every agent works in the shared checkout and the self-healing full-repo gate is the backstop (a consumer that races ahead of its producer gets caught and healed at the gate). Record a `neighbors:` warning; don't force a split.
   - **`codex_parallel=on`:** semantic-dependent tasks **must split across waves**. A Codex task in its own worktree is forked from a committed base and is blind to its wave-mates' in-flight edits (verified), so a consumer placed with its producer forks *without* the producer's change, fails its gate on the missing symbol, and bounces anyway. There is **no intra-wave self-healing** across worktrees — the integration gate (Phase 6) is the first place the combined result is tested. Split up front.

## Phase 3 — Persist plan & confirm waves (BLOCKING)

**Announce: Phase 3 — Confirm waves.** Write the wave log (path resolution identical to a standard blitz: `sprint/CURRENT` folder → `.../blitz/wave-{N}.md`, else `sprint/_unscoped/crossfire-blitz-{ISO-ts}.md`). Sections: `Config`, `Waves` (with **Model routing** column: task · executor · reviewer · rationale), `File conflicts`, `Semantic warnings`, `Cross-model review` (empty), `Escalations` (empty), `Interventions` (empty), `Outcomes` (empty). Record a tracker epic if supported.

Print the wave plan **including the model routing** and **ask once more** before Wave 1. Accept edits ("run task 42 on fable", "move task 7 to wave 2", "review gpt-5.6-terra tasks with fable not opus") and reprint.

## Phase 4 — Execute wave (model-routed)

**Announce: Phase 4 — Wave {N}.** Dispatch every task in the wave in parallel (≤ `concurrency`), each at its assigned executor model. In the **default** mode they all share one checkout (blitz-style); under `codex_parallel=on` the Codex tasks split into worktrees (see the box). Every executor prompt — Claude or Codex — carries the standard blitz contract: the task body, the files it **OWNS** (edit only these), the neighbor files it must **NOT** touch + semantic warnings, the working directory, the **prohibited-formatter** rules (no `cargo fmt` / `prettier --write` / `ruff format` / `gofmt -w` — they rewrite the whole tree), "run the full verify gate ({verify command}) yourself; it must exit zero", and "do **not** commit/push; end with a PASS/FAIL line + diff summary + gate tail".

**Canonical-invariant tasks — grep beyond the owned files.** File-ownership scoping is what keeps waves collision-free, but it also **blinds an executor to consumers of a value that live outside its declared `FILES`.** When a task's AC says "one canonical X **everywhere**" / "no duplicated thresholds/constants **anywhere**" / "all consumers use the same Y" — an invariant that ranges over the whole repo, not just the owned files — the owned-file set and the AC are **in direct tension** (observed: a duplicated affordability threshold sat in `balance.rs`, a file outside the ticket's declared `FILES`, so the executor never looked there even though the AC demanded no duplicates anywhere). Bake this into such a task's prompt: **grep the whole repo read-only for every consumer/definition of the invariant, even outside your editable set; fix the ones you own, and for any consumer outside your owned files, do NOT edit it — flag it explicitly in your report** (`file:line · out-of-scope duplicate · needs follow-up`) so the orchestrator can file it or fold it into a later wave. A green `cargo test` over only the owned files will not catch a duplicate the executor never grepped for.

**Claude executors** (Agent tool: `model: 'opus'` | `'fable'` | `'sonnet'`, `run_in_background: true`) — run in the **shared checkout** (no isolation), exactly like a plain blitz. Disjoint file ownership keeps them from colliding, and each one's full-repo gate is the self-healing backstop for the whole wave.

**Codex executor** (default model **gpt-5.6-terra**) — the `model` param can't reach a Codex model, so delegate to Codex via a thin Claude wrapper agent whose one Bash call runs `codex exec -m <codex-model>`. **Via the `Agent` tool:** `{subagent_type: 'general-purpose', model: 'sonnet', run_in_background: true, description: 'gpt-5.6-terra:task-{id}'}` — the roster name comes from **`description`** (the Agent tool has no `label` or `effort` param; those are `Workflow.agent()` options). The roster shows the wrapper's Claude model (*sonnet*), so the `gpt-5.6-terra:` prefix in the description is the only signal which Codex model actually ran — and it's what makes the Codex lane show up as an **agent** rather than a bare background *command* (verified). In a Workflow script use the full `agent(prompt, {model:'sonnet', effort:'low', label:'gpt-5.6-terra:...', schema})`. *(Running `codex exec` directly from the orchestrator via Bash also works, but then the lane appears as a background command, not an agent.)*

- **Default (`codex_parallel=off`) — one Codex task per wave, in the shared checkout.** The wrapper runs `codex exec -C <shared-checkout> -m gpt-5.6-terra -c model_reasoning_effort="high" -s workspace-write "$(cat "$PROMPT")"` (swap `-m` for the task's assigned Codex model; keep the `-c model_reasoning_effort` pin — see the effort gotcha) — Codex edits the shared tree in place, concurrently with the wave's Claude agents (disjoint files → no collision), and its own verify-gate run participates in self-healing just like a Claude agent. Nothing to integrate, nothing to commit. Because the wave holds only one Codex task (Phase 2 rule d), the companion's one-active-task-per-checkout guard never trips.
- **`codex_parallel=on` — several Codex tasks per wave, each in its own worktree.** See the box below; this is the only path that needs worktrees, a run branch, and per-wave commits.

Codex can exceed Bash's 10-min window — pass an explicit `timeout` on the wrapper's Bash call, or background + poll for the report file. Add `--skip-git-repo-check` only if the target isn't a git repo. Use `--output-schema "$SCHEMA"` + `schema` on the wrapper when you want a validated machine-readable return.

> **`codex_parallel=on` — worktree Codex (opt-in).** `codex exec -C <dir>` runs Codex on **exactly the branch at `<dir>`** (verified: `-C` a worktree on branch X edits X, leaves `main` untouched), so the orchestrator controls the base — the harness `isolation: 'worktree'` fork base is **not** controllable (Phase 6 box). Steps: (1) establish a **wave base** — a committed HEAD on the `crossfire-blitz/{ts}` run branch (Wave 1 branches from the current commit; commit any orchestrator setup first, since worktrees don't see uncommitted work — later waves use the commit Phase 6 made); (2) for each Codex task the orchestrator runs `git worktree add <path> <wave-base>` itself and the wrapper runs `codex exec -C <path> -m gpt-5.6-terra -c model_reasoning_effort="high" -s workspace-write --output-schema "$SCHEMA" "$(cat "$PROMPT")"` (swap `-m` for the task's assigned Codex model; keep the effort pin). Distinct worktrees → distinct Codex job stores → genuine parallelism (verified: companion keys its store on the worktree top-level, one active `task` per store; two Codex tasks in the *same* checkout → second rejected with `Task … is still running`). Claude executors in the same wave still run in the shared checkout. Then integrate + commit at Phase 6. *(The `codex:codex-rescue` subagent is the convenience alternative to raw `codex exec`, but it cedes cwd/base control to the harness, so it does **not** fit controlled parallel waves — reserve it for one-off or serial-in-place Codex work.)*

## Phase 5 — Cross-model review (before close)

**When Codex reviews run depends on the mode — this is load-bearing, not a detail.**

- **Default (`codex_parallel=off`, shared tree, nothing committed): batch the Codex reviews at the wave gate (Phase 6), not per-task-on-completion.** With nothing committed and up to `concurrency` agents editing one tree, there is **no clean per-task base ref**, and `--scope branch`/uncommitted sweeps in **every other in-flight agent's diff** — so the `/codex:adversarial-review` runtime reviews a task against a moving, contaminated tree. What actually isolates a single task's work here is a **generated patch off the stable tree**: once the wave gate is green (Phase 6), the tree is stable, so for each task run `git diff -- <the task's owned files> > review-{id}.patch` and feed **that patch** to a plain `codex exec -s read-only` reviewer. That gives Codex exactly one task's diff with zero contamination from its wave-mates. Reserve the `/codex:adversarial-review` runtime with `--scope branch --base <ref>` for **committed** work.
- **`codex_parallel=on` (worktrees, per-wave commits):** each Codex task has a real committed base and its own worktree, so the `/codex:adversarial-review` runtime with `--base <wave-base> --scope branch` works as written and can run per-task on completion.

**Announce: Phase 5 — Cross-review.** For **Claude** reviewers (both modes) and **Codex** reviewers under `codex_parallel=on`, review each task on completion. For **Codex** reviewers in the default mode, hold the review to the wave gate and drive it off the generated patch (above). Either way, dispatch **one reviewer agent at the task's `reviewer_model`** (a different model than the executor) over **only that task's diff**.

Every reviewer prompt — Claude or Codex — must **embed the ticket's acceptance criteria as text.** A Codex reviewer under `-s read-only` **cannot reach `itr`** (`itr get` fails with `unable to open database file` inside the sandbox), so it cannot self-serve the ticket; if the AC isn't in its prompt it silently reviews against **no acceptance criteria at all.** Paste the full AC (and any "canonical X everywhere" invariants) into the brief.

- **Claude reviewer** (`model: 'opus'` | `'fable'`, read-only): adversarial brief — "here is the ticket's acceptance criteria: «AC». Review this diff for correctness first, then whether it satisfies every AC, then the defect classes this task is prone to; report `file:line · severity(blocker|major|minor|nit) · evidence · fix`; no praise, no style sermons; say 'no findings' if clean."
- **Codex reviewer** (gpt-5.6-terra):
  - **Default mode — feed the generated patch:** `git diff -- <owned files> > review-{id}.patch` off the green stable tree, then `codex exec -s read-only -m gpt-5.6-terra -c model_reasoning_effort="high" "$(cat review-brief-{id}.txt)"` where the brief embeds the AC + the patch (Bash, `run_in_background: true`, label the lane `gpt-5.6-terra:review-{id}`). No worktree, no `--scope branch`.
  - **`codex_parallel=on` — runtime is fine:** `COMPANION=$(ls -d ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | sort -V | tail -1); FOCUS='<AC + task-specific focus>'; node "$COMPANION" adversarial-review --wait --base <wave-base> --scope branch "$FOCUS"` (Bash, `run_in_background: true`, same label). Read-only, no worktree — pass the focus text (AC included) as a single quoted trailing positional (there is no `--focus` flag).

Verdict handling:
- **Clean / only nits** → close the task in the tracker.
- **P0/P1 finding** → **escalate**: redo the task with the next-smarter model (gpt-5.6-terra → gpt-5.6-sol → opus-4.8 → fable-5), splicing the review findings into the new executor's prompt. Log under `Escalations`. Re-review the redo (still cross-model). Two escalations without a clean review → **quarantine** (Phase 7) — **except** when the task was already at the ceiling (opus-4.8 under `fable=off`): there the "escalation" was a same-model redo-with-findings, so before quarantining, surface the ceiling and recommend fable-5 or `gpt-5.6-sol` at ultra (see the escalation ladder). Don't silently quarantine a ceiling task as if the ladder were truly exhausted.
- Record every review verdict under `Cross-model review` in the wave log with source attribution (which model reviewed).

Confirm each reviewer **actually reviewed** — a Codex lane that errored (empty stdout, non-zero exit, auth prompt) is **not** a clean pass; retry it once, else close on the executor's own gate and mark the review **degraded** for that task.

## Phase 6 — Wave gate (between waves)

**Announce: Phase 6 — Wave gate.**

**Default (`codex_parallel=off`) — exactly a plain blitz's wave gate.** All work already landed in the shared checkout, so there is nothing to integrate and nothing to commit:

1. Run the full verify gate yourself in every repo in scope. The wave's agents each ran it too — that shared-tree gate is the self-healing convergence point.

   **The stable-tree wave gate is the authoritative signal — mid-wave LSP diagnostics are not.** While a wave is in flight, several agents are editing one tree, so LSP/language-server flags (`dead_code`, `E0004`, `E0308`, unresolved imports, …) are **stale mid-edit snapshots**: a symbol another agent is still adding reads as undefined, a match another agent will complete reads as non-exhaustive. Do **not** act on, escalate, or report these mid-wave — verify each against the **green stable-tree gate** first, and trust that. Only diagnostics that survive the stable gate are real.
2. **Green** → proceed to Phase 7, then the next wave. **Red** on a slice no task owned → diagnose; small+obvious fix applied yourself and logged under `Interventions`, else stop and surface. Never launch the next wave on a red gate.
3. **No commit.** The user reviews and commits at the end (Phase 8), like a plain blitz.

**`codex_parallel=on` — integrate the Codex worktrees, then commit the wave.** Each completed Codex worktree is harvested via the `worktreePath` the spawn returned; disjoint file sets integrate as a clean union:

1. **Harvest each Codex task's delta** relative to the **wave base**: `git -C <worktreePath> add -A && git -C <worktreePath> diff --cached <wave-base>`, and apply that patch onto the run branch's working tree (where the wave's shared-tree Claude work already sits). Disjoint files → no merge conflicts; a surprise conflict means a file-ownership miss — stop, surface it, fix the plan. (`add -A` first — agents leave edits uncommitted and untracked-inclusive, so plain `git diff` misses new files.)
2. **Run the full verify gate** on the integrated run branch, every repo in scope.
3. **Green → commit the wave to the run branch** (Conventional-Commits, e.g. `chore(crossfire-blitz): wave {N} — {task ids}`), then Phase 7 and the next wave. **This commit is required in this mode** (box below): worktrees fork from a **commit**, so wave N+1's worktrees include wave N's work only if it was committed to the base they fork from. **Red** → as above; never commit or advance on a red gate.

> **Verified worktree mechanics (probed against this harness, plugin 1.0.5).** `isolation: 'worktree'` creates a linked worktree at `<repo>/.claude/worktrees/agent-<id>/` on branch `worktree-agent-<id>`, and the spawn **returns `worktreePath` + `worktreeBranch`** (the harvest handle). Two facts force the `codex_parallel` design: (1) a worktree forks from a **committed base and does NOT include the orchestrator's uncommitted working tree**; (2) the fork base is **not guaranteed to be current HEAD** (observed several commits behind). So don't trust the harness fork base — have the orchestrator create the worktrees itself (`git worktree add <path> <wave-base>`, proven to integrate cleanly and to keep Codex on the intended branch) and commit each green wave to the `crossfire-blitz/{ts}` run branch. This is why the opt-in mode commits where the default (and a plain blitz) does not. Never commit to `main`.

## Phase 7 — Quarantine triage (BLOCKING before next wave)

**Announce: Phase 7 — Triage.** For each quarantined task (escalation ladder exhausted, or a persistent gate failure): **stop and ask the user** for unblock context, retry with it spliced in, then classify — **foundational** (others depend on it) → block the blitz; **trivial** → offer skip (`failed-skipped`) or block. Every quarantined task reaches a terminal state (`closed` / `failed-skipped` / `blitz-blocked`) before the next wave.

## Phase 8 — Stop conditions & final report

**Announce: Phase 8 — Report.** Stop launching waves when: backlog empty · two consecutive zero-close waves · `max_waves` · `time_budget` elapsed · a foundational quarantine blocks progress. Then print:

- **Outcomes** — per task: status, **executor model**, **reviewer model**, whether it **escalated** (and to what).
- **Model spend** — count of tasks per executor model; note that Codex tokens (gpt-5.6-terra et al.) are free and **invisible to any Workflow `budget.spent()`** (only Claude tokens count).
- **Cross-model review summary** — findings caught by the review gate, and the escalations they triggered (high-value: this is where cheap-model misses got caught).
- **Wave timeline**, **Interventions log**, **Escalations log**, **Diff summary**, **Next steps**.
  - Default: `git diff --stat` of the uncommitted working tree (nothing was committed — the user reviews and commits).
  - `codex_parallel=on`: `git diff --stat main..crossfire-blitz/{ts}`, and name the **run branch** holding the per-wave commits — ask the user how to land it (squash-merge, keep, or discard).

Default mode makes **no commits** (like a plain blitz). Under `codex_parallel=on`, per-wave commits go to the **run branch only** — never to `main`, never pushed, never a PR (unless the user asks).

---

## If a run is orchestrated via the Workflow tool

crossfire-blitz maps cleanly onto a Workflow `pipeline(tasks, execute, review)`:

- **Codex stages never use a raw `model`** (the param takes only Claude models). Wrap Codex in `agent(prompt, {model: 'sonnet', effort: 'low', schema, label: 'gpt-5.6-terra:...'})` whose Bash call is `codex exec -C <dir> -m gpt-5.6-terra -c model_reasoning_effort="high"` (swap `-m` for the task's assigned Codex model; the `-c model_reasoning_effort` pin is mandatory — a bare `codex exec` inherits the config-default effort and hard-fails when that's `ultra`/`max` on gpt-5.5, see the effort gotcha). Default: `<dir>` is the shared checkout and the pipeline schedules **≤1 Codex task per wave**. Under `codex_parallel`: `<dir>` is an orchestrator-made worktree off the wave base — `-C` puts Codex on that exact branch, and distinct worktrees give distinct job stores so they parallelize. `agentType: 'codex:codex-rescue'` cedes the checkout to the harness, so don't use it for controlled waves. Review goes through the `/codex:adversarial-review` companion (`node "$COMPANION" adversarial-review …` via Bash), **never** through codex-rescue — that wrapper only forwards `task`, not `review`.
- **Only under `codex_parallel` do Codex stages need worktrees.** Default keeps one Codex task per wave in the shared checkout (no worktree, no commit). Claude executors always run in the shared checkout regardless of mode — never worktree them (that's what preserves self-healing).
- **Budgets only count Claude tokens.** Codex work is free and invisible to `budget.spent()` — don't size the fleet off Codex cost, and don't expect Codex waves to move the budget needle.
- Schema-returning wrapper/reviewer agents: keep the schema payload small (task_id, status, diff_summary, gate_tail, findings) — oversized returns fail StructuredOutput. Never pin a Haiku-class model for structured output; the wrapper is `sonnet`.
- Workflow scripts are plain JS (no TS syntax); `node --check` before a large run, and resume with `{scriptPath, resumeFromRunId}` on a mid-run error rather than restarting.

---

## Principles

- **The model is a per-task decision.** Route by the work, not the session: bulk → gpt-5.6-terra, taste-critical → opus/fable, ambiguous → opus. Cost is a tie-breaker only; intelligence > taste > cost for anything that ships.
- **A different model reviews than executed — this gate is load-bearing, not ceremony.** No model grades its own homework. **Executor self-reports routinely hide real defects behind a confident "PASS / gate green"** — observed: a task that reported "starts at 0.0" didn't, one that claimed "consumers audited" hadn't, one silently skipped a file its AC covered. A green `cargo test` and the executor's own confidence *both* missed P1s that the different-model review caught. The cross-model gate is the thing that catches bugs the executor and its unit tests agree aren't there — treat a clean self-report as unverified until a different model has looked.
- **Escalate without asking.** A real defect from a cheap model's output means redo it with a smarter one — judge the output, not the price tag. Escalating cost beats shipping the miss.
- **Stay in the shared tree by default; reach for worktrees only when Codex must parallelize.** One Codex task per wave runs in the shared checkout alongside the Claude agents — keeping blitz's self-healing and no-commit. Worktrees (and the per-wave commits they force) are the price of *several* Codex tasks per wave, paid only under `codex_parallel`.
- **Disjoint file ownership is the invariant in both modes.** It's what lets shared-tree agents not collide, and what lets worktree diffs integrate conflict-free.
- **Confirm twice, run once.** Phase 0 (config + model availability) and Phase 3 (wave plan + routing) gate on the user; Phases 4–8 run autonomously unless a red gate or hard quarantine intervenes.

## Don't

- Don't route user-facing / taste-critical work (taste must be > 7) to a Codex generalist (terra/sol/luna/gpt-5.5) or sonnet-5 — that's what opus-4.8 and fable-5 are for.
- Don't use Haiku for anything — executor, reviewer, wrapper, or planner.
- Don't spend fable-5 under `fable=off` — route taste work to opus-4.8, stop the escalation ladder at opus, and when a task requests fable surface the `AskUserQuestion` (with **off** as the first/default option) instead of silently enabling it. Never default that question to "on" or auto-answer it "on" in a headless run — off-first exists precisely so unattended runs never spend fable by accident.
- Don't run a Codex executor without a `codex exec` wrapper agent and a model-name label (e.g. `gpt-5.6-terra:`) — a raw `model` param can't reach a Codex model, and an unlabeled lane hides which worker actually ran.
- Don't put more than one Codex task in a wave in the default mode, and don't run two Codex tasks in the same checkout in any mode — the companion rejects the second (`Task … is still running`, one active task per checkout). Parallel Codex needs `codex_parallel` + a worktree each.
- Don't worktree the Claude executors — they run in the shared checkout so self-healing works; only Codex tasks under `codex_parallel` get worktrees.
- Don't route a Codex review through `codex:codex-rescue` — that wrapper only forwards `task`; reviews go through the `/codex:adversarial-review` companion.
- Don't let a model review its own output, and don't fold an errored Codex review lane into synthesis as a clean pass.
- Don't run a bare `codex exec` without `-c model_reasoning_effort="high"` — it inherits the config-default effort and hard-fails when that's `ultra`/`max` on gpt-5.5, blocking the whole Codex lane on the first task.
- Don't run a **risky** task on gpt-5.6-luna at anything but `ultra`, or on gpt-5.6-terra at `low`/`medium` (high or ultra only) — and don't run a risky task cheap on a Codex model at all; defer it to `sonnet` instead. Low/medium Codex effort is for cheap mechanical work only.
- Don't use `--scope branch` / the `/codex:adversarial-review` runtime for per-task Codex review in the default (uncommitted, shared-tree) mode — with nothing committed it sweeps in every other agent's in-flight diff. Batch Codex reviews at the green wave gate off a generated `git diff -- <owned files>` patch fed to `codex exec -s read-only`; reserve the runtime for `codex_parallel`/committed work.
- Don't hand a Codex reviewer a task without embedding the ticket's acceptance criteria as text — under `-s read-only` it can't reach `itr` (`unable to open database file`), so a missing AC means it silently reviews against nothing.
- Don't act on, escalate, or report **mid-wave** LSP diagnostics in the shared tree — they're stale mid-edit snapshots; the green stable-tree wave gate is the authoritative signal.
- Don't quarantine a ceiling-executed (opus under `fable=off`) task as "escalation exhausted" without first recommending fable-5 or `gpt-5.6-sol` at ultra — `fable=off` never silences a ceiling, it only declines to spend fable unattended.
- Don't leave a shared `.md` clique serializing the plan when `defer_docs` would collapse it — offer the consolidated docs wave.
- Don't advance a wave on a red gate, and don't silently drop a quarantined task — every task ends with an `Outcomes` entry naming its executor and reviewer.
- Don't commit in the default mode (like a plain blitz — the user commits at the end). Under `codex_parallel`, don't try to carry a wave forward through the **uncommitted** tree (worktrees fork from a commit and won't see it), and commit **only** to the `crossfire-blitz/{ts}` run branch — never `main`, never pushed.
