---
name: first-blood
description: "Race N rival strategies (default 3, `--runners=N`) at ONE whole task in parallel — first to clear the bar wins, the rest are abandoned; `--write` lands the winner. Trigger: `/first-blood`, \"race a few approaches\", \"take the first that works\". NOT to wait for all attempts and vote (use /hundred-blades) or to escalate serially by cost (use /drawn-steel)."
---

# /first-blood — loose the rivals, take whoever draws first blood

One task in. The orchestrator picks N rival strategies — different ways through the whole task — looses them in parallel to race, and takes the **first** runner to clear the bar. The moment one lands, the rest are abandoned. Speed and uncertainty, both bought at once.

**Ninja posture.** You don't know which path lands, and latency matters — so loose every rival at once and take whoever draws first blood. **No gate.** A runner that errors or stalls just loses the race — **no retry, no respawn**, it's gone. Parallel-tolerant: a fallen runner is fine. The ONE real failure is **all** runners failing the bar → report none-crossed. Runs straight to first blood.

## The loop at a glance

```
Frame ...... infer the bar, pick N rival strategies for the WHOLE task   [silent — pause only on --confirm]
Throw ...... N parallel runners, one strategy each, racing, fire-and-forget
Race ....... first runner to self-clear the bar → WINS → cancel the rest (--first)
              --best → let all finish to a soft deadline, take the best that cleared
              fallen/stalled runner just loses — no heal
              floor: ≥1 cleared the bar → win │ 0 cleared → no blood, stop
Deliver .... first blood — winner + the bar it cleared + how many abandoned
```

## Slash invocation

```
/first-blood <task> [--runners=N] [--bar="..."] [--first|--best] [--write] [--out=path] [--confirm]
```

| Arg | Default | Meaning |
|---|---|---|
| `<task>` | — | The whole task. Every runner gets it entire — inline prose, a path, or "the thing we just hit". |
| `--runners=N` | `3` | Rival strategies loosed. **Clamp 2–5** (`<2` → bump 2; `>5` → clamp 5 + warn: more angles but more wasted work — losers are thrown away). |
| `--bar="..."` | inferred | What "winning" means — the acceptance criterion / test the winner must clear. Absent → infer the strictest reasonable bar and **say so** in the Throw. |
| `--first` | on | First runner past the bar wins — **cancel the rest** the instant it lands. |
| `--best` | off | Let all runners finish to a soft deadline, then take the **best** that cleared the bar (overrides `--first`). |
| `--write` | off | The winner's change lands on disk (disjoint file set). Off → winner returns its artifact, no edits. |
| `--out=path` | conversation | Persist the winner + race map. Default → deliver inline. |
| `--confirm` | off | The only gate — print the race plan and wait before loosing. Default fires without asking. |

Output is terse — first blood is the product, not the play-by-play.

## Roles & artifacts

- **You** — throw the task. No live decisions unless `--confirm`.
- **Orchestrator** — sets the bar, picks the rival strategies, looses the race, judges who crossed, cancels the losers, writes the result. Sole author of the deliverable.
- **Runners** — N rivals, each attacking the **whole** task by its own assigned strategy, blind to the others. Each self-checks against the bar and reports the instant it clears (or fails) it.

No tracker/graph/sprint deps — stands alone.

## Voice — many paths through the forest

Speak twice: when the runners are loosed, when first blood is drawn. Silent through the race — no per-runner play-by-play. `{slots}` are the contract; the flavor is mouth. 印 = 韋.

**Throw** (Phase 0, on loosing):
```
韋  {N} runners loosed · race to the bar · take {first │ best}
    bar: {the acceptance criterion}                        [{inferred │ given}]
    paths: {S1 strategy} · {S2 strategy} · … · {SN strategy}   [{answer │ write}]
```

**The pause** (only `--confirm`):
```
韋  before the race — {N} rivals at the whole task, fastest past the bar wins:
    bar: {the bar}
    S1 {strategy}  ·  S2 {strategy}  ·  …
    speak, and they run.
```

**First blood** (Phase 3, precedes the winner):
```
韋  first blood: S{k} — {winning strategy}   ({how it cleared the bar})
    {cleared at: time/round │ omit}   ·   abandoned: {N-1} runners {still-running │ fallen}
    runner-up: {next-strongest path + where it stood, or "none returned"}
```

**No blood** (zero cleared the bar — the only hard stop):
```
韋  no blood — {N} loosed, none crossed the bar.
    bar: {the bar}.  nearest: {closest runner + what it lacked}.  raise more runners or relax the bar.
```

---

## Phase 0 — Frame (no gate)

Resolve `--runners` (clamp 2–5), `--bar`, `--first`/`--best` (`--best` overrides), `--write`, `--out`, `--confirm`. Read the task once.

**Set the bar** — what does "winning" mean? The concrete acceptance criterion every runner self-checks against: the test that must pass, the property that must hold, the requirement that must be met. A race with no bar can't name a winner. `--bar` set → use it verbatim. Absent → infer the **strictest reasonable** bar from the task and **say so** in the Throw (don't pause — `--confirm` is the only pause).

**Pick the rival strategies** — `--runners` *distinct approaches to the WHOLE task* (not slices of it). Each path should be a genuinely different bet — different algorithm, different library/tool, different framing, different data path, different design stance — so that if one approach is a dead end the others aren't. Don't manufacture near-duplicate paths; fewer real rivals beats N look-alikes. Name each path in one phrase.

