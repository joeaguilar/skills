---
name: drawn-steel
description: Solve ONE task by climbing a cost ladder — try the CHEAPEST approach first, check it against the bar, and escalate to a costlier, more careful rung ONLY when the current rung fails. Stop the instant a rung passes; if the whole ladder fails, surface the best rung + what's missing. Autonomous: infers the ladder and the bar, fires without a gate, runs serially up the rungs, never over-spends. Trigger when the user types `/drawn-steel`, or asks to "try cheap first then escalate", "use the least effort that works", "escalate only if the simple approach fails", "cost-aware solve this", "don't burn a swarm if one agent can do it", "step up the effort until it passes", or "rightsize the agents to the problem". Works for research, analysis, decisions, and code (`--write`). Do NOT trigger to run all approaches AT ONCE in parallel and take the first/best to land (that is a speculative-race job — `first-blood` races strategies concurrently; drawn-steel is SERIAL and escalates only on a checked failure), to attack the whole task with N independent attempts and vote/best-pick the truest (that is a consensus job — `hundred-blades`), to fan ONE task across different aspects struck at once (`fan-of-agents`), or to run a single fixed approach with no escalation ladder.
---

# /drawn-steel — soft hand first, draw the blade only when it fails

One task in. The orchestrator climbs a ladder of rungs ordered cheapest→costliest: run a rung, check it against the bar, deliver on pass — escalate to the next, more careful rung only on a checked failure. Spend effort only where the cheap path breaks.

**Ninja posture.** Infer the ladder + the bar and climb — **no gate**. This is serial, not a fan: the bar-check **between rungs is load-bearing** — escalate only on a real, checked failure, and **stop the instant a rung passes** (do NOT keep climbing past success). Runs straight up the rungs; the only hard stop is a passing rung, or a ladder exhausted with none passing (a real failure, surfaced).

## The loop at a glance

```
Frame ...... order rungs cheapest→costliest + set the bar           [silent — pause only on --confirm]
Climb ...... ↻ rung r (one agent config): run it → self-check vs bar
              PASS → deliver & STOP (do not climb further)
              FAIL → escalate to rung r+1 (costlier · more careful)
              ladder exhausted, none passed → real failure
Merge ...... the first rung that cleared the bar (or best, if all failed)
Deliver .... which rung drew blood + rungs climbed + the bar it cleared
```

## Slash invocation

```
/drawn-steel <task> [--ladder="cheap,mid,expensive"] [--bar="acceptance test"] [--write] [--out=path] [--confirm]
```

| Arg | Default | Meaning |
|---|---|---|
| `<task>` | — | The single task. Inline prose, a spec path, or "the thing we just hit". |
| `--ladder="r1,r2,…"` | auto | The rungs cheapest→costliest. Absent → orchestrator proposes a ladder of increasing cost/care: one quick single agent → one careful focused agent → a multi-agent consensus/verify rung. **Clamp 2–4 rungs** (`<2` → not a ladder, bump 2; `>4` → clamp 4 + warn: too tall wastes the cheapness). |
| `--bar="…"` | inferred | What "passes" means at every rung — the acceptance test/criteria. Absent → infer the strictest reasonable bar and **say so** (a ladder with no bar can't check between rungs — it's theater). |
| `--write` | off | A passing rung's change lands on disk. Off → read-only, the rung returns a report/artifact only. |
| `--out=path` | conversation | Persist the deliverable. |
| `--confirm` | off | The ONLY gate — print the ladder + bar and wait before the first rung. Default fires without asking. |

Output is terse — the cleared deliverable is the product, not the climb commentary.

## Roles & artifacts

- **You** — throw the task. No live decisions unless `--confirm`.
- **Orchestrator** — orders the rungs cheapest→costliest, sets the bar, runs ONE rung at a time, checks each against the bar, escalates on fail, delivers the first pass. Sole author of the deliverable.
- **Rung agents** — one rung run at a time (each a more capable/expensive config than the last — a quick single agent, then a careful focused agent, then a heavier multi-agent consensus/verify rung). Each does the task at its effort level **and self-reports pass/fail against the bar**.

No tracker/graph/sprint deps — stands alone.

## Voice — draw steel only when the soft hand fails

Speak twice: when the ladder is set, when a rung draws blood (or the ladder runs out). Silent between rungs. `{slots}` are the contract; the flavor is mouth. 印 = 抜.

**Throw** (Phase 0):
```
抜  soft hand first — climb on failure · bar: {the bar}
    rungs: {r1 cheap} → {r2 careful} → {r3 heavy}        [read │ write→out=path]
```

**The pause** (only `--confirm`):
```
抜  before the first cut — cheapest hand first, blade only on failure:
    {r1} → {r2} → {r3}   must clear: {bar}
    speak, and the soft hand moves.
```

**Return** (Phase 3, precedes the deliverable):
```
抜  drew blood at rung {k}/{total}: {rung name} cleared the bar.
    climbed: {r1 ✗ why → … → rk ✓}     ({k} of {total} rungs spent)
    bar cleared: {the bar}                                  [read │ written→path]
```

**Ladder exhausted** (every rung failed the bar — real failure):
```
抜  the ladder ran out — {total}/{total} rungs failed the bar.
    best rung: {strongest rung} got closest: {what it produced}
    still missing: {what no rung cleared} → bar was: {bar}
```

---

## Phase 0 — Frame (no gate)

Resolve `--ladder`, `--bar`, `--write`, `--out`, `--confirm`. Read the task once.

**Set the bar** — the acceptance test every rung must clear (concrete: the property, cases, or criteria a passing answer satisfies). `--bar` set → use it. Absent → infer the strictest reasonable bar and **say so** in the Throw line. No bar = no between-rung check = not this blade.

