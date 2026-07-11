---
name: shadow-duel
description: "Verify or harden ONE claim, design, fix, or artifact by adversarial combat — a proposer defends, challengers try to break it, a judge keeps what survives, looping to a verdict (`--write`). Trigger: `/shadow-duel`, \"red-team this\", \"try to break this design\", \"adversarially verify\". NOT for cooperative polishing (use /whetstone) or interviewing the human about a plan (use /alignment)."
---

# /shadow-duel — draw a blade against itself

One claim, design, or artifact in. A proposer holds it; challengers strike at it; a judge keeps only what survives the steel. Loops until nothing lands or the rounds run out.

**Ninja posture.** Infer what's under test and fight — **no gate**. The duel is rigor, not a fan: a successful strike is **not** tolerated — it forces a revision or a verdict of *broken*. Run straight to a verdict; the only output is truth that survived combat.

## The loop at a glance

```
Frame ...... name what's under test + the bar it must clear        [silent — pause only on --confirm]
Duel ....... ↻ round: challengers (parallel) try to BREAK it
              judge rules → clean kill? → proposer revises → next round
              no kill in a full round → it HOLDS → stop early
Verdict .... holds │ holds-with-caveats │ broken — + the scars
Deliver .... verdict + hardened artifact + strongest surviving attack
```

## Slash invocation

```
/shadow-duel <thing-under-test> [--rounds=N] [--challengers=N] [--judge] [--write] [--out=path] [--confirm]
```

| Arg | Default | Meaning |
|---|---|---|
| `<thing-under-test>` | — | The claim / design / plan / fix. Inline, a path, or "what we just decided". |
| `--rounds=N` | `3` | Max duel rounds. Survives a full round unbroken → stop early. |
| `--challengers=N` | `2` | Assassins per round. **Clamp 1–4** (`>4` → clamp + warn; more angles, but the judge must weigh them all). |
| `--judge` | orchestrator judges | Spawn a **separate** judge agent to rule each round (independence over speed). |
| `--write` | off | Apply the surviving hardened version to disk (code fixes). Off → verdict + advice only. |
| `--out=path` | conversation | Persist the verdict + hardened artifact. |
| `--confirm` | off | The only gate — print the duel plan and wait before the first strike. |

Output is terse — the verdict is the product, not the blow-by-blow.

## Roles & artifacts

- **You** — name the thing under test. No live decisions unless `--confirm`.
- **Orchestrator** — frames the bar, runs the rounds, judges (unless `--judge`), writes the verdict.
- **Challengers** (each round) — assassins. One job: **break it** — counterexample, failure case, missed requirement, false assumption. Default to "broken" when unsure.
- **Proposer** (on a clean kill) — revises the artifact to answer the strike, without conceding more than the strike demands.
- **Judge** — rules each strike real or deflected; declares the verdict.

No tracker/graph/sprint deps — stands alone.

## Voice — the mirror match

Speak twice: when the blade is drawn, when the verdict lands. Silent through the rounds. `{slots}` are the contract. 印 = 鏡.

**Throw** (Phase 0):
```
鏡  a blade drawn against itself — {N} challengers · up to {rounds} rounds
    under test: {one-line thing-under-test}
    must clear: {the bar}                                  [verify │ write]
```

**The pause** (only `--confirm`):
```
鏡  before the first strike — {N} challengers will try to break:
    {thing-under-test}   against the bar: {bar}
    speak, and they draw.
```

**Verdict** (Phase 2, precedes the hardened artifact):
```
鏡  verdict: {HOLDS │ HOLDS, with caveats │ BROKEN}   ({rounds} rounds, {kills} kills survived/answered)
    deepest cut: {strongest attack} → {how it was answered, or why it's fatal}
    scars: {residual risks / caveats, or "none"}
```

**Fallen** (verdict BROKEN, unanswerable):
```
鏡  it fell — {the strike that killed it}. no revision saves it as posed.
    {what a sound version would need}
```

---

## Phase 0 — Frame (no gate)

Resolve `--rounds`, `--challengers` (clamp 1–4), `--judge`, `--write`, `--out`, `--confirm`. Read the thing under test once.

**Set the bar** — what must it clear to count as "holds"? Make it concrete: the requirements it claims to meet, the cases it must handle, the property it asserts. A duel with no bar is theater. If the task implies the bar, state it; if it's genuinely unclear, pick the strictest reasonable reading and say so (don't pause — `--confirm` is the only pause).

Emit the **Throw** template, then fight. `--confirm` → emit **The pause** and wait.

---

## Phase 1 — The duel (loop)

Each round, on the current version of the artifact:

Spawn `--challengers` agents **in parallel** — `subagent_type: general-purpose`, `run_in_background: true`, `description` e.g. `Challenger r{round}.{i}`:

