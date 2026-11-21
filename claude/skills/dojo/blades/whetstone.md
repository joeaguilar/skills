# /dojo whetstone — one blade, ground sharp pass after pass

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
/dojo whetstone <artifact> [--passes=N] [--bar="..."] [--bar-cmd="command"] [--critic] [--out=path] [--confirm]
```

| Arg | Default | Meaning |
|---|---|---|
| `<artifact>` | — | The ONE thing to grind. Inline prose/design/spec, a file path, or "the draft we just wrote". |
| `--passes=N` | `3` | Max grind passes. **Clamp 1–6** (`>6` → clamp 6 + warn: diminishing returns; `<1` → bump 1). Loop stops early on bar-met or convergence. |
| `--bar="..."` | inferred | The criteria the artifact must meet — what "sharp enough" means. Absent → infer reasonable quality criteria for the artifact type and **state them** in the Throw. |
| `--bar-cmd="…"` | none | The bar as a command: exit `0` = met, anything else = not. Needs the artifact on disk. The orchestrator runs it after every revision; while it is non-zero the loop cannot stop on bar-met. |
| `--critic` | separate critic | Spawn a **separate** critic agent each pass for independent eyes (default — independence makes the critique honest), seated on the `reviewer` role: never the reviser's model. Turn the flag *off* only to have the orchestrator self-critique. |
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
    {only with --bar-cmd:} cmd: {bar-cmd}   [{proves │ guard only}]
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

**`--bar-cmd` set → the bar is an exit code.** `0` = met, anything else = not. Run it yourself, never on a critic's or reviser's word: `gatr run --tag dojo-whetstone -- <cmd>` when `gatr` is on PATH (then `gatr last` / `gatr errors`), the bare command otherwise. Run it once now, on the prior best: non-zero → it proves the work (must reach `0`); already `0` → it proves nothing and only guards (must stay `0`) — mark `guard only` in the Throw and keep judging `--bar` as before. Artifact has no file on disk → `--out` set: write the artifact there first and grind that file. No `--out` either → the command has nothing to read and the bar it names can't be checked: say so and stop before the first pass — a dropped gate is worse than no grind.

Emit the **Throw** template, then grind. `--confirm` → emit **The pause** and wait.

---

## Phase 1 — Grind (loop, serial)

One pass at a time on the **current best** version. Each pass = critique → revise → keep the better.

**a. Critique.** Get concrete weaknesses against the bar. Default (`--critic`): spawn ONE critic agent — `subagent_type: general-purpose`, `run_in_background: true`, `description` e.g. `Critic pass {p}`. (Flag off → orchestrator self-critiques to the same shape. That is the user waiving the independent seat on purpose: the seat rule below does not apply, and the Return says `self-critiqued`.)

**Seat the critic off the reviser's model.** The critic runs on the `reviewer` role. Read `~/.claude/MODELS.md` at spawn and take its binding against **whoever wrote the version on the stone**: the artifact's author when that is known (stated by the user, or this session), and the reviser (the session model) from the first revision on. The seat must differ from both — a different model, other provider first. Claude binding → pass `model`; GPT binding → launch it the way that file's Reach section says. File unreadable or seat unreachable → a different Claude model than the author and the reviser, and name the fallback in the Return. Never the author's or the reviser's own model — it would only agree with itself.

### Critic prompt template

```
盟約 MEIYAKU — you are sworn. Four laws, no exceptions:
1. ABSOLUTE FOCUS — no filler, no pleasantries, nothing unasked. The work, directly.
2. SHADOW EFFICIENCY — a clean blade strike: minimal, optimized, zero bloat, no needless dependency.
3. UNYIELDING DISCIPLINE — every edge case, error state, and vulnerability handled. Leave no tracks: no bugs, no debris, no dead code.
4. FAITHFUL EXECUTION — the spec exactly; assume nothing, invent nothing, verify before you claim.
Break a law and the clan falls. Execute.

You are a critic helping to sharpen ONE artifact. Your job is to make the next
version BETTER — not to reject it, not to rewrite it. Find concrete, fixable
weaknesses; assume the artifact stays and improves.

Artifact (current version, pass {p}):
{artifact verbatim}

The bar it must meet:
{bar}
{--bar-cmd: Bar command (exit 0 = met) and its last result on this version:
{bar-cmd} → exit {code} — {failing tail, or "passing"}}

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
盟約 MEIYAKU — you are sworn. Four laws, no exceptions:
1. ABSOLUTE FOCUS — no filler, no pleasantries, nothing unasked. The work, directly.
2. SHADOW EFFICIENCY — a clean blade strike: minimal, optimized, zero bloat, no needless dependency.
3. UNYIELDING DISCIPLINE — every edge case, error state, and vulnerability handled. Leave no tracks: no bugs, no debris, no dead code.
4. FAITHFUL EXECUTION — the spec exactly; assume nothing, invent nothing, verify before you claim.
Break a law and the clan falls. Execute.

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

