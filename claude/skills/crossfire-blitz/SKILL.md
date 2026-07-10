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
/crossfire-blitz [tracker=...] [verify=...] [concurrency=N] [max_waves=N] [time_budget=...] [repos=...] [fable=off|on] [--fable] [review=on|off] [codex_parallel=off|on]
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

---

## The routing rubric (the core of this skill)

Every model score below is **higher = better**; `cost` is what the user pays, so a higher cost score means **cheaper**. Never use Haiku for anything.

| Model | Cost | Intelligence | Taste | Reached via |
|---|---|---|---|---|
| gpt-5.6-sol | 5 | 9 | 6 | Codex — `codex exec -m gpt-5.6-sol` (the smart Codex escalation rung). |
| gpt-5.6-terra | 6 | 8 | 5 | Codex — a `sonnet` wrapper agent running `codex exec -C <dir> -m gpt-5.6-terra` (implementation), `/codex:adversarial-review` runtime (review). **The default Codex generalist / bulk workhorse.** |
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

**Escalation ladder** (standing permission for the first three rungs — no need to ask): a task whose review surfaces a real (P0/P1) defect is **redone by the next-smarter model**: gpt-5.6-terra → **gpt-5.6-sol** → opus-4.8 → **fable-5**. The **fable rung is gated**: under `fable=off`, escalation tops out at opus-4.8 — if opus's redo still fails review, **quarantine** it (Phase 7) rather than silently spending fable, or surface the Fable-gate `AskUserQuestion` for that task. Under `fable=on`, escalate straight through to fable. Judge the output, not the price tag — escalating cost beats shipping the miss, *within the fable budget the user set.*

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

**Claude executors** (Agent tool: `model: 'opus'` | `'fable'` | `'sonnet'`, `run_in_background: true`) — run in the **shared checkout** (no isolation), exactly like a plain blitz. Disjoint file ownership keeps them from colliding, and each one's full-repo gate is the self-healing backstop for the whole wave.

**Codex executor** (default model **gpt-5.6-terra**) — the `model` param can't reach a Codex model, so delegate to Codex via a thin Claude wrapper agent whose one Bash call runs `codex exec -m <codex-model>`. **Via the `Agent` tool:** `{subagent_type: 'general-purpose', model: 'sonnet', run_in_background: true, description: 'gpt-5.6-terra:task-{id}'}` — the roster name comes from **`description`** (the Agent tool has no `label` or `effort` param; those are `Workflow.agent()` options). The roster shows the wrapper's Claude model (*sonnet*), so the `gpt-5.6-terra:` prefix in the description is the only signal which Codex model actually ran — and it's what makes the Codex lane show up as an **agent** rather than a bare background *command* (verified). In a Workflow script use the full `agent(prompt, {model:'sonnet', effort:'low', label:'gpt-5.6-terra:...', schema})`. *(Running `codex exec` directly from the orchestrator via Bash also works, but then the lane appears as a background command, not an agent.)*

