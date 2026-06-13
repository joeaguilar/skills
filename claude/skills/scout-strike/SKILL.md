---
name: scout-strike
description: Attack UNFAMILIAR terrain in two phases — first throw 2–5 read-only scouts (default 3, `--scouts=N`) to map the unknown ground, fuse their findings into one terrain map, then drive a focused strike (default 1, `--strikers=N`) that exploits the map to do the actual work. Explore then exploit — discovery feeds exploitation. Autonomous: infers the split, scouts then strikes without a gate; but never strikes blind — if the scouts map nothing usable, it surfaces the fog and stops. Trigger when the user types `/scout-strike`, or asks to "scout then do the work", "recon this strange codebase then fix X", "map it before you touch it", "explore the unknown area then act", "figure out the lay of the land then strike", "survey first then implement", or "I don't know this code — find your way around then make the change". Works for changes in unscoped/unfamiliar code, audits-then-fixes, and any "map-then-commit" task (`--write` for the strike). Do NOT trigger when the terrain is already known and no recon is needed — just decompose the work and act in parallel (a plain disjoint-aspect fan); for pure research with NO follow-on action — a read-only pass that ends at findings (a research/recon-only job); or to make N independent blind attempts at the whole and vote (a consensus swarm).
---

# /scout-strike — scout the dark, then one flash of steel

One task on unfamiliar ground. The orchestrator first looses read-only scouts to **map** the terrain, fuses their reports into one map, then drives a **focused strike** that exploits the map to do the real work. Explore, then exploit — the strike commits where the scouts revealed it should.

**Ninja posture.** Infer the split and move — **no gate** (unless `--confirm`). The two phases hold different stances: the scout pass is **cheap and tolerant** — a lost scout is just a thinner map, synthesize from the rest. The strike is the **committed act** — but do NOT strike blind: if scouts return nothing usable about the terrain, surface the fog and stop rather than commit into the dark. Map first; strike once; run straight through.

## The loop at a glance

```
Frame ...... split recon vs execute, pick the scout slices            [silent — pause only on --confirm]
Scout ...... N scouts (parallel, READ-ONLY) map slices of the terrain, touch nothing
Map ........ fuse scout reports into ONE terrain map
              usable map → strike │ nothing usable → report the fog, stop (no blind strike)
Strike ..... focused striker(s), HANDED THE MAP, do the real work (--write may edit)
Deliver .... the strike output + what the map revealed
```

## Slash invocation

```
/scout-strike <task> [--scouts=N] [--strikers=N] [--write] [--out=path] [--confirm]
```

| Arg | Default | Meaning |
|---|---|---|
| `<task>` | — | The task on unfamiliar ground. Inline prose, a spec path, or "the thing we just discussed". |
| `--scouts=N` | `3` | Read-only scouts mapping the terrain. **Clamp 2–5** (`>5` → clamp 5 + warn: map fusion degrades past ~5; `<2` → bump 2). |
| `--strikers=N` | `1` | Focused strikers exploiting the map. Default `1` (one committed strike). Raise to **fan the strike** across disjoint mapped targets. |
| `--write` | off | The **strike** may edit files (disjoint sets). Scouts are **always** read-only. Off → strike returns artifacts only. |
| `--out=path` | conversation | Persist the strike output (+ map). Default → deliver inline. |
| `--confirm` | off | The **only** gate — shown **after the map, before the strike**. Print the strike plan and wait. Default fires without asking. |

Unsupplied flags resolved in Phase 0. Output is terse — the strike output is the product, not the recon narration.

## Roles & artifacts

- **You** — throw the task. No live decisions unless `--confirm` (the gate sits between map and strike).
- **Orchestrator** — splits recon from execute, looses scouts, **fuses the map**, drives the strike. Sole author of the deliverable.
- **Scouts** — `--scouts` agents, parallel, **read-only**, each mapping a slice of the terrain; return findings, touch nothing.
- **Striker(s)** — `--strikers` agents (default 1), **handed the fused map**, do the committed work; `--write` lets them edit disjoint files.

No tracker/graph/sprint deps — stands alone.

## Voice — the scout in shadow, then the one flash

Speak twice: when the scouts are loosed, when the strike lands. Between them, **one terse map line** bridges the phases — it is the same run, not a second surfacing. `{slots}` are the contract. 印 = 偵.