**Order the ladder cheapest→costliest** — each rung a more capable/expensive agent config than the last. `--ladder` set → use those rungs in order. Absent → propose (clamp 2–4):
- **r1 (cheap):** one quick single agent, low effort — the soft hand.
- **r2 (careful):** one focused agent, more effort/care/context — slower, sharper.
- **r3 (heavy, only if needed):** a multi-agent consensus/verify rung — several agents on the whole, reconciled — expensive, reserved for what the cheaper rungs couldn't clear.

**Right-size & clamp.** Don't build a tall ladder for a trivial task — a 2-rung ladder is fine, and a task the first rung obviously clears should stop there. More rungs ≠ better; each rung exists only to catch what the cheaper one missed.

Emit the **Throw** template, then climb. `--confirm` → emit **The pause** and wait. That flag is the only pause.

---

## Phase 1 — Climb (serial, escalate on failure)

Run **one rung at a time**, in order, cheapest first. Per rung spawn its agent config — `subagent_type: general-purpose` (specialized type only if one squarely fits), `run_in_background: true`, `description` e.g. `Rung {k}: {effort level}`. A heavy rung may itself be several agents reconciled by the orchestrator; describe it generically as a multi-agent consensus/verify rung — never name it as another blade.

### Per-rung prompt template

```
You are rung {k} of {total} on a cost-escalation ladder for ONE task. Cheaper rungs
already FAILED the bar below (or you are the first, cheapest rung). Your effort level:
{rung's approach / effort — quick single pass │ careful focused pass │ multi-agent
consensus-and-verify}. Match that effort — no more, no less.

Task:
{task restatement}

The BAR you must clear (this is the pass/fail line — check yourself against it honestly):
{bar — concrete acceptance test/criteria}

{cheaper rungs failed → why, so you don't repeat their miss:}
What the cheaper rung(s) missed: {prior failure reasons, or "you are rung 1"}

Do the task at your effort level, then SELF-CHECK against the bar before answering.

{--write mode only:}
If you PASS, apply your change to its file(s) — note the path, edits disjoint.
Do NOT commit, push, branch, or PR. If you FAIL, return the attempt as a report only.

Return EXACTLY:
  - Result: your answer / artifact {in the form the task asks}.
  - Bar check: PASS or FAIL — and the concrete evidence you checked against the bar.
  - If FAIL: exactly which part of the bar you couldn't clear, and why.
  - Confidence: high | medium | low.
Your final message IS your rung — return data, not chat. Report pass/fail plainly.
```

**Check the rung against the bar** (orchestrator — the load-bearing step). Take the rung's self-reported pass/fail but verify it against the bar yourself; a rung that *claims* pass without clearing the bar is a FAIL.

- **PASS** → this rung cleared the bar. **Stop. Do not climb further.** Go to Phase 3 with this rung's result.
- **FAIL** → escalate: hand the next, costlier rung the task + the bar + why this rung missed. Climb.
- **Rung errored / didn't return** → treat as a FAIL of that rung; escalate (don't retry the same rung).

**Stop** when: a rung clears the bar (→ deliver it, stop early) · the ladder is exhausted with no rung passing (→ real failure). Never keep climbing after a pass — spending an expensive rung on an already-solved task is the footgun this blade exists to avoid.

---

## Phase 2 — Merge (first rung that passes)

The merge is trivial by design: **the deliverable is the first rung that cleared the bar.** No vote, no synthesis across rungs — earlier rungs that failed are discarded (note only why they failed, for the climb map). If the ladder exhausted with none passing, the "merge" is the **best** rung (closest to the bar) plus what's still missing — surfaced as a failure, not laundered into a pass.

`--write` → the passing rung's change is already on disk; merge = confirm it's the only applied change.

---

## Phase 3 — Deliver

Terse. Emit, in order:

- **Return** template (rung that drew blood + rungs climbed + bar cleared) — or **Ladder exhausted** if no rung passed.
- **The deliverable** — the passing rung's result (to `--out` if set; on disk if `--write`). On exhaustion, the best rung's result + the explicit gap.
- **`--write` next step** — review and commit (the skill never commits).

A pass means *this rung cleared this bar* — report which rung and how many you spent, so the cost is visible. Don't inflate a cheap-rung pass into more certainty than the bar earned.

---

## Principles

- **Split by cost.** Rungs are ordered cheapest→costliest, each a more careful/expensive config than the last. The ladder is the cut.
- **Serial, escalate only on failure.** Run one rung, check the bar, climb only when it fails. Never run rungs in parallel — that's a race, not a ladder.
- **The between-rung check is load-bearing.** Escalate only on a real, checked failure against the bar. No bar, no check, no blade.
- **Stop the instant a rung passes.** The first rung to clear the bar is the deliverable — do not keep climbing. Cost-awareness is the whole point.
- **Spend effort only where the cheap path breaks.** Don't burn a heavy multi-agent rung on what one quick agent solves; don't under-power a hard task either — climb until it clears.
- **Right-size the ladder.** Default the proposed rungs, clamp 2–4; a trivial task gets a short ladder, often one rung.
- **Fire without a gate; run to a pass or an exhausted ladder.** `--confirm` is the only pause.

## Don't

- Don't gate, ask, or pause unless `--confirm` is set.
- Don't run the rungs in parallel — they're serial, cheapest first; escalate only on a checked failure.
- Don't escalate without checking the current rung against the bar — the check is the whole brain.
- Don't keep climbing after a rung passes — stop and deliver the cheapest rung that cleared the bar.
- Don't build a tall ladder for a trivial task — clamp 2–4 rungs; fewer is fine.
- Don't launder an exhausted ladder into a pass — surface the best rung + what's still missing as a real failure.
- Don't commit, push, or PR in `--write` mode — the user reviews and commits.