- **Default (`codex_parallel=off`) — one Codex task per wave, in the shared checkout.** The wrapper runs `codex exec -C <shared-checkout> -m gpt-5.6-terra -s workspace-write "$(cat "$PROMPT")"` (swap `-m` for the task's assigned Codex model) — Codex edits the shared tree in place, concurrently with the wave's Claude agents (disjoint files → no collision), and its own verify-gate run participates in self-healing just like a Claude agent. Nothing to integrate, nothing to commit. Because the wave holds only one Codex task (Phase 2 rule d), the companion's one-active-task-per-checkout guard never trips.
- **`codex_parallel=on` — several Codex tasks per wave, each in its own worktree.** See the box below; this is the only path that needs worktrees, a run branch, and per-wave commits.

Codex can exceed Bash's 10-min window — pass an explicit `timeout` on the wrapper's Bash call, or background + poll for the report file. Add `--skip-git-repo-check` only if the target isn't a git repo. Use `--output-schema "$SCHEMA"` + `schema` on the wrapper when you want a validated machine-readable return.

> **`codex_parallel=on` — worktree Codex (opt-in).** `codex exec -C <dir>` runs Codex on **exactly the branch at `<dir>`** (verified: `-C` a worktree on branch X edits X, leaves `main` untouched), so the orchestrator controls the base — the harness `isolation: 'worktree'` fork base is **not** controllable (Phase 6 box). Steps: (1) establish a **wave base** — a committed HEAD on the `crossfire-blitz/{ts}` run branch (Wave 1 branches from the current commit; commit any orchestrator setup first, since worktrees don't see uncommitted work — later waves use the commit Phase 6 made); (2) for each Codex task the orchestrator runs `git worktree add <path> <wave-base>` itself and the wrapper runs `codex exec -C <path> -m gpt-5.6-terra -s workspace-write --output-schema "$SCHEMA" "$(cat "$PROMPT")"` (swap `-m` for the task's assigned Codex model). Distinct worktrees → distinct Codex job stores → genuine parallelism (verified: companion keys its store on the worktree top-level, one active `task` per store; two Codex tasks in the *same* checkout → second rejected with `Task … is still running`). Claude executors in the same wave still run in the shared checkout. Then integrate + commit at Phase 6. *(The `codex:codex-rescue` subagent is the convenience alternative to raw `codex exec`, but it cedes cwd/base control to the harness, so it does **not** fit controlled parallel waves — reserve it for one-off or serial-in-place Codex work.)*

## Phase 5 — Cross-model review (before close)

**Announce: Phase 5 — Cross-review.** When an executor reports its task complete and gate-green (in the shared tree, or its worktree under `codex_parallel`), and `review=on`: dispatch **one reviewer agent at the task's `reviewer_model`** (a different model than the executor) over **only that task's diff** (isolate it with `git diff -- <the task's owned files>`).

- **Claude reviewer** (`model: 'opus'` | `'fable'`, read-only): adversarial brief — "review this diff for correctness first, then the defect classes this task is prone to; report `file:line · severity(blocker|major|minor|nit) · evidence · fix`; no praise, no style sermons; say 'no findings' if clean."
- **Codex reviewer** (gpt-5.6-terra) — run the **`/codex:adversarial-review` runtime** scoped to the task's diff (the same companion crossfire-review uses): `COMPANION=$(ls -d ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | sort -V | tail -1); FOCUS='<task-specific focus>'; node "$COMPANION" adversarial-review --wait --base <task-base-ref> --scope branch "$FOCUS"` (Bash, `run_in_background: true`, label the lane `gpt-5.6-terra:review-{id}`). Read-only, no worktree — pass the focus text as a single quoted trailing positional (there is no `--focus` flag). For work the runtime doesn't cover, raw `codex exec -s read-only -m gpt-5.6-terra` is the fallback.

Verdict handling:
- **Clean / only nits** → close the task in the tracker.
- **P0/P1 finding** → **escalate**: redo the task with the next-smarter model (gpt-5.6-terra → gpt-5.6-sol → opus-4.8 → fable-5), splicing the review findings into the new executor's prompt. Log under `Escalations`. Re-review the redo (still cross-model). Two escalations without a clean review → **quarantine** (Phase 7).
- Record every review verdict under `Cross-model review` in the wave log with source attribution (which model reviewed).

Confirm each reviewer **actually reviewed** — a Codex lane that errored (empty stdout, non-zero exit, auth prompt) is **not** a clean pass; retry it once, else close on the executor's own gate and mark the review **degraded** for that task.

## Phase 6 — Wave gate (between waves)

**Announce: Phase 6 — Wave gate.**

**Default (`codex_parallel=off`) — exactly a plain blitz's wave gate.** All work already landed in the shared checkout, so there is nothing to integrate and nothing to commit:

1. Run the full verify gate yourself in every repo in scope. The wave's agents each ran it too — that shared-tree gate is the self-healing convergence point.
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

- **Codex stages never use a raw `model`** (the param takes only Claude models). Wrap Codex in `agent(prompt, {model: 'sonnet', effort: 'low', schema, label: 'gpt-5.6-terra:...'})` whose Bash call is `codex exec -C <dir> -m gpt-5.6-terra` (swap `-m` for the task's assigned Codex model). Default: `<dir>` is the shared checkout and the pipeline schedules **≤1 Codex task per wave**. Under `codex_parallel`: `<dir>` is an orchestrator-made worktree off the wave base — `-C` puts Codex on that exact branch, and distinct worktrees give distinct job stores so they parallelize. `agentType: 'codex:codex-rescue'` cedes the checkout to the harness, so don't use it for controlled waves. Review goes through the `/codex:adversarial-review` companion (`node "$COMPANION" adversarial-review …` via Bash), **never** through codex-rescue — that wrapper only forwards `task`, not `review`.
- **Only under `codex_parallel` do Codex stages need worktrees.** Default keeps one Codex task per wave in the shared checkout (no worktree, no commit). Claude executors always run in the shared checkout regardless of mode — never worktree them (that's what preserves self-healing).
- **Budgets only count Claude tokens.** Codex work is free and invisible to `budget.spent()` — don't size the fleet off Codex cost, and don't expect Codex waves to move the budget needle.
- Schema-returning wrapper/reviewer agents: keep the schema payload small (task_id, status, diff_summary, gate_tail, findings) — oversized returns fail StructuredOutput. Never pin a Haiku-class model for structured output; the wrapper is `sonnet`.
- Workflow scripts are plain JS (no TS syntax); `node --check` before a large run, and resume with `{scriptPath, resumeFromRunId}` on a mid-run error rather than restarting.

---

## Principles

- **The model is a per-task decision.** Route by the work, not the session: bulk → gpt-5.6-terra, taste-critical → opus/fable, ambiguous → opus. Cost is a tie-breaker only; intelligence > taste > cost for anything that ships.
- **A different model reviews than executed.** No model grades its own homework — the cross-model gate is where a cheap model's miss gets caught.
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
- Don't advance a wave on a red gate, and don't silently drop a quarantined task — every task ends with an `Outcomes` entry naming its executor and reviewer.
- Don't commit in the default mode (like a plain blitz — the user commits at the end). Under `codex_parallel`, don't try to carry a wave forward through the **uncommitted** tree (worktrees fork from a commit and won't see it), and commit **only** to the `crossfire-blitz/{ts}` run branch — never `main`, never pushed.