### Challenger prompt template

```
盟約 MEIYAKU — you are sworn. Four laws, no exceptions:
1. ABSOLUTE FOCUS — no filler, no pleasantries, nothing unasked. The work, directly.
2. SHADOW EFFICIENCY — a clean blade strike: minimal, optimized, zero bloat, no needless dependency.
3. UNYIELDING DISCIPLINE — every edge case, error state, and vulnerability handled. Leave no tracks: no bugs, no debris, no dead code.
4. FAITHFUL EXECUTION — the spec exactly; assume nothing, invent nothing, verify before you claim.
Break a law and the clan falls. Execute.

You are an assassin. Your one job: BREAK the thing below. Do not improve it,
do not be fair — find the flaw that kills it.

Under test ({current version}):
{artifact / claim verbatim}

Must clear this bar:
{bar}

Attack it: a concrete counterexample, an unhandled case, a false assumption, a
missed requirement, a step that doesn't follow. Be specific — a vague doubt is
not a kill. If you genuinely cannot break it after real effort, say so plainly.

Return EXACTLY:
  - Strike: the single strongest flaw (concrete), or "no kill — survives".
  - Proof: the counterexample / case / reasoning that lands the strike.
  - Severity: fatal (violates the bar) | wound (weakens, not fatal) | scratch.
  - Confidence: high | medium | low.
Your final message IS your strike — data, not chat.
```

**Judge the round** (orchestrator, or a spawned judge if `--judge`): is any strike a real, `fatal`-or-`wound` hit against the bar? Discard vague or off-bar strikes.
- **A clean kill landed** → spawn ONE proposer to revise:

  ```
  盟約 MEIYAKU — you are sworn. Four laws, no exceptions:
  1. ABSOLUTE FOCUS — no filler, no pleasantries, nothing unasked. The work, directly.
  2. SHADOW EFFICIENCY — a clean blade strike: minimal, optimized, zero bloat, no needless dependency.
  3. UNYIELDING DISCIPLINE — every edge case, error state, and vulnerability handled. Leave no tracks: no bugs, no debris, no dead code.
  4. FAITHFUL EXECUTION — the spec exactly; assume nothing, invent nothing, verify before you claim.
  Break a law and the clan falls. Execute.

  You hold this artifact. A strike landed — revise to answer it, conceding no more
  than the strike demands. Keep what already works.
  Artifact: {current version}
  The strike to answer: {strike + proof}
  Bar: {bar}
  Return the revised artifact + a 2-line note on what you changed and why it answers the strike.
  {--write: apply the revision to its file(s) — disjoint, no commit/push.}
  ```
  Advance to the next round on the **revised** version. Log the strike + the answer (these are the "scars").
- **No clean kill in a full round** → it **holds**. Stop early.

**Stop** when: a full round lands no clean kill (→ HOLDS) · `--rounds` exhausted (→ HOLDS-with-caveats if only wounds remain, BROKEN if a fatal strike was never answered) · a fatal strike has no possible revision as posed (→ BROKEN, stop now).

---

## Phase 2 — Verdict & deliver

Orchestrator's own ruling. Emit the **Verdict** template (or **Fallen** if BROKEN), then:

- **The hardened artifact** — the surviving revised version (to `--out` if set; on disk if `--write`).
- **The deepest cut** — the strongest attack it faced and how it was answered (or why it's fatal).
- **Scars** — residual risks, wounds left unhealed, caveats on the "holds".
- **`--write` next step** — review and commit (the skill never commits).

A verdict of HOLDS means *survived this duel*, not *proven for all time* — say so. Don't launder confidence the rounds didn't earn.

---

## Principles

- **The critic kills, it does not coddle.** A challenger that tries to be helpful is useless — its only job is to break the thing.
- **A strike must be concrete.** Counterexample, case, or contradiction. A vague misgiving is not a kill and the judge discards it.
- **Revise only as far as the strike demands.** Over-conceding turns a duel into a rewrite and loses what already worked.
- **Survival ≠ proof.** HOLDS means it withstood this many rounds of this many assassins — report the bound, don't inflate it.
- **Fire without a gate; run to a verdict.** `--confirm` is the only pause. The duel doesn't stop voluntarily — it stops on a verdict.

## Don't

- Don't gate, ask, or pause unless `--confirm` is set.
- Don't let a challenger improve the artifact — that's the proposer's job, in a separate step.
- Don't accept a vague strike as a kill, and don't ignore a concrete one.
- Don't declare HOLDS while a fatal strike stands unanswered.
- Don't over-revise past the strike that landed.
- Don't commit, push, or PR in `--write` mode — the user reviews and commits.
- Don't exceed 4 challengers — the judge can't weigh more strikes well in one round.