**Throw** (Phase 1, scouts loosed):
```
偵  {N} scouts into the dark · mapping the terrain                    [read-only]
    {slice1} · {slice2} · … · {sliceN}
```

**Return** (Phase 4, the strike landed — precedes the strike output):
```
偵  the map drawn, the strike landed                                  [report │ write→out=path]
    terrain revealed: {1–2 lines — what the scouts found that mattered}
    strike: {what the striker(s) did, exploiting the map}
    ─ open: {what the map left dark / unstruck, or omit}
```

**The pause** (only `--confirm` — after the map, before the strike):
```
偵  the map is drawn — before the strike flies:
    terrain: {what the scouts revealed, in brief}
    strike will: {the planned committed act}            [{N} striker(s) · {read │ write}]
    speak, and the steel falls.
```

**Fog** (scouts found nothing usable — no strike):
```
偵  {N} scouts returned, but the terrain stayed dark — no map to strike from.
    {what little came back, or why the ground gave nothing}. no blind strike.
```

---

## Phase 0 — Frame (no gate)

Resolve `--scouts` (clamp 2–5), `--strikers` (default 1), `--write`, `--out`, `--confirm`. Read the task once.

**Split recon from execute** — name the unknowns the scouts must resolve before a strike is safe, then cut the terrain into `--scouts` read-only slices that cover those unknowns:

| Slice the terrain by… | When |
|---|---|
| subsystem / directory | the unknown spans separable areas of the code |
| layer (data → logic → UI) | the change threads through a stack you don't yet know |
| question (where is X · who calls Y · what is the convention) | the unknowns are discrete open questions |
| surface vs depth (entry points · then the path they reach) | one slice maps the doorway, another the room behind it |