**`--write`** → assign each runner a **disjoint** file set, since rivals will race over the same change; the winner's set is what lands, the losers' edits are discarded. Files that can't be split cleanly → keep runners read-only and apply the winner's diff yourself at the end.

Emit the **Throw** template, then loose. `--confirm` → emit **The pause** and wait.

---

## Phase 1 — Throw the race

Spawn all N runners **in parallel** — one Agent call per strategy, single batch, concurrent:

- `subagent_type: general-purpose` (specialized type only if one squarely fits a strategy).
- `run_in_background: true`.
- `description`: e.g. `Runner S{k}: <strategy>`.
- `prompt`: the template below.

### Per-runner prompt template

```
You are runner {k} of {N} in a RACE. {N} rivals attack the SAME whole task in
parallel, each by a DIFFERENT strategy. You attack the whole task — not a slice
of it — by YOUR assigned approach. First runner to clear the bar wins; the rest
(including possibly you) are abandoned. Speed matters: go straight for a clearing
result by your path, don't gold-plate.

Whole task:
{task restatement}

YOUR STRATEGY — {strategy title}:
{the approach this runner must pursue — the distinct bet, concrete}
Commit to this approach. Do not drift into a rival's strategy; your value is that
you bet differently from them.

THE BAR (what "winning" means — self-check against this):
{the acceptance criterion / test / property}
Before you report success, verify your result actually clears this bar — run the
test, check the property, walk the requirement. A confident-but-unchecked claim is
worse than an honest miss.

{--write mode only:}
Files you OWN (edit only these): {owned file set}
Do NOT edit/move/reformat anything outside this set — a rival is racing in nearby
files and a stray edit clobbers the eventual winner. Do NOT commit, push, branch, or PR.

Report AS SOON AS you have a verdict — don't sit on a clearing result:
  - Cleared: YES → you cleared the bar | NO → you could not.
  - Result: your answer / artifact {in the form the task asks; or the on-disk change + path under --write}.
  - Bar-check: the concrete evidence you cleared it (test output, the property shown to hold), or
    — if NO — exactly what the bar you fell short of, and how far.
  - Confidence: high | medium | low.
Your final message IS your result — data, not chat. Be self-contained.
```

`--write` → file sets disjoint. Orchestrator never commits — user reviews and commits.

---

## Phase 2 — Race (take first blood)

Event-driven. Watch the runners as they report.

- **`--first` (default):** the **first** runner to report `Cleared: YES` with sound bar-evidence **wins**. The instant it lands, **cancel every other runner** (stop the background sessions) — their work is abandoned, won or not. Don't second-guess a clean cross to wait for a "nicer" one; first past the bar is the contract.
- **`--best`:** don't stop on the first cross. Let runners finish to a soft deadline (the slowest reasonable runtime, or until the rest fall), then among those that reported `Cleared: YES` take the **best** (judge on result quality + bar-evidence, not self-reported confidence). Cancel anything still running past the deadline.
- **Fallen / stalled / errored / denied runner** → it just **loses the race**. **No retry, no respawn.** One-line note, move on — a lost runner is expected and cheap.
- **A runner reports `Cleared: NO`** → it's out of the race; it doesn't win, but its bar-shortfall feeds the "nearest" line if nobody crosses.

**Floor:** ≥1 runner cleared the bar → first blood, proceed to deliver. **0 cleared** (all reported NO, fell, or stalled) → the only real failure: emit the **No blood** template and stop.

---

## Phase 3 — Deliver

Terse. Emit, in order:

- **First blood** template (see Voice) — the winning strategy, the bar it cleared, how many were abandoned, the runner-up.
- **The winner** — its result/artifact (to `--out` if set; on disk if `--write`). One deliverable — the winner's, not a blend of rivals.
- **`--write` next step** — review and commit (the skill never commits). The losers' edits, if any, were discarded; only the winner's set landed.

Report the bar honestly — "cleared the bar" means *this bar, this race*, not "best possible". If the win was marginal or the bar was inferred, say so.

---

## Principles

- **Rival strategies, not slices.** Every runner gets the whole task by a *different* approach — the bet is on which path lands, so make the paths genuinely distinct.
- **The race is parallel; the win is first.** All rivals run at once; the first to clear the bar wins and the rest are cut. (`--best` trades a little latency for picking the strongest crosser.)
- **The bar names the winner.** No bar, no race — set it concrete, self-check against it, never crown an unchecked claim.
- **Losers are abandoned, not mourned.** A fallen or cancelled runner is the cost of speculation — wasted work bought certainty and latency. No retry, no respawn.
- **Fire without a gate; run to first blood.** `--confirm` is the only pause. Only hard stop: zero runners cleared the bar.
- **Right-size the field.** Default 3, clamp 2–5 — more rivals cover more angles but throw away more work.

## Don't

- Don't gate, ask, or pause unless `--confirm` is set.
- Don't wait for all runners and tally a consensus — take the first past the bar (or the best crosser under `--best`) and cancel the rest.
- Don't hand the same strategy to two runners, or let one drift into a rival's path — distinct bets are the whole point.
- Don't slice the task across runners — every runner gets the whole task, by a different approach.
- Don't crown a runner that didn't show it cleared the bar — an unchecked "done" is not first blood.
- Don't retry, resume, or respawn a fallen runner — it just lost the race.
- Don't give two `--write` runners a shared file — overlapping edits clobber the eventual winner.
- Don't commit, push, or PR in `--write` mode — only the winner's set lands; the user reviews and commits.
- Don't exceed 5 runners — past that the wasted work outweighs the extra angle.
