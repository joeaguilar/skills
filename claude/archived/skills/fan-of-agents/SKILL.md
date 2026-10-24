---
name: fan-of-agents
description: "Cut ONE task into aspects and fire 2–5 subagents (`--agents=N`), each owning a different aspect editing files on disk by default, then synthesize what lands into one deliverable; tolerates misses. Trigger: `/fan-of-agents`, \"fan out agents on this\", \"have N agents each take an aspect\". NOT to clear a multi-task backlog in parallel (use /blitz)."
---

# /fan-of-agents — cut one task, throw the fan, keep what lands

One task in. The orchestrator cuts it into aspects, throws one agent per aspect — each aimed at a different vital point — and synthesizes whatever returns into one deliverable.

**Ninja posture.** Not every knife hits; one or two landing is enough. So: infer the cut and fire — **no approval gate**. Throw and forget — **no retry, no resume, no babysitting**. A missed agent is a missed knife, not a crisis: synthesize from the hits, note the misses in one line, move on. Only whiff = **zero** agents returned.

## The loop at a glance

```
Frame ....... infer the cut, N knives at N vital points        [silent — pause only on --confirm]
Throw ....... N parallel agents, one slice each, fire-and-forget
Land ........ take what returns; misses & stragglers = misses (no heal, no retry)
              floor: ≥1 returned → synthesize │ 0 returned → report the whiff, stop
Synthesize .. integrate the hits into ONE deliverable; reconcile clashes
Deliver ..... result + 1-line hit/miss map
```

## Slash invocation

```
/fan-of-agents <task> [--agents=N] [--strategy=...] [--out=path] [--confirm]
```

| Arg | Default | Meaning |
|---|---|---|
| `<task>` | — | The single task. Inline prose, a spec path, or "the thing we just discussed". |
| `--agents=N` | `5` | Knives thrown. **Clamp 2–5** (`>5` → clamp 5 + warn: synthesis degrades past ~5; `<2` → bump 2). |
| `--strategy=...` | auto | Force the cut: `component`, `dimension`, `perspective`, `subquestion`, `layer` (Phase 0 menu). |
| `--out=path` | conversation | Persist the synthesis to `path`. Default → deliver inline. |
| `--confirm` | off | The **only** way to add a gate — print the strike plan and wait before throwing. Default fires without asking. |

Unsupplied flags resolved in Phase 0. Output is terse throughout — the synthesis is the product, not the narration.

## Roles & artifacts

- **You** — throw the task. No live decisions unless `--confirm`.
- **Orchestrator** — cuts, throws, takes what lands, synthesizes. Sole author of the deliverable.
- **Fan agents** — one per aspect, blind to siblings except the boundary note handed to each, return a structured portion.

No tracker, no graph, no sprint folders — this skill stands alone, depends only on its own fan. Artifacts: an in-memory strike plan + the synthesis (inline, or `--out`).

## Voice — silent as the wind

Stay in character and stay quiet. The skill surfaces **only twice**: once when the blades fly, once when they return. Nothing in between — no progress chatter, no per-agent play-by-play. Use these templates verbatim (fill the `{slots}` — slots are the contract; the flavor is not). The `忍` glyph is the signature; keep lines short.

**Throw** (Phase 0, on firing):
```
忍  {N} blades to the wind · {strategy}
    {A1 aspect} · {A2 aspect} · … · {AN aspect}            [→ out=path]
```

**The pause** (only when `--confirm`):
```
忍  the strike, before it flies — {N} blades · {strategy}
    A1 {aspect}  ↳ {scope}   ╎ not yours: {boundaries}
    …
    speak, and they fly.
```

**Return** (Phase 4, on delivery — precedes the synthesis):
```
忍  {hits}/{N} returned from the dark
    A1 {aspect}  ✓ {one-phrase contribution}   ({conf})
    A3 {aspect}  ✗ lost to the dark
    ─ open: {unreconciled clashes / unfilled gaps, or omit}
```

**Whiff** (zero returned — the only hard stop):
```
忍  the dark kept them all — {N} thrown, none returned.
    {why}
```

---

## Phase 0 — Frame (no gate)

Resolve `--agents` (clamp 2–5), `--strategy`, `--out`, `--confirm`. Read the task once.

**Pick the cut** — the partition that puts each knife on a different vital point:

| Strategy | Cut by… | Best when |
|---|---|---|
| `component` | distinct modules / files / subsystems | task spans separable parts |
| `dimension` | one artifact, different lenses (correctness, perf, security, a11y, docs, tests) | one thing, many angles |
| `perspective` | rival approaches / viewpoints (N candidate designs; skeptic / advocate / operator / user) | wide answer space — divergent takes win |
| `subquestion` | disjoint sub-questions of one research question | broad question splits clean |
| `layer` | pipeline stages (ingest → transform → serve; data → logic → UI) | task is a separable chain |

