---
name: shuriken-storm
description: "Throw ONE uniform operation across MANY small disjoint targets in a waved parallel volley — each target gets its own shuriken (agent), lands independently on disk, no synthesis; misses surface as a re-throw list. Runs on a harness-capped `Workflow` by default so a wide volley can't rate-limit-block the session (hand-rolled `Agent` fallback only when workflows aren't opted in). Built for breadth: dozens of identical-shaped cuts (docstring every function, add the null-check to all call sites, port each fixture to the new format). Trigger: `/shuriken-storm`, \"do X to every Y\", \"apply this across all these files/functions\", \"saturate this field\", \"storm these targets\". NOT for a heterogeneous tracker backlog with grooming + a verify gate (use /blitz), NOT for cutting ONE task into different aspects to synthesize (use /fan-of-agents), NOT for routing parts to different specialists by type (use /the-clan)."
---

# /shuriken-storm — 嵐

The single blade is one perfect cut. The storm is a hundred imperfect ones, thrown at once, and the field falls anyway. ONE operation, many small targets, a wide volley — each shuriken lands on its own wood, blind to the rest.

**Ninja posture.** No gate unless `--confirm`. Speak at the loosing and at the fall, silence between. The stance is **tolerant** — a lost shuriken is a thinner field, never a stop; the misses surface as a re-throw list, not a crisis. No retry mid-volley — a missed target is re-stormed, not chased.

## The loop at a glance

```
Frame ..... read the operation once · resolve the target field · confirm uniform + disjoint
Storm ..... one Workflow volley (harness-capped) │ fallback: rolling Agent volley ≤ width   [write-by-default]
              one target per shuriken · same operation · blind to the others
Tally ..... collect lands vs misses — NO synthesis · gather the re-throw list
Fall ...... the tally + diff manifest · the misses, ready to storm again
```

## Slash invocation

```
/shuriken-storm <operation> --targets=<glob|list|file> [--width=8] [--bar="..."] [--out=path] [--confirm]
```

