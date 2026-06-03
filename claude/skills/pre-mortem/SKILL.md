---
name: pre-mortem
description: Take ONE risky plan, ASSUME it already failed, and throw 3–7 subagents (default 5, `--axes=N`) — each owning a distinct failure axis (technical, dependency/integration, scope/complexity, operational/rollout, adoption/UX, security, timeline) — to work backward from "it's dead, why?" and enumerate exactly how it died, then rank the failure modes by likelihood×impact and derive guardrails (or, with `--apply`, fold them into a hardened plan). Autonomous by design: infers the axes, fires without a gate, tolerates a lost axis (an uncovered failure mode — note it, rank what came back), runs straight to a ranked risk list. Trigger when the user types `/pre-mortem`, or asks to "pre-mortem this plan", "assume this failed and tell me why", "work backward from failure", "what could kill this", "enumerate the failure modes", "imagine it's six months later and this flopped", "find the risks before we commit", or "what are the ways this dies". Works on plans, designs, launches, and migrations. Do NOT trigger for forward planning or roadmapping (this is inversion — start from the corpse, not the goal), to stress-test a plan by interviewing the HUMAN in a coached back-and-forth (that is a human-in-the-loop alignment job), or to adversarially verify a single CLAIM with challengers and a judge (that is the adversarial-duel blade). Pre-mortem = parallel agents enumerating failure modes by working backward.
---

# /pre-mortem — assume it already died, then ask why

One risky plan in. The orchestrator declares it **already failed**, throws one agent per failure axis — each working backward from the corpse on its own axis — then ranks the failure modes by likelihood×impact, derives a guardrail for each, and (with `--apply`) folds them into a hardened plan.

**Ninja posture.** Forward planning is blind to its own death; the inversion is the whole point — fire it, **no approval gate**. Throw and forget — **no retry, no resume**. A lost axis is an uncovered failure mode, not a crisis: note it, rank what came back, move on. Only whiff = **zero** axes returned.

## The loop at a glance

```
Frame ...... read the plan, declare it DEAD, pick N failure axes          [silent — pause only on --confirm]
Throw ...... N parallel agents, one axis each, each works backward from "it failed, why?"
Land ....... take what returns; misses & stragglers = uncovered axes (no heal, no retry)
              floor: ≥1 returned → rank │ 0 returned → report the whiff, stop
Rank ....... merge all failure modes, sort by likelihood×impact, derive a guardrail each
              fatal mode with no viable guardrail → "already buried" — plan needs rethinking
Deliver .... ranked failure modes + guardrails  (--apply → a hardened plan)
```

## Slash invocation

```
/pre-mortem <plan> [--axes=N] [--apply] [--out=path] [--confirm]
```

| Arg | Default | Meaning |
|---|---|---|
| `<plan>` | — | The plan / design / launch under the knife. Inline prose, a spec path, or "the plan we just laid out". |
| `--axes=N` | `5` | Failure dimensions, one agent each. **Clamp 3–7** (`<3` → bump 3; `>7` → clamp 7 + warn: ranking blurs past ~7 axes). |
| `--apply` | off | Fold the derived guardrails back into the plan, emit a **hardened revised plan** artifact. Off → ranked failure modes + guardrails only. **Never commits** — produces a revised plan, not a write to live code. |
| `--out=path` | conversation | Persist the ranked list (and, with `--apply`, the hardened plan) to `path`. |
| `--confirm` | off | The **only** way to add a gate — print the death-plan and wait before throwing. Default fires without asking. |

Unsupplied flags resolved in Phase 0. Output is terse — the ranked failure space is the product, not the narration.

## Roles & artifacts

- **You** — throw the plan. No live decisions unless `--confirm`.
- **Orchestrator** — declares the plan dead, cuts the failure axes, throws, ranks what lands, derives guardrails, (with `--apply`) revises the plan. Sole author of the deliverable.
- **Pre-mortem agents** — one per failure axis, planted in the post-failure future, blind to siblings' axes, each returns the concrete ways it died on its axis.

No tracker, no graph, no sprint folders — this skill stands alone, depends only on its own fan. Artifacts: an in-memory death-plan + the ranked failure list (inline, or `--out`), and with `--apply` a hardened plan.

## Voice — studying your own corpse before the battle