Fewer clean slices than `--scouts` → throw fewer (don't manufacture filler recon). The slices need not be disjoint — overlapping scouts is cheap insurance for a fuller map.

Emit the **Throw** template, then loose the scouts immediately. (`--confirm` does **not** pause here — its gate is later, between map and strike.)

---

## Phase 1 — Scout (parallel, read-only)

Spawn all `--scouts` agents **in parallel** — one Agent call per slice, single batch, concurrent:

- `subagent_type: general-purpose`.
- `run_in_background: true`.
- `description`: e.g. `Scout: <slice>`.
- `prompt`: the **scout** template below.

### Scout prompt template (read-only recon)

```
You are scout {i} of {N} mapping UNFAMILIAR terrain for a strike that comes after you.
You do NOT do the work — you find out what the work will face. READ-ONLY: read, search,
trace, run read-only inspection. Do NOT edit, move, create, format, commit, or run
anything that changes state. Touch nothing.

The task the strike will perform (context — NOT yours to do):
{task restatement}

YOUR SLICE OF TERRAIN — {slice title}:
{what to map — concrete: which area / question / layer}

Map it for the striker. Report what is actually there, not what you'd do about it:
  - where the relevant code / files / entry points live (paths + line refs)
  - the conventions, patterns, and constraints in force here
  - the hazards: coupling, sharp edges, anything that would surprise a blind strike
  - the open unknowns you could NOT resolve in this slice

Return EXACTLY:
  - Terrain: the map of your slice (paths, refs, patterns, hazards — concrete).
  - Strike-relevant: the 1–3 findings that most change how the strike should land.
  - Unknowns: what your slice left dark, or "none".
  - Confidence: high | medium | low + why.
Your final message IS your map — data, not chat. Be self-contained. Edit nothing.
```

A scout that fails, errors, or stalls is a **thinner map**, not a crisis — one-line note, no retry/respawn, fuse from the rest.

---

## Phase 2 — Map (fuse the recon)

Orchestrator's own work. Collect each scout's map as it lands and fuse the slices into **one terrain map**:

1. **Stitch** the slices into a single coherent picture — paths, conventions, hazards in one place.
2. **Reconcile** scouts that disagree about the terrain — resolve, or flag the uncertainty for the striker.
3. **Mark the dark** — unknowns no scout resolved; the striker must treat these as live risk.
4. **Distill the strike-relevant findings** — the handful of things that actually shape how the strike lands. This is what the striker prompt carries.

**Usability gate:** does the map give the striker enough to strike *informed*? **Yes** → emit the bridging map line (the one terse line between Throw and Return) and proceed. **No usable terrain came back** (scouts whiffed, or the ground gave nothing) → emit the **Fog** template and **stop**. Do not strike blind.

`--confirm` set → emit **The pause** template now (after the map, before the strike) and **wait** for go.

---

## Phase 3 — Strike (exploit the map)

Spawn `--strikers` agent(s) — default **1** (a single focused strike). With `--strikers>1`, fan the strike across **disjoint** mapped targets the map identified (under `--write`, disjoint file sets are mandatory — two strikers on one file clobber).

- `subagent_type: general-purpose` (a specialized type only if one squarely fits).
- `run_in_background: true`.
- `description`: e.g. `Strike` (or `Strike {i}/{N}`).
- `prompt`: the **strike** template below — **hand it the fused map**.

### Strike prompt template (do the work, informed by the map)

```
You are the strike. Scouts have already mapped this terrain — you exploit their map
to do the real work precisely. Do NOT re-explore from scratch; trust and use the map,
verifying only where it marks the ground dark.

The task — do this:
{task restatement}

THE TERRAIN MAP (what the scouts found — your starting knowledge):
{fused map — paths, conventions, hazards, strike-relevant findings}

KNOWN DARK SPOTS (map left these unresolved — treat as live risk, verify before you rely on them):
{unknowns the scouts could not resolve, or "none"}

{--strikers>1 only:}
You are striker {i} of {N}. Your target: {this striker's disjoint slice of the map}.
Siblings strike the other targets — stay in yours; do NOT touch theirs.

{--write mode only:}
Files you OWN (edit only these): {owned file set}
Do NOT edit/move/reformat anything outside this set — a sibling or unrelated code is
in it, and a stray edit or project-wide formatter clobbers it. Do NOT commit, push,
branch, or PR.

Deliver back EXACTLY:
{deliverable shape — e.g. "the change (on disk) + a 5-line summary of what & where"
 │ "the implemented artifact + how the map guided each decision"}

Close with:
  - Used-the-map: which map findings shaped the strike (so the recon's value is visible).
  - Surprises: anything the terrain did that the map didn't predict, or "none".
  - Gaps: anything you couldn't complete, or "none".
Your final message IS your strike — data, not chat. Be self-contained.
```

`--write` → striker file sets disjoint. Orchestrator never commits — the user reviews and commits.

---

## Phase 4 — Deliver

Terse. Emit, in order:

- **Return** template (see Voice) — terrain revealed + what the strike did, including any `open:` dark spots.
- **The strike output** — the deliverable (to `--out` if set; on disk if `--write`).
- **`--write` next step** — review and commit (the skill never commits).

---

## Principles

- **Explore, then exploit.** Two phases, one direction: scouts map, the strike commits where the map points. Discovery feeds exploitation — never the reverse.
- **Scouts are read-only, always.** They map the terrain and touch nothing — `--write` only ever arms the strike. A scout that edits has broken the split.
- **The scout pass is cheap and tolerant.** A lost scout is a thinner map, noted and moved past — no retry, no respawn.
- **Never strike blind.** The strike is the committed act; if the map is empty, surface the fog and stop. Striking into the dark wastes the very effort the recon was meant to save.
- **Hand the striker the map.** The strike's whole advantage is the recon — the striker prompt carries the fused findings, so the work lands informed.
- **Fire without a gate.** `--confirm` is the only pause, and it sits at the natural seam — after the map, before the strike.
- **Right-size the recon.** Scouts default 3, clamp 2–5; strikers default 1, raised only to fan across disjoint mapped targets.

## Don't

- Don't gate, ask, or pause unless `--confirm` is set (and then only after the map, before the strike).
- Don't let a scout edit, create, move, or run anything stateful — recon is read-only, no exceptions.
- Don't retry, resume, or respawn a missed scout — a thinner map is fine.
- Don't strike when the scouts mapped nothing usable — emit the fog and stop instead of committing blind.
- Don't make the striker re-explore from scratch — hand it the fused map and let it exploit it.
- Don't give two `--write` strikers a shared file.
- Don't commit, push, or PR in `--write` mode — the user reviews and commits.
- Don't exceed 5 scouts — map fusion degrades past what one orchestrator stitches well.