| Arg | Default | Meaning |
|---|---|---|
| `<operation>` | — | the ONE uniform cut, applied identically to every target |
| `--targets=…` | — | the field — a glob (`src/**/*.rs`), an inline comma-list, or a file with one target per line. Each target becomes one shuriken. |
| `--substrate=…` | `workflow` | how the volley runs. **`workflow`** (preferred) — one `Workflow` script; the harness enforces the concurrency cap so a wide storm cannot rebound. **`agents`** — hand-rolled background `Agent` calls, capped by `--width` (fallback only; use when workflows aren't opted-in, and state the risk). |
| `--width=N` | `8` | shuriken in flight at once — the rolling-volley cap. **Only governs the `agents` substrate.** Under `workflow` the harness cap (`min(16, cores-2)`) rules and `--width` is ignored. **Clamp 4–12** (`>12` → clamp 12 + warn: a wider volley rebounds as a rate-limit cascade; `<4` → bump 4). |
| `--bar="..."` | inferred | what a clean land means per target — each shuriken self-verifies against it |
| `--out=path` | conversation | persist the tally (lands · misses · diff manifest) |
| `--confirm` | off | the only gate — show the field size, the operation, and one sample shuriken, then wait |

Width is **throughput, not ambition** — the storm is as wide as the field; `--width` only governs how many fly at once. No `--write` flag — a thrown shuriken lands on disk; that is the throw.

## Roles & artifacts

- **You** — name the operation and the field. No live decisions unless `--confirm`.
- **Orchestrator** — resolve the field, loose the rolling volley, **tally** lands vs misses. Sole author of the deliverable. Applies no synthesis — the shuriken land themselves.
- **Shuriken** — one agent per target, thrown in waves, each editing **only its own target**, blind to the rest.

No tracker/graph/sprint deps — stands alone. (For a groomed heterogeneous backlog, that is a different, tracker-driven blade.)

## Phase 0 — Frame (no gate)

Resolve `--targets` into the concrete field (expand the glob / read the list-file / split the inline list), `--width` (clamp 4–12), `--bar`, `--out`, `--confirm`. Read the operation once.

**Two checks decide whether this is even the right blade:**
1. **Uniform?** — the operation must be the *same* cut on every target. If each target needs a *different* kind of work, this is the wrong blade — the storm throws one shape.
2. **Disjoint?** — one shuriken per target, and no two targets share the same wood (same file/function/site). Overlapping targets clobber. Fold or drop overlaps before the volley.

Empty or single-target field → say so and stop (a storm of one is just a single throw). Emit the **Throw** template, then loose the volley. (`--confirm` pauses here — show the field size + operation + one sample shuriken prompt, wait for go.)

## Phase 1 — Storm (write-by-default)

The volley runs on one of two substrates. **Prefer `workflow`.** A wide storm is exactly where a hand-managed fan-out rebounds — too many agents in flight and the whole session gets rate-limit-blocked. This blade is *why* a harness-enforced cap exists; use it.

### 1a — Workflow substrate (preferred) · `--substrate=workflow`

Runs the whole field through **one `Workflow` script**: a single `parallel()` over the targets, where the harness holds only `min(16, cores-2)` shuriken in flight automatically — you never hand-track the cap. Each shuriken returns a **structured land**, so the tally needs no parsing, and a 200-target field queues safely inside that one call (max 4096 items) instead of 200 background agents you babysit.

**The `Workflow` tool is opt-in.** If workflows aren't enabled for the session, do **not** silently drop to the fallback — surface that the storm wants a workflow and either have the user opt in, or make them choose `--substrate=agents` and state the rebound risk out loud. When opted in, author this script (pass `operation`, `bar`, and the resolved `targets` list via the Workflow `args`):

```js
export const meta = {
  name: 'shuriken-storm',
  description: 'One uniform operation thrown across many disjoint targets; tally lands vs misses',
  phases: [{ title: 'Storm' }],
}
// args = { operation, bar, targets: ["<target>", ...] }   ← the resolved field
const { operation, bar, targets } = args
const MEIYAKU = `
盟約 MEIYAKU — you are sworn. Four laws, no exceptions:
1. ABSOLUTE FOCUS — no filler, no pleasantries, nothing unasked. The work, directly.
2. SHADOW EFFICIENCY — a clean blade strike: minimal, optimized, zero bloat, no needless dependency.
3. UNYIELDING DISCIPLINE — every edge case, error state, and vulnerability handled. Leave no tracks: no bugs, no debris, no dead code.
4. FAITHFUL EXECUTION — the spec exactly; assume nothing, invent nothing, verify before you claim.
Break a law and the clan falls. Execute.
`  // (ticks on their own lines keep the oath lines byte-identical to the canon)
const LAND = {
  type: 'object',
  additionalProperties: false,
  properties: {
    target:   { type: 'string' },
    landed:   { type: 'boolean' },
    evidence: { type: 'string' },  // bar-evidence, one line
    change:   { type: 'string' },  // what changed, one line
  },
  required: ['target', 'landed'],
}
phase('Storm')
// Disjoint targets share one checkout safely — NO worktree isolation (it is expensive
// and only for agents that would clobber the same files; these never overlap).
const lands = await parallel(targets.map((t) => () =>
  agent(
    MEIYAKU.trim() + '\n\n' +
    `You are one shuriken in a storm. Your single target: ${t}\n` +
    `The operation, identical across the storm: ${operation}\n` +
    `The bar: ${bar}. Verify your own land — evidence, not confidence.\n` +
    `Edit ONLY ${t}; never commit; you are blind to the other shuriken — touch nothing else. ` +
    `No project-wide formatter (it reaches past your target). A target with nothing to change ` +
    `is a clean no-op, not a miss.`,
    { label: `shuriken:${t}`, phase: 'Storm', schema: LAND }
  )
))
const done   = lands.filter(Boolean)                       // null = agent died/skipped → a miss
const landed = done.filter((l) => l.landed)
const misses = [
  ...targets.filter((t, i) => !lands[i]),                  // never returned
  ...done.filter((l) => !l.landed).map((l) => l.target),   // returned a miss
]
return { landed, misses, thrown: targets.length }          // → the Tally (Phase 2)
```

The script returns the tally already assembled — Phase 2 reads `{ landed, misses, thrown }` straight off it, no collection loop.

### 1b — Agent substrate (fallback) · `--substrate=agents`

Only when workflows aren't available — and say so, because **here the cap is yours to hold** and a large field is what rebounds. Throw a **rolling volley**: keep at most `--width` shuriken in flight; as each lands, loose the next, until the field is empty. Never loose the whole storm at once.

Each shuriken is one agent:
- `subagent_type: general-purpose` (a specialized type only if one squarely fits the operation).
- `run_in_background: true`.
- `description`: e.g. `Shuriken: <target>`.
- `prompt`: the shuriken template.

### Shuriken prompt template (both substrates — one target, land it)

```
盟約 MEIYAKU — you are sworn. Four laws, no exceptions:
1. ABSOLUTE FOCUS — no filler, no pleasantries, nothing unasked. The work, directly.
2. SHADOW EFFICIENCY — a clean blade strike: minimal, optimized, zero bloat, no needless dependency.
3. UNYIELDING DISCIPLINE — every edge case, error state, and vulnerability handled. Leave no tracks: no bugs, no debris, no dead code.
4. FAITHFUL EXECUTION — the spec exactly; assume nothing, invent nothing, verify before you claim.
Break a law and the clan falls. Execute.

You are one shuriken in a storm. Your single target: {target}
The operation, identical across the whole storm: {operation}
The bar: {bar}. Verify your own land — evidence, not confidence.

Edit ONLY {target}; never commit. You are blind to the other shuriken — do NOT touch,
read-for-editing, or reformat anything outside your target. A project-wide formatter or a
stray edit outside {target} clobbers a sibling's wood.

A target with no disk surface (a pure inspection with nothing to change) has nothing to
land — say so; that is a clean no-op, not a miss.

Your final message IS your land:
  target · landed│missed · bar-evidence (one line) · what-changed (one line).
```

A shuriken that errors, stalls, or misses the bar is a **miss** — one-line note, no retry, no respawn mid-volley. It goes on the re-throw list.

## Phase 2 — Tally (no synthesis)

Orchestrator's own work — and the tell that this is not `fan-of-agents`: **there is nothing to stitch.** Each shuriken already landed on its own target. Under `workflow` the script already returned `{ landed, misses, thrown }` — read it straight off. Under `agents`, collect the returns yourself. Either way, assemble:

1. **Lands** — targets struck clean (bar-evidence + one-line change each).
2. **Misses** — targets that erred, stalled, or failed the bar → the **re-throw list** (verbatim target list, storm-able again as-is).
3. **No-ops** — targets that needed no change (clean, not misses).
4. **Manifest** — the union of what landed across the field (paths + one-line changes), for review.

## Phase 3 — Fall (deliver)

Terse. Emit, in order:

- **Fall** template (see Voice) — lands/total clean, misses skittered.
- **The tally + manifest** — to `--out` if set; inline otherwise.
- **Re-throw** — the miss list, offered as a fresh `--targets` for a second storm. The orchestrator commits the landed volley (unless the user requested no commit); the user reviews.

## Voice — the whistle, then the fall. 印 = 嵐

Speak twice: when the shuriken are loosed, when the field falls. `{slots}` are the contract.

**Throw** (volley loosed):
```
嵐  {N} shuriken loosed · {operation, one phrase} · {width} in flight
```

**Fall** (field struck):
```
嵐  the field fell · {landed}/{N} clean · {missed} skittered · {noop} no-op   [tally→out│inline]
    {1-line: the shape of what landed across the field}
```

**Re-throw** (misses remain):
```
嵐  {missed} still standing — storm them again?
    {re-throw target list}
```

**Empty field** (nothing to throw):
```
嵐  the field is empty {│ a storm of one is just a throw} — nothing loosed.
```

## Principles

- **One cut, a hundred targets.** The operation is identical across the storm. If the targets need *different* work, this is the wrong blade.
- **Disjoint wood — non-negotiable.** One shuriken per target; overlapping targets clobber each other's land.
- **Prefer the workflow substrate.** The harness-enforced cap is what keeps a wide storm from rebounding and blocking the whole session; hand-rolled agents are the fallback, and the fallback is where you get rate-limited. A storm without a harness cap is a storm aimed at yourself.
- **Width is throughput, not ambition.** The storm is as wide as the field; under `agents`, `--width` caps how many fly at once; under `workflow`, the harness cap rules. Either way, the cap — not the field size — is what keeps the volley from rebounding.
- **No synthesis — the tally is the product.** Shuriken land themselves; the deliverable is lands, misses, and a re-throw list.
- **Tolerant volley.** A lost shuriken is a thinner field, noted and passed — no retry, no respawn mid-storm; misses re-throw.
- **Lands on disk; the orchestrator seals it.** A thrown shuriken edits its target and never commits; the orchestrator commits the whole volley at the end (unless the user requested no commit).
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. Shuriken never commit — the orchestrator commits the volley; a field of pure no-ops has nothing to commit.

## Don't

- Don't storm a **heterogeneous** field — if each target needs a different kind of cut, split by type or aspect instead; the storm throws one shape.
- Don't let two shuriken share a target (or a file) — disjoint wood or they clobber.
- Don't hand-roll a wide volley when workflows are available — that's the path that rebounds and blocks the session; let the harness hold the cap.
- Don't silently fall back to `agents` because workflows weren't opted in — surface it, and let the user opt in or accept the risk out loud.
- Don't loose the whole field at once — under `agents`, hold the rolling volley to `--width` in flight; under `workflow`, the harness already does.
- Don't synthesize or merge the lands — there is nothing to stitch; tally them.
- Don't retry or respawn a miss mid-volley — it goes on the re-throw list.
- Don't run a project-wide formatter inside a shuriken — it reaches past the one target and clobbers siblings.
- Don't push or PR — commits stay local. Shuriken never commit; the orchestrator commits the volley at the end (unless the user requested no commit).
