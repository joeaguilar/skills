---
name: whetstone
description: "Grind ONE artifact sharp over passes — draft → critique → revise — until it meets the bar or stops improving; cooperative critic, keeps the best version each pass. When the artifact is a file, the sharpened version lands on disk by default. Trigger: `/whetstone`, \"polish this\", \"iterate on this draft\", \"keep improving until it's good\". NOT for adversarial break-it verification (use /shadow-duel)."
---

# /whetstone — one blade, ground sharp pass after pass

One artifact in. The orchestrator runs it through a loop — critique it against a bar, revise it, critique again — keeping the best version each pass, until the edge is sharp enough, stops getting sharper, or the passes run out.

**Ninja posture.** Infer the bar and grind — **no gate**. The loop is improvement, not combat: each critic finds concrete weaknesses to *fix*, not flaws to *kill*. A pass that REGRESSES is no stop — keep the prior best and try again or quit. Real stops: bar met · no meaningful gain in a pass (converged) · `--passes` exhausted. Never ship a version worse than a previous pass produced.

## The loop at a glance

```
Frame ...... name the artifact + the bar it must meet              [silent — pause only on --confirm]
Grind ...... ↻ pass: critic evaluates current vs bar → concrete improvements
              reviser applies them → new version
              compare to prior best → keep the better (never regress)
              bar met │ no meaningful gain │ passes spent → stop
Converged .. the sharpest version + which pass produced it
Deliver .... the artifact + what each pass improved + bar met? (or the gap left)
```

## Slash invocation

```
/whetstone <artifact> [--passes=N] [--bar="..."] [--critic] [--out=path] [--confirm]
```

| Arg | Default | Meaning |
|---|---|---|
| `<artifact>` | — | The ONE thing to grind. Inline prose/design/spec, a file path, or "the draft we just wrote". |
| `--passes=N` | `3` | Max grind passes. **Clamp 1–6** (`>6` → clamp 6 + warn: diminishing returns; `<1` → bump 1). Loop stops early on bar-met or convergence. |
| `--bar="..."` | inferred | The criteria the artifact must meet — what "sharp enough" means. Absent → infer reasonable quality criteria for the artifact type and **state them** in the Throw. |
| `--critic` | separate critic | Spawn a **separate** critic agent each pass for independent eyes (default — independence makes the critique honest). Turn the flag *off* only to have the orchestrator self-critique. |
| `--out=path` | conversation | Persist the converged artifact. |
| `--confirm` | off | The only gate — print the grind plan and wait before the first pass. |

Output is terse — the sharpened artifact is the product, not the pass-by-pass narration.

## Roles & artifacts

- **You** — hand over the artifact. No live decisions unless `--confirm`.
- **Orchestrator** — frames the bar, runs the loop, keeps the best version each pass, writes the deliverable. Sole author.
- **Critic** (each pass) — reads the current version against the bar, returns **concrete, actionable** weaknesses to fix. Constructive and specific — its job is to make the next version sharper, not to refute the artifact.
- **Reviser** (each pass) — applies the critique, keeps what already works, returns the new version.

No tracker/graph/sprint deps — stands alone.

## Voice — the whetstone

Speak twice: when the blade meets the stone, when the edge is set. Silent through the passes. `{slots}` are the contract; the flavor is mouth. 印 = 砥.

**Throw** (Phase 0, on first pass):
```
砥  one blade to the stone · up to {passes} passes
    grinding: {one-line artifact}
    sharp = {the bar}                                      [write]
```

**The pause** (only `--confirm`):
```
砥  before the first pass — {passes} passes against the bar:
    {artifact}   sharp = {bar}
    speak, and the grinding starts.
```

**Return** (Phase 3, precedes the converged artifact):
```
砥  sharpened in {used}/{passes} passes · bar {met │ not met} · stopped on {bar-met │ converged │ passes-spent}
    p1 → {what it sharpened, terse}
    p2 → {what it sharpened}
    {…}   best = pass {k}
```

**No edge** (passes spent, bar unmet — best version still falls short):
```
砥  {passes} passes spent, still short of the bar.
    best = pass {k}. the gap that remains: {what the bar still asks for}
```

---

## Phase 0 — Frame (no gate)

Resolve `--passes` (clamp 1–6), `--bar`, `--critic` (default: separate critic), `--out`, `--confirm`. Read the artifact once; this is the **prior best** going into pass 1.

**Set the bar** — the concrete criteria the artifact must meet for "sharp enough": the properties it must have, the standard it's judged against, what a sharp version looks like vs a dull one. `--bar` set → use it verbatim. Absent → infer reasonable criteria for the artifact type (prose: clear · tight · correct · well-ordered; a function: correct · readable · handles edges · no waste; a spec: complete · unambiguous · testable) and **state them** in the Throw. A loop with no bar can't tell sharp from spinning.

Emit the **Throw** template, then grind. `--confirm` → emit **The pause** and wait.

---

## Phase 1 — Grind (loop, serial)