`--strategy` set → use it. Fewer clean aspects than `N` → throw fewer (don't manufacture filler slices). Blend strategies when one cut won't cover.

**Orthogonality — disjoint file sets, always:** agents edit files, so disjoint **file sets** are mandatory — two agents editing one file clobber each other. Aim each knife at a distinct point; files that can't be split cleanly → fold into one agent's slice or drop a knife. This is the one hard rule, always in force.

**Strike line** — emit the **Throw** template (see Voice), then throw immediately. `--confirm` → emit **The pause** template instead and **wait** for go. That flag is the only pause.

---

## Phase 1 — Throw

Spawn all N agents **in parallel** — one Agent call per slice, single batch, concurrent:

- `subagent_type: general-purpose` (specialized type only if one squarely fits a slice).
- `run_in_background: true`.
- `description`: e.g. `Fan A2: <aspect>`.
- `prompt`: the template below.

### Per-agent prompt template

```
盟約 MEIYAKU — you are sworn. Four laws, no exceptions:
1. ABSOLUTE FOCUS — no filler, no pleasantries, nothing unasked. The work, directly.
2. SHADOW EFFICIENCY — a clean blade strike: minimal, optimized, zero bloat, no needless dependency.
3. UNYIELDING DISCIPLINE — every edge case, error state, and vulnerability handled. Leave no tracks: no bugs, no debris, no dead code.
4. FAITHFUL EXECUTION — the spec exactly; assume nothing, invent nothing, verify before you claim.
Break a law and the clan falls. Execute.

You are knife {i} of {N} on ONE aspect of a larger task. Siblings own the other
aspects in parallel — stay inside your slice; do NOT try to solve the whole task.

Whole task (context only):
{task restatement}

YOUR ASPECT — {aspect title}:
{scope — concrete}

OUT OF SCOPE (siblings own these — don't cover them):
{boundary notes — sibling aspects}

Files you OWN (edit only these): {owned file set}
Do NOT edit/move/reformat anything outside this set — a sibling is in it now and a
project-wide formatter or stray edit clobbers their work. Need a change in a sibling's
file? Don't — list it under "cross-slice needs". Do NOT commit, push, branch, or PR.

Deliver back EXACTLY:
{deliverable shape — e.g. "findings list, each file:line + severity + fix"
 │ "1-paragraph recommendation + 3 strongest supporting points"
 │ "the code change (on disk) + 5-line summary"}

Close with:
  - Confidence: high | medium | low + why.
  - Cross-slice needs: anything that belongs to a sibling, or "none".
  - Gaps: anything in your aspect you couldn't resolve, or "none".

Your final message IS your portion — return data, not chat. Be self-contained.
```

File sets stay disjoint. Fan agents never commit — the orchestrator commits what lands at the end, unless the user asked not to.

---

## Phase 2 — Land (take what returns)

Event-driven. Collect each portion as it lands — capture verbatim + its Confidence / Cross-slice needs / Gaps.

- **Returned** → it's a hit. Keep it.
- **Failed, errored, denied, or stalled** → a miss. **No retry, no resume, no respawn.** One-line note, move on. (The fan's whole premise: misses are expected and cheap.)
- **Whole fan misses identically at once** (API 429/overloaded cascade) → that's infrastructure, not the cut. Re-fan once at half width before calling a Whiff.
- **Straggler** → don't block the synthesis on it. Synthesize once the bulk has landed; a late return folds in only if it arrives before you finish, else it's a miss.
- **Overran its slice** (touched a sibling's scope/files) → keep the in-scope part, drop the rest.

**Floor:** ≥1 hit → synthesize. **0 hits** → the only real failure: emit the **Whiff** template (see Voice) and stop.

---

## Phase 3 — Synthesize

Orchestrator's own work — not a hand-off. Integrate the hits into the one deliverable from Phase 0:

1. **Merge** in a coherent order — integrate, don't transcribe ("A1 said… A2 said…" is a failure).
2. **Reconcile clashes** — two hits disagree → resolve, or flag the disagreement. Never silently pick one.
3. **Dedupe** overlap from redundant knives into one statement.
4. **Route** each cross-slice need to the hit that owns it.
5. **Gaps** — note any aspect that missed or fell between slices. Fill only if trivial and cheap; otherwise list it as open. Don't re-throw the fan — that's babysitting.

Edits are already on disk; synthesis = the reconciliation pass + a unified change summary.

---

## Phase 4 — Deliver

Terse. Emit, in order:

- **Return** template (see Voice) — the `{hits}/{N}` map, including any `open:` clashes/gaps.
- **The synthesis** — integrated result (to `--out` if set, else inline).
- **Commit** — the orchestrator commits what landed; skip only if the user asked not to.

---

## Principles

- **Failure-tolerant by design.** Not every knife hits; one or two is enough. Misses are noted, never healed.
- **Fire without a gate.** Infer the cut and throw. `--confirm` is the only pause; default never asks.
- **Run straight through.** Frame → throw → land → synthesize → deliver, no voluntary stop. Only hard stop: zero hits.
- **Each knife, a different vital point.** The cut aims agents at distinct facets; agents edit files, so disjoint file sets are always mandatory — two knives in one file clobber each other.
- **A task with no disk surface** (a pure question, an analysis) has nothing to land — the synthesized answer is the deliverable, not a miss.
- **Synthesis, not concatenation.** The deliverable integrates the hits; N stapled portions is a failure.
- **Say less.** One strike line, one deliverable, one map. The synthesis is the product, not the narration.
- **Right-size the fan.** Default 5, clamp 2–5; fewer aspects → fewer knives.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes.

## Don't

- Don't gate, ask, or pause unless `--confirm` is set.
- Don't retry, resume, or respawn a missed agent — a miss is a miss.
- Don't block the synthesis waiting on a straggler.
- Don't let an agent solve the whole task — each stays in its slice.
- Don't give two agents a shared file.
- Don't hand back N raw portions — always synthesize.
- Don't push or PR — commits stay local.
- Don't exceed 5 agents — synthesis quality degrades past what one orchestrator integrates well.
