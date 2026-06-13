---
name: hundred-blades
description: Attack the WHOLE task with N independent agents (default 5, `--blades=N`), each solving it from scratch, then keep the truest answer by vote, best-pick, or merge. Autonomous: fires the swarm without a gate, tallies whatever returns, reports the consensus and the dissent. Trigger when the user types `/hundred-blades`, or asks to "best of N", "get consensus from several agents", "run it a few times and pick the best", "self-consistency", "ensemble the answers", "vote on the answer", or "reduce variance with multiple attempts". Works for answers, decisions, estimates, designs, and code (`--write` applies the winner). Do NOT trigger to split a task into DIFFERENT aspects struck in parallel (that is a decomposition / fan-of-agents job — there each agent owns a slice; here every agent owns the whole), to refine one draft over passes (whetstone), or to race different strategies and take the first to finish (first-blood).
---

# /hundred-blades — many shadows, one task, keep the truest

One whole task in. N agents each strike it independently — same target, no shared work — and the orchestrator keeps the answer that the most blades agree on, or the single best, or the merged core. Variance falls; the lucky-wrong single run stops deciding things.

**Ninja posture.** Fire the swarm and tally what returns — **no gate**, **no babysitting**. A blade that misses just doesn't vote: consensus stands on whoever returned. The only failure is too few returning to call it (no quorum). Runs straight to a verdict.

## The loop at a glance

```
Frame ...... restate the WHOLE task + merge mode                   [silent — pause only on --confirm]
Throw ...... N agents, same task, independent, parallel, fire-and-forget
Tally ...... cluster equivalent answers
              vote → majority │ best → judge picks one │ merge → fuse the agreed core
              quorum: < ⌈N/2⌉ returned → low-confidence, surface it
Deliver .... the consensus + agreement map (who agreed, who dissented)
```

## Slash invocation

```
/hundred-blades <task> [--blades=N] [--merge=vote|best|merge] [--judge] [--write] [--out=path] [--confirm]
```