**With `--bar-cmd`** run the command after each revision lands in the file, before comparing. A revision that turns it from `0` to non-zero **regressed** — discard it, restore the prior best, whatever else it improved. **Bar met needs `0`:** while the command is non-zero the loop cannot stop on bar-met, whatever the critic's verdict says — and `0` alone meets the bar only when the command proves the work and no `--bar` was given beside it. It may still stop on convergence or spent passes → **No edge**, with the failing tail as the gap — and then **nothing is committed**: the best version stays in the file, uncommitted, for the user. Only a version the command passed (`0`) is ever committed.

**Stop** when: the best version **meets the bar** (→ done, stop early) · a pass yields **no meaningful gain** over the prior best (converged — grinding a dull stone; stop) · `--passes` **exhausted** (→ deliver best; if it still misses the bar, that's the **No edge** case). Two regressions in a row also = converged — stop.

When the artifact is a file, only the best version stays on disk by default; if a pass regresses, restore the prior best to the file. When the artifact has no file on disk — pure prose, a spec, a design in words — the sharpened text is returned inline; that is the deliverable's natural form, not a miss. Revisers never commit; the orchestrator commits the sharpened file at the end — unless the user asked for no commit, or `--bar-cmd` is set and its last run on that version was non-zero.

---

## Phase 2 — Converge

Orchestrator's own call. The deliverable is the **single best version** across all passes — not necessarily the last one (a regressed final pass loses to an earlier best). Record which pass produced it and what each pass changed.

Honesty on the bar: if the best version meets it, say met; if passes ran out short, say so and name the gap — don't launder a dull edge as sharp.

---

## Phase 3 — Deliver

Terse. Emit, in order:

- **Return** template (or **No edge** if passes spent and the bar's unmet) — `{used}/{passes}`, bar met?, what each pass sharpened, which pass was best.
- **The converged artifact** — the single best version (to `--out` if set; on disk when the artifact is a file; returned inline when it has no file).
- **Commit** — when the artifact is a file, the orchestrator commits the sharpened version, unless the user asked for no commit — or `--bar-cmd` is set and its last run on that version was non-zero (then no commit).

---

## Principles

- **One blade, many passes.** The split is by iteration — same artifact, ground again and again — not by aspect or by redundant attempts. The loop is the asset.
- **The critic helps, it does not kill.** Every pass looks for concrete fixes that make the next version sharper. A critic trying to refute the artifact is the wrong tool.
- **Never ship a regression.** Keep the best version every pass; a worse revision is discarded, not delivered.
- **No file, no miss.** An artifact with no file on disk (prose, a spec, a design in words) has nothing to land — the sharpened text returned is the deliverable, not a miss.
- **Stop when it stops sharpening.** Bar met, or no meaningful gain — quit. Don't spin a dull stone for the remaining passes.
- **A command outranks a verdict.** With `--bar-cmd`, bar-met is an exit code the orchestrator ran — never the critic's `meets-the-bar` alone.
- **Independence sharpens.** A separate critic each pass sees what the reviser can't; default to it — and seat it on the `reviewer` role, a different model from the reviser's.
- **Right-size the grind.** Default 3, clamp 1–6 — past 6 the stone takes off more than it sets.
- **Fire without a gate; run to convergence.** `--confirm` is the only pause.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. An artifact with no file on disk has nothing to commit. One more exception: a version `--bar-cmd` left non-zero is never committed.

## Don't

- Don't gate, ask, or pause unless `--confirm` is set.
- Don't let the critic try to break or reject the artifact — it finds fixes, not fatal flaws.
- Don't seat the critic on the reviser's model — resolve the `reviewer` role, every pass.
- Don't deliver a version worse than an earlier pass produced — keep the best, always.
- Don't keep grinding once the bar is met or a pass adds nothing — stop on convergence.
- Don't call the bar met while `--bar-cmd` exits non-zero, and don't keep a revision that broke it.
- Don't over-revise: a pass changes what the critique calls out and preserves the rest.
- Don't slice the artifact across agents or run independent attempts — this is one artifact, one loop.
- Don't push or PR. The reviser never commits — the orchestrator commits the sharpened file, unless the user asked otherwise or `--bar-cmd` still exits non-zero.
- Don't exceed 6 passes — diminishing returns, and the stone starts grinding away what was good.
