---
name: feint
description: "Preview ONE task read-only — walk the whole motion, produce the exact change that WOULD land (diff · plan · artifact), touch nothing. The Dojo's one read-only blade: every execution blade now writes by default, so `/feint` is how you see the cut without making it. Trigger: `/feint`, `/feint-attack`, \"dry run\", \"show me what it'd do without doing it\", \"preview the change\", \"what would this touch\", \"read-only pass\". NOT to actually land the change (invoke the execution blade itself — they write by default), NOT for recon-then-strike where you DO want the fix (use /scout-strike), NOT for naming the next step (use /tsugi)."
---

# /feint — 虚

The empty attack. Full motion, no contact. You want the shape of the strike without the strike — so the blade travels the whole line, writes the cut in full, and lands nothing. What comes back is the cut you did not make.

**Ninja posture.** No gate — feint touches nothing, so there is nothing to confirm. Infer the split, walk it read-only, hand back the preview. The stance is **tolerant**: a probe that whiffs is a thinner preview, not a stop — synthesize from the rest. The one law is absolute: **feint never writes.** If it lands anything, it was not a feint.

## The loop at a glance

```
Frame ..... read the task, pick the probe slices                     [silent]
Probe ..... N probers (parallel, READ-ONLY) walk the task, draft the would-be change, touch nothing
Fuse ...... stitch the drafts into ONE preview — the full change that WOULD land + where + risk
Return .... the cut you did not make · nothing on disk
```

## Slash invocation

```
/feint <task> [--probes=N] [--out=path]
```

| Arg | Default | Meaning |
|---|---|---|
| `<task>` | — | the task to preview — inline prose, a spec path, or "the thing we just discussed" |
| `--probes=N` | `1` | read-only probers walking the task. **Clamp 2–5** (`>5` → clamp 5 + warn; `<1` → bump 1). Raise to preview a task too wide for one prober to draft cleanly. |
| `--out=path` | conversation | persist the preview (diff / plan / artifact). Default → hand it back inline. |

No `--write` — **the feint has no write mode**; that is its whole identity. No gate — nothing lands, so nothing to confirm.

## Roles & artifacts

- **You** — throw the task. You get back what *would* happen, never the happening.
- **Orchestrator** — cut the probe slices, loose the probers, **fuse the preview**. Sole author of the deliverable. Applies nothing.
- **Probers** — `--probes` agents, parallel, **read-only always**, each drafting the would-be change for a slice; return the draft, touch nothing.

No tracker/graph/sprint deps — stands alone.

## The way of the feint

Every execution blade in the Dojo now writes by default — invoke one, and the cut lands. The feint is the deliberate opposite: the one motion that goes through everything **except** the landing. It is not a weaker blade; it is the same swing, stopped a hair from the mark, so you can read the mark. Draft the change as fully as a real strike would — real paths, real diffs, real edits — then withhold the disk.

## Phase 0 — Frame (no gate)

Resolve `--probes` (clamp 2–5), `--out`. Read the task once. If one prober can draft the whole would-be change cleanly, keep `--probes=1`. Split only when the change spans separable surfaces — cut the slices by subsystem, by file cluster, or by question. Fewer clean slices than `--probes` → throw fewer.

Emit the **Throw** template, loose the probers.

## Phase 1 — Probe (parallel, read-only)

Spawn all `--probes` agents in parallel — one Agent call per slice, single batch:

- `subagent_type: general-purpose`.
- `run_in_background: true`.
- `description`: e.g. `Feint: <slice>`.
- `prompt`: the prober template.

### Prober prompt template (read-only — draft the cut, don't make it)

```
You are prober {i} of {N}. You draft a change you will NOT apply. READ-ONLY: read,
search, trace, run read-only inspection. Do NOT edit, create, move, format, commit,
or run anything that changes state. Touch nothing.

The task the change would perform:
{task restatement}

YOUR SLICE — {slice title}:
{what to draft — which files / area / question}

Walk it as if you were about to make the change, then STOP at the disk. Report the
change in full, as a real strike would land it:
  - Would-land: the exact change — unified diff, or full before/after of each edited
    region, with real paths + line refs. Concrete enough to apply verbatim.
  - Where: every file/site the change would touch (and any it would create/delete).
  - Risk: what could go wrong if this were applied blind — coupling, sharp edges,
    anything a real strike should watch.
  - Unknowns: what you could not resolve read-only, or "none".
Your final message IS your draft — data, not chat. Apply nothing. Edit nothing.
```

A prober that fails is a thinner preview — one-line note, no retry, fuse from the rest.

## Phase 2 — Fuse (the preview)

Orchestrator's own work. Stitch the drafts into **one preview**:

1. **Assemble** the would-land change across slices into a single coherent diff/plan.
2. **Reconcile** probers that overlap or disagree; flag any conflict the real strike would hit.
3. **Surface the risk** — the handful of things a real strike should watch, and any unknowns no prober resolved.
4. **State plainly that nothing landed** — this is a feint.

## Phase 3 — Return

Terse. Emit, in order:

- **Return** template (see Voice) — what would land + where.
- **The preview** — the full would-be change (to `--out` if set; inline otherwise). Clearly marked *not applied*.
- **To land it** — one line: this was read-only; to make the cut, throw the execution blade that fits. (Never name a sibling here — just say the feint withheld the disk.)

## Voice — walk the line, land nothing. 印 = 虚

Speak twice: when the probers are loosed, when the preview returns. `{slots}` are the contract.

**Throw** (probers loosed):
```
虚  the feint — {N} probe(s) walk {task, one phrase}                  [read-only · nothing lands]
    {slice1} · … · {sliceN}
```

**Return** (preview drawn back):
```
虚  the feint drawn back · here is the cut you did not make
    would land: {1–2 lines — the change} · {where}
    ─ risk: {what a real strike should watch, or omit}
    nothing on disk. throw the blade to make it real.
```

**Empty** (probers could draft nothing usable):
```
虚  the probes walked, but drew no cut — {why the ground gave nothing}.
    nothing to preview, nothing landed.
```

## Principles

- **Full motion, no contact.** Draft the change as completely as a real strike would land it — real diffs, real paths. A vague preview is a wasted feint.
- **Never writes — the one absolute.** Probers and orchestrator touch nothing. If anything lands, it was not a feint.
- **No gate.** Nothing reaches disk, so there is nothing to confirm; run straight through.
- **Tolerant probe pass.** A lost prober is a thinner preview, noted and passed — no retry, no respawn.
- **Right-size.** Probes default 1, clamp 2–5; split only when one prober can't draft the whole change cleanly.
- **The preview is the product.** Terse elsewhere; the withheld cut is what you hand back.

## Don't

- Don't edit, create, move, format, or run anything stateful — the feint is read-only, no exceptions.
- Don't apply the draft — handing back a preview and landing it are opposite acts.
- Don't gate or wait — nothing lands, so nothing needs confirming.
- Don't retry or respawn a missed prober — a thinner preview is fine.
- Don't return a vague sketch — draft the would-be change concretely enough to apply verbatim.
- Don't name a sibling blade as "the one to run for real" — say the feint withheld the disk; the router knows the rest.