Stay in character and stay quiet. The skill surfaces **only twice**: once when the corpse is laid out, once when the cause of death is read. Nothing in between — no progress chatter, no per-agent play-by-play. Use these templates verbatim (fill the `{slots}` — slots are the contract; the flavor is not). The `死` glyph is the signature; keep lines short.

**Throw** (Phase 0, on firing — the corpse laid out):
```
死  it is already dead · {N} axes of death examined
    {A1 axis} · {A2 axis} · … · {AN axis}                  [rank │ apply→hardened plan]
```

**The pause** (only when `--confirm`):
```
死  before we assume the worst — {N} failure axes will be opened on:
    {one-line plan}
    A1 {axis}   A2 {axis}   …   AN {axis}
    speak, and they read the corpse.
```

**Return** (Phase 3, on delivery — how it dies, precedes the ranked list):
```
死  {hits}/{N} axes read · ranked by likelihood × impact
    1. {top failure mode}  [{L}×{I}]  ⤳ guardrail: {one line}  · signal: {early warning}
    2. {next}              [{L}×{I}]  ⤳ guardrail: {one line}  · signal: {early warning}
    …
    ─ blind: {axes that returned nothing, or omit}
```

**Already buried** (a fatal mode with no viable guardrail — the plan is dead as posed):
```
死  it cannot be saved as posed — {the unguardable failure mode}.
    no guardrail closes this; the plan needs rethinking, not patching.
    {what a survivable version would have to change}
```

---

## Phase 0 — Frame (no gate)

Resolve `--axes` (clamp 3–7), `--apply`, `--out`, `--confirm`. Read the plan once. Then **declare it dead** — fix the inversion frame: *it is six months later and this plan failed.* Every axis works backward from that.

**Pick the axes** — distinct dimensions along which it could have died. One agent per axis, no overlap:

| Axis | The death it hunts |
|---|---|
| `technical` | the build/architecture broke — wrong abstraction, hidden complexity, infeasible piece |
| `dependency/integration` | an upstream/downstream/3rd-party seam failed — API drift, missing service, contract mismatch |
| `scope/complexity` | it ballooned — underestimated work, creep, never finished |
| `operational/rollout` | shipping killed it — deploy, migration, data, on-call, rollback |
| `adoption/UX` | nobody used it — confusing, slow, wrong workflow, no trust |
| `security` | a breach/leak/abuse path sank it — authz, data exposure, attack surface |
| `timeline` | it missed the window — slipped, blocked, the moment passed |

Pick the `N` axes that fit this plan; don't manufacture filler axes (fewer real axes → throw fewer). Each axis is exclusive to one agent — the inversion only works if each owns a different way to die.

**Death line** — emit the **Throw** template (see Voice), then throw immediately. `--confirm` → emit **The pause** template instead and **wait** for go. That flag is the only pause.

---

## Phase 1 — Throw (open the axes)

Spawn all N agents **in parallel** — one Agent call per axis, single batch, concurrent:

- `subagent_type: general-purpose` (specialized type only if one squarely fits an axis).
- `run_in_background: true`.
- `description`: e.g. `Pre-mortem A2: <axis>`.
- `prompt`: the template below — it plants the agent in the post-failure future, owning ONE axis, blind to the others.

### Per-agent prompt template

```
It is six months from now. The plan below was committed to, and it FAILED.
You are the post-mortem investigator for ONE axis of that failure. Do not defend
the plan, do not weigh whether it might succeed — assume it already died and work
BACKWARD: on your axis, what killed it?

The plan that failed (context only):
{plan restatement}

YOUR FAILURE AXIS — {axis title}:
{what this axis covers — concrete; e.g. "the rollout: deploy, migration, data,
rollback, on-call"}

OUT OF SCOPE (sibling investigators own these other axes — don't cover them):
{the other axes, one phrase each}

Reason backward from the corpse. For EACH distinct failure mode you find on your
axis, give:
  - Failure mode: the concrete way it died (a specific scenario, not "it was risky").
  - Likelihood: high | medium | low — how probable, given the plan as written.
  - Impact: fatal | severe | moderate — how badly it hurts if it happens.
  - Early-warning signal: the observable thing that would tip us off BEFORE it's fatal.
  - Guardrail: the change/check/mitigation that would have prevented or caught it
    — or "none — unguardable as posed" if no guardrail closes it.

Be specific and adversarial about your OWN axis only. 2–4 sharp failure modes beat
a long vague list. Your final message IS your portion — return the structured
failure modes, not chat. Be self-contained.
```