| Arg | Default | Meaning |
|---|---|---|
| `<task>` | — | The whole task. Each blade gets it entire — inline, a path, or "the question we just hit". |
| `--blades=N` | `5` | Independent attempts. **Clamp 3–9, odd preferred** (clean majority; `<3` → bump 3, `>9` → clamp 9 + warn). |
| `--merge=...` | `vote` | `vote` = majority of equivalent answers · `best` = judge picks the single strongest · `merge` = fuse the agreed core, note divergence. |
| `--judge` | orchestrator | Spawn a separate judge agent for `best`/`merge` (independence over speed). |
| `--write` | off | Apply the winning answer to disk. **Forces `--merge=best`** (you can't apply five diffs — warn if combined with `vote`/`merge`). |
| `--out=path` | conversation | Persist the consensus + map. |
| `--confirm` | off | The only gate — print the swarm plan and wait. |

Output is terse — the consensus is the product, not the transcript of all N.

## Roles & artifacts

- **You** — throw the task. No live decisions unless `--confirm`.
- **Orchestrator** — restates the whole task, fires the swarm, tallies, writes the consensus.
- **Blades** — N independent agents, each solving the **entire** task alone, blind to the others. Each returns its answer + confidence + key reasoning.
- **Judge** (`best`/`merge`) — picks the strongest or fuses the agreed core.

No tracker/graph/sprint deps — stands alone.

## Voice — a hundred shadows

Speak twice: when the shadows fly, when they agree. Silent between. `{slots}` are the contract. 印 = 影.

**Throw** (Phase 0):
```
影  {N} shadows, one task · merge: {vote │ best │ merge}
    each strikes the whole: {one-line task}                [answer │ write]
```

**The pause** (only `--confirm`):
```
影  before the swarm — {N} independent strikes at the whole:
    {task}   merge by {mode}
    speak, and they fly.
```

**Tally** (Phase 3, precedes the consensus):
```
影  {returned}/{N} returned · agreement {high │ split │ none}
    consensus: {the kept answer, one line}
    dissent: {the strongest minority view, or "none"}
    {quorum warning if < ⌈N/2⌉ returned}
```

**No quorum** (too few returned to call it):
```
影  only {returned}/{N} returned — too few to trust a consensus.
    what came back: {brief}. throw again or decide by hand.
```

---

## Phase 0 — Frame (no gate)

Resolve `--blades` (clamp 3–9, odd preferred), `--merge` (`--write` forces `best`), `--judge`, `--out`, `--confirm`. Restate the **whole** task — every blade gets it entire; there is no slicing here. Define what "the same answer" means for this task (so the tally can cluster equivalents — e.g. same decision, same number within tolerance, same approach).

Emit the **Throw** template, then fire. `--confirm` → emit **The pause** and wait.

---

## Phase 1 — Throw the swarm

Spawn all N agents **in parallel** — `subagent_type: general-purpose`, `run_in_background: true`, identical prompt, `description` e.g. `Blade {i}/{N}`:

### Per-blade prompt template

```
You are blade {i} of {N}. Solve this ENTIRE task on your own, from scratch.
Other blades solve the same task independently — do not assume any shared work.

Task:
{whole task verbatim}

Work it your own way. Don't hedge toward an imagined consensus — your honest
independent answer is what makes the vote worth anything.

Return EXACTLY:
  - Answer: your result {in the form the task asks — decision / value / design / change}.
  - Confidence: high | medium | low.
  - Key reasoning: the 1–3 points that drove your answer (so divergence can be judged).
{--write: apply your answer to its file(s) on a path you note; disjoint; no commit/push.}
Your final message IS your answer — data, not chat.
```

Independence is the whole asset — do not feed one blade another's answer.

---

## Phase 2 — Tally

Event-driven. Collect each answer + confidence + reasoning as it lands. A miss is silence, not a crisis — **no retry, no respawn**.

**Quorum:** need ≥ `⌈N/2⌉` returns to call a consensus. Fewer → emit **No quorum** and stop.

Merge per mode:
- **vote** — cluster equivalent answers (per the equivalence defined in Phase 0); the largest cluster wins. Report cluster sizes + the strongest dissenting answer. Ties → fall to `best` over the tied clusters.
- **best** — judge weighs all returned answers (on reasoning quality, not just confidence) and picks the single strongest. (`--write` → this is the diff that gets applied.)
- **merge** — synthesize the core the blades agree on; explicitly mark where they diverged and why.

Weigh reasoning over self-reported confidence — a confident blade with weak reasoning loses to a careful one.

---

## Phase 3 — Deliver

Terse. Emit, in order:

- **Tally** template — `{returned}/{N}`, agreement level, consensus, dissent.
- **The consensus** — the kept answer (to `--out` if set; on disk if `--write`).
- **`--write` next step** — review and commit (the skill never commits).

When agreement is *split* (no strong majority), say so — a thin consensus is a signal, not a number to hide.

---

## Principles

- **Same target, no shared work.** Every blade owns the whole task — that's the difference from a decomposition fan. Independence is the asset; never cross-feed answers.
- **Consensus beats a single lucky run.** N independent attempts cut variance — the value is the agreement, not any one blade.
- **Reasoning over confidence.** The tally weighs why an answer was reached, not how sure the agent claimed to be.
- **Misses just don't vote.** A lost blade lowers the count, not the run — until quorum fails.
- **Fire without a gate; run to a tally.** `--confirm` is the only pause.

## Don't

- Don't gate, ask, or pause unless `--confirm` is set.
- Don't slice the task across blades — that's a decomposition fan, not this. Every blade gets the whole.
- Don't feed one blade another's answer — it poisons the independence the vote depends on.
- Don't report a consensus below quorum — surface the thin return instead.
- Don't trust self-reported confidence over the quality of the reasoning.
- Don't apply more than one answer in `--write` mode — `best` picks the single winner.
- Don't commit, push, or PR in `--write` mode — the user reviews and commits.
