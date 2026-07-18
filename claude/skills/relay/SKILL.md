---
name: relay
description: "Run ONE task as an ordered chain of specialist stages — research → design → build → test — each stage's output feeding the next toward a final deliverable — build/code stages land their edits on disk. Trigger: `/relay`, \"run this as a pipeline\", \"one stage feeds the next\". NOT for parallel facets synthesized at once (use /fan-of-agents)."
---

# /relay — pass the scroll, hand to hand, each seal a stage

One task in. The orchestrator cuts it into ordered stages — each a different specialty — and runs them one at a time: stage A's output is stage B's input, B's is C's, and the last stage's output IS the deliverable. The scroll is carried forward, each runner adding one seal.

**Ninja posture.** Infer the chain and run it — **no gate**. This blade is **NOT failure-tolerant**: a stage that fails BREAKS the chain. Do NOT feed broken or garbage output downstream — a poisoned scroll ruins every stage after it. On a stage failure: **one bounded retry** of that stage (failure noted), then if it still fails, **STOP and surface** — the relay halts at the dropped baton. A broken middle link is a real stop, not a tolerated miss.

## The loop at a glance

```
Frame ...... infer the stages, name the carried scroll              [silent — pause only on --confirm]
Run ........ ↻ stage N (foreground, ONE at a time):
              in = stage N-1's output · transform · out = input for stage N+1
              stage fails → 1 retry (failure noted) → still fails → DROP baton, STOP
Carry ...... last stage's output IS the deliverable; the scroll is what reached the end
Deliver .... baton's journey (each stage ✓ + what it added) + final deliverable
```

## Slash invocation

```
/relay <task> [--stages="research,design,build,test"] [--out=path] [--confirm]
```

| Arg | Default | Meaning |
|---|---|---|
| `<task>` | — | The single task to chain. Inline prose, a spec path, or "the thing we just discussed". |
| `--stages="a,b,c"` | inferred | The ordered chain — comma-separated specialist stages. Unset → orchestrator infers the stages from the task. |
| `--out=path` | conversation | Persist the final deliverable to `path`. Default → deliver inline. |
| `--confirm` | off | The **only** gate — print the chain and wait before the first stage. Default runs without asking. |

Output is terse — the final deliverable is the product, not the per-stage narration.

## Roles & artifacts

- **You** — throw the task. No live decisions unless `--confirm`.
- **Orchestrator** — infers the chain, runs each stage in order, carries the scroll forward, surfaces a dropped baton. Sole holder of the seam between stages.
- **Stage agents** — one per stage, each a different specialty. Each receives the prior stage's output as input, transforms it, and produces the input the next stage needs. Blind to stages other than its own input + its required output.

No tracker/graph/sprint deps — stands alone. Artifacts: the carried scroll (passed stage to stage in memory) + the final deliverable (inline, or `--out`).

## Voice — the relay / the transmission (伝)

Speak twice: when the scroll is thrown, when it reaches the end (or when the baton drops). Silent through the stages. `{slots}` are the contract; the flavor is mouth. 印 = 伝.

**Throw** (Phase 0, on starting the chain):
```
伝  the scroll begins · {K} stages, hand to hand
    {S1} → {S2} → … → {SK}                                 [→ out=path]
    last seal is the deliverable.
```

**The pause** (only `--confirm`):
```
伝  before the first runner — {K} stages, each feeds the next:
    {S1} ↳ {what it carries forward} → {S2} ↳ {…} → … → {SK}
    speak, and the scroll moves.
```

**Return** (Phase 3, on delivery — precedes the final deliverable):
```
伝  the scroll reached the end · {K}/{K} stages sealed
    {S1}  ✓ {what it added}
    {S2}  ✓ {what it added}
    {SK}  ✓ {what it added — this is the deliverable}
    ─ open: {caveats carried through, or omit}
```

**Dropped baton** (a stage hard-failed — the chain halts, the only hard stop):
```
伝  the baton fell at {Sx} ({x}/{K}) — chain halted, retry spent.
    reached: {S1..Sx-1 sealed}     held by {Sx}: {what it received}
    why: {the failure}
    to resume: {what {Sx} needs — fix the input, the stage, or run it by hand}
```

---

## Phase 0 — Frame (no gate)

Resolve `--stages`, `--out`, `--confirm`. Read the task once.

**Lay the chain** — order the work as a dependent sequence where each stage needs the prior stage's result:

- `--stages` set → use that order, each token a stage.
- Unset → infer the chain. The canonical shape is `research → design → build → test`, but cut to the task: each stage a *different specialty*, each consuming what the one before produced. Don't manufacture stages the task doesn't need; a two-stage chain is a valid relay.
- **Order is the contract.** A stage may only depend on stages before it. If two pieces of work don't depend on each other, they are not a relay — keep the chain strictly dependent.
- Name the **carried scroll** — what flows down the chain (findings → a design doc → a built change → a test report). Each stage transforms it forward.

Emit the **Throw** template, then run. `--confirm` → emit **The pause** and **wait** for go. That flag is the only pause.

---

## Phase 1 — Run the chain (serial, one at a time)

Run the stages **strictly in order, one at a time, in the FOREGROUND** — stage N+1 cannot start until stage N's output is in hand. This is the opposite of a parallel fan: there is exactly one runner on the scroll at any moment.

For each stage, spawn ONE agent — `subagent_type: general-purpose` (a specialized type only if one squarely fits the stage), `run_in_background: false` (foreground — you wait for it before the next stage), `description` e.g. `Relay stage {n}: {stage role}`. Hand it the prompt below, parameterized by the stage role + the carried input + what it must produce next.

### Per-stage prompt template (brain — emit verbatim, fill the slots)