One pass at a time on the **current best** version. Each pass = critique → revise → keep the better.

**a. Critique.** Get concrete weaknesses against the bar. Default (`--critic`): spawn ONE critic agent — `subagent_type: general-purpose`, `run_in_background: true`, `description` e.g. `Critic pass {p}`. (Flag off → orchestrator self-critiques to the same shape.)

### Critic prompt template

```
You are a critic helping to sharpen ONE artifact. Your job is to make the next
version BETTER — not to reject it, not to rewrite it. Find concrete, fixable
weaknesses; assume the artifact stays and improves.

Artifact (current version, pass {p}):
{artifact verbatim}

The bar it must meet:
{bar}

Read it against the bar. Name the specific things that fall short and how to fix
each — be concrete and actionable (a vague "make it better" is useless; "para 3
buries the conclusion — lead with it" is useful). Note what already meets the bar
so the reviser keeps it.

Return EXACTLY:
  - Improvements: a ranked list, each = the weakness (specific, located) + the fix.
  - Keep: what already meets the bar and must NOT be lost in revision.
  - Bar check: which bar criteria are met now, which are not.
  - Verdict: meets-the-bar | close | needs-work.
Your final message IS your critique — concrete fixes, not chat.
```

**b. Revise.** Spawn ONE reviser to apply the critique — `subagent_type: general-purpose`, `run_in_background: true`, `description` e.g. `Reviser pass {p}`:

```
You hold ONE artifact and a critique of it. Apply the improvements; keep
everything in "Keep". Don't over-rewrite — change what the critique calls out,
preserve what already works.
Artifact (current version): {current best}
Critique to apply: {improvements + keep list}
Bar: {bar}
Return the revised artifact in full + a 1-line note on what this pass changed.
When the artifact is a file, apply the revision to its file(s) — same file, no commit/push.
```

**c. Keep the better.** Compare the revised version to the prior best **against the bar**.
- **Sharper** → it becomes the new best; log what this pass improved.
- **Regressed** (worse against the bar — over-rewritten, lost a "Keep", introduced a flaw) → **discard it, keep the prior best.** Never let the artifact get worse. A regressed pass counts toward `--passes`.

**Stop** when: the best version **meets the bar** (→ done, stop early) · a pass yields **no meaningful gain** over the prior best (converged — grinding a dull stone; stop) · `--passes` **exhausted** (→ deliver best; if it still misses the bar, that's the **No edge** case). Two regressions in a row also = converged — stop.

When the artifact is a file, only the best version stays on disk by default; if a pass regresses, restore the prior best to the file. When the artifact has no file on disk — pure prose, a spec, a design in words — the sharpened text is returned inline; that is the deliverable's natural form, not a miss. Orchestrator never commits.

---

## Phase 2 — Converge

Orchestrator's own call. The deliverable is the **single best version** across all passes — not necessarily the last one (a regressed final pass loses to an earlier best). Record which pass produced it and what each pass changed.

Honesty on the bar: if the best version meets it, say met; if passes ran out short, say so and name the gap — don't launder a dull edge as sharp.

---

## Phase 3 — Deliver

Terse. Emit, in order:

- **Return** template (or **No edge** if passes spent and the bar's unmet) — `{used}/{passes}`, bar met?, what each pass sharpened, which pass was best.
- **The converged artifact** — the single best version (to `--out` if set; on disk when the artifact is a file; returned inline when it has no file).
- **Next step** — review and commit (the skill never commits).

---

## Principles

- **One blade, many passes.** The split is by iteration — same artifact, ground again and again — not by aspect or by redundant attempts. The loop is the asset.
- **The critic helps, it does not kill.** Every pass looks for concrete fixes that make the next version sharper. A critic trying to refute the artifact is the wrong tool.
- **Never ship a regression.** Keep the best version every pass; a worse revision is discarded, not delivered.
- **No file, no miss.** An artifact with no file on disk (prose, a spec, a design in words) has nothing to land — the sharpened text returned is the deliverable, not a miss.
- **Stop when it stops sharpening.** Bar met, or no meaningful gain — quit. Don't spin a dull stone for the remaining passes.
- **Independence sharpens.** A separate critic each pass sees what the reviser can't; default to it.
- **Right-size the grind.** Default 3, clamp 1–6 — past 6 the stone takes off more than it sets.
- **Fire without a gate; run to convergence.** `--confirm` is the only pause.

## Don't

- Don't gate, ask, or pause unless `--confirm` is set.
- Don't let the critic try to break or reject the artifact — it finds fixes, not fatal flaws.
- Don't deliver a version worse than an earlier pass produced — keep the best, always.
- Don't keep grinding once the bar is met or a pass adds nothing — stop on convergence.
- Don't over-revise: a pass changes what the critique calls out and preserves the rest.
- Don't slice the artifact across agents or run independent attempts — this is one artifact, one loop.
- Don't commit, push, or PR — the user reviews and commits.
- Don't exceed 6 passes — diminishing returns, and the stone starts grinding away what was good.