Each axis is exclusive — don't hand one agent another's axis. Orchestrator never commits.

---

## Phase 2 — Land (take what returns)

Event-driven. Collect each axis's failure modes as they land — capture each mode verbatim with its Likelihood / Impact / Early-warning signal / Guardrail.

- **Returned** → it's a hit. Keep its failure modes.
- **Failed, errored, denied, or stalled** → a miss = an **uncovered failure axis**. **No retry, no resume, no respawn.** One-line note ("axis blind"), move on.
- **Straggler** → don't block the ranking on it. Rank once the bulk has landed; a late return folds in only if it arrives before you finish, else it's a blind axis.
- **Overran its axis** (covered a sibling's dimension) → keep the in-axis modes, drop the rest.

**Floor:** ≥1 hit → rank. **0 hits** → the only real failure: emit the **Whiff** form of the Return template (zero axes read) and stop.

---

## Phase 3 — Rank & derive guardrails

Orchestrator's own work — not a hand-off. Turn the landed failure modes into one ranked deliverable:

1. **Pool** every failure mode across all axes.
2. **Dedupe** — two axes that surfaced the same death → one mode, note both axes saw it (cross-axis agreement raises its rank).
3. **Rank** by **likelihood × impact** — a `fatal` `high` rides to the top; a `moderate` `low` sinks. Order the whole list.
4. **Guardrail each** — carry the agent's guardrail, or sharpen it; attach the early-warning signal. One ranked row = mode + L×I + guardrail + signal.
5. **Already buried?** — if a `fatal` mode came back with a guardrail of *none — unguardable as posed*, the plan is dead as posed: emit the **Already buried** template and say what a survivable version would have to change. Don't bury it for a mode that *has* a guardrail — that's a risk to harden against, not a fatal flaw.

**`--apply`** → after ranking, fold the guardrails back into the plan and emit a **hardened revised plan** (the original plan plus each guardrail woven in, top risks addressed first). This is a revised plan artifact, never a write to live code and never a commit.

---

## Phase 4 — Deliver

Terse. Emit, in order:

- **Return** template (see Voice) — the `{hits}/{N}` axes read + the ranked failure modes with guardrails (or **Already buried** if a fatal mode is unguardable).
- **The ranked list** — failure modes sorted by likelihood×impact, each with its guardrail + early-warning signal (to `--out` if set, else inline).
- **`--apply`** → also emit the hardened revised plan. Next step: review and adopt (the skill never commits).

---

## Principles

- **Invert, don't plan.** Start from "it failed, why?" and work backward — that surfaces the deaths a forward plan can't see. Never drift into forward planning the plan.
- **One axis per agent.** Each agent owns a single distinct dimension of failure, blind to the others — coverage of the failure space comes from disjoint axes, not from one agent thinking hard.
- **Rank by likelihood × impact.** The deliverable is ordered risk, not a flat list; a fatal-and-likely mode leads.
- **Every mode gets a guardrail and a signal.** A failure mode with no mitigation and no early-warning is half a finding — derive both, or flag it unguardable.
- **Failure-tolerant by design.** A lost axis is an uncovered failure mode, noted, never healed — rank what came back.
- **Fire without a gate; run straight to the ranking.** `--confirm` is the only pause. Only hard stop: zero axes returned.
- **Right-size the axes.** Default 5, clamp 3–7; fewer real failure dimensions → fewer agents.

## Don't

- Don't gate, ask, or pause unless `--confirm` is set.
- Don't drift into forward planning — the agents assume the plan already died and reason backward, never forward.
- Don't hand one agent another's axis, or let an agent cover the whole failure space — each stays on its one axis.
- Don't retry, resume, or respawn a lost axis — note it blind and rank the rest.
- Don't block the ranking waiting on a straggler.
- Don't hand back N raw axis dumps — always pool, dedupe, and rank by likelihood×impact.
- Don't bury the plan for a mode that has a guardrail — only an unguardable fatal mode is "already buried".
- Don't commit, push, or PR — `--apply` emits a revised plan only; the user reviews and adopts.
- Don't exceed 7 axes — ranking blurs when one orchestrator weighs more failure dimensions than that.