```
盟約 MEIYAKU — you are sworn. Four laws, no exceptions:
1. ABSOLUTE FOCUS — no filler, no pleasantries, nothing unasked. The work, directly.
2. SHADOW EFFICIENCY — a clean blade strike: minimal, optimized, zero bloat, no needless dependency.
3. UNYIELDING DISCIPLINE — every edge case, error state, and vulnerability handled. Leave no tracks: no bugs, no debris, no dead code.
4. FAITHFUL EXECUTION — the spec exactly; assume nothing, invent nothing, verify before you claim.
Break a law and the clan falls. Execute.

You are stage {n} of {K} in a SERIAL relay: {stage role}.
The work is carried hand to hand — you receive the prior stage's output, transform
it, and produce exactly the input the NEXT stage needs. You are NOT solving the
whole task — only your one transform. Stages do not run in parallel; you hold the
scroll alone right now.

Whole task (context only):
{task restatement}

YOUR STAGE — {stage role}:
{what this stage's specialty must do to the carried work}

INPUT — the scroll handed to you by stage {n-1} ({prior stage role}):
{the carried work / output from the previous stage verbatim}
{if n == 1: "You are the first runner — the input is the raw task above."}

PRODUCE — what stage {n+1} ({next stage role}) needs as ITS input:
{deliverable shape for the next stage — concrete, e.g.
 "a findings brief: the constraints, prior art, and open questions the design must resolve"
 │ "a design doc the build stage can implement directly: components, interfaces, decisions"
 │ "the built change + a 5-line summary the test stage can verify against"
 │ "a test report: what passed, what failed, evidence"}
{if n == K: "You are the last runner — your output IS the final deliverable."}

{if this stage builds/codes — has a disk surface:}
You edit files to do your stage's work — that IS your deliverable. Edit only what
your stage needs; leave the rest clean. Do NOT commit, push, branch, or PR — the
orchestrator owns git and commits at the end. Note every path you touched so the next stage can verify it.
{if this stage researches/designs — no disk surface: your scroll of words IS the
deliverable; nothing to land.}

Close with:
  - Status: complete | failed (+ why) — be honest; a false "complete" poisons every
    stage after you.
  - Carried forward: the output above, self-contained, ready for the next runner.
  - Open: anything the next stage must know that you couldn't resolve, or "none".

Your final message IS the scroll you pass on — return the transformed work, not chat.
```

**The hand-off is the whole brain:** stage N's `Carried forward` becomes stage N+1's `INPUT` slot verbatim. The orchestrator holds that seam — it does not let a stage see anything but its input and its required output.

---

## Phase 2 — Carry or drop (the Stop rules)

After each stage returns, the orchestrator inspects the scroll **before passing it on** — a broken link must not move downstream:

- **Stage complete, output sound** → carry it forward: its `Carried forward` becomes the next stage's `INPUT`. Advance to the next stage.
- **Stage failed, errored, stalled, or returned garbage/empty/off-target output** → the baton is at risk. **ONE bounded retry** of *that same stage* — re-spawn it once with the failure noted in the prompt ("Prior attempt failed: {why} — correct it").
  - Retry succeeds → carry forward, advance.
  - Retry still fails → **the baton dropped.** Do NOT fabricate the stage's output, do NOT skip it, do NOT feed the broken result downstream. **STOP the relay** and emit the **Dropped baton** template. The chain halts here.

**Stop** when: the last stage seals (→ chain complete, deliver) · a stage hard-fails after its one retry (→ dropped baton, halt and surface). There is no "tolerate the miss and continue" — a serial chain has no such mode.

---

## Phase 3 — Deliver

Terse. Emit, in order:

- **Return** template (chain complete) — the per-stage `✓` journey, ending at the last stage whose output **is** the deliverable. (Or, if the chain broke, the **Dropped baton** template — and stop here.)
- **The final deliverable** — the last stage's output (to `--out` if set, else inline; a build/code final stage's edits already landed on disk, a research/design final stage's scroll is the deliverable).
- **Next step** — the orchestrator commits the landed work (unless the user requested no commit); the user reviews.

The deliverable is the scroll that survived the whole chain — not a synthesis of stages, not a vote. Each stage already transformed it; the end is the product.

---

## Principles

- **Split by stage, flow serial.** Each stage a different specialty; they run one at a time, never in parallel. Order is the contract — a stage only depends on stages before it.
- **Transform-through, not synthesize.** The scroll is carried forward and reshaped at each stage; the last stage's output IS the deliverable. No merge step — the chain itself is the merge.
- **The hand-off is the brain.** Stage N's output is stage N+1's input, verbatim. The orchestrator owns that seam and keeps each stage blind to all but its input + required output.
- **A broken link is a real stop.** This blade does not tolerate misses. A failed stage breaks the chain; never feed garbage downstream. One retry, then halt.
- **No disk surface, nothing to land.** A chain whose final stage has no disk surface (research, a design in words) has nothing to land — the final scroll is the deliverable, not a miss.
- **Fire without a gate; run to chain-complete or a dropped baton.** `--confirm` is the only pause; otherwise run straight through the stages.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. The orchestrator commits the landed chain at the end; stage agents never commit, and a chain with no disk surface has nothing to commit.

## Don't

- Don't gate, ask, or pause unless `--confirm` is set.
- Don't run stages in parallel — a relay is strictly serial, one runner on the scroll at a time.
- Don't feed a failed or garbage stage output to the next stage — inspect before passing.
- Don't fabricate, skip, or paper over a failed stage — one retry, then stop and surface the dropped baton.
- Don't let a stage solve the whole task — each does only its one transform on the carried work.
- Don't add stages the task doesn't need, and don't chain work that isn't actually dependent.
- Don't push or PR — commits stay local. Stage agents never commit; the orchestrator commits at the end (unless the user requested no commit).
