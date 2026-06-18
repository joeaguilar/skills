---
name: the-clan
description: "Take ONE heterogeneous task whose parts each need a DIFFERENT art, classify the parts by type, and dispatch each part to the specialist whose expertise fits it — the SQL part to a SQL hand, the CSS part to a frontend hand, the perf part to a perf hand — then assemble the routed outputs into the whole. Autonomous: reads the task, routes the parts, fires the specialists in parallel, tolerates a missed part, assembles what was handled. Trigger when the user types `/the-clan`, or asks to \"route this to the right specialist\", \"send each part to the expert who fits it\", \"dispatch by type\", \"mixture of experts\", \"classify and route this\", \"each piece needs a different skill\", or \"fan this out by specialty\". Works for mixed-discipline research, audits, designs, and implementation (`--write`). Do NOT trigger to cut ONE task into uniform aspects struck by identical generalists (that is an aspect-decomposition fan — there every knife is the same art, here each is a different art), to attempt the SAME whole task N times and keep the truest (that is a consensus swarm), or to push one artifact through serial stages where each feeds the next (that is a relay)."
---

# /the-clan — each task to the shinobi whose art fits

One heterogeneous task in. The router reads it, splits it into parts **by type**, dispatches each part through the gate to the specialist whose art fits — and assembles the routed outputs into one whole.

**Ninja posture.** Read the task, route the parts, send each to its art — **no gate**. Parallel and tolerant: a specialist that misses leaves its part **unhandled** — note the empty post, the rest of the gate stands. Run straight to the assembly; the only whiff is every post empty.

## The loop at a glance

```
Frame ...... read the task, classify its parts BY TYPE                [silent — pause only on --confirm]
Route ...... map each part → the art that fits → dispatch one specialist per part (parallel)
Land ....... take each routed output; a part with no fitting art / a missed specialist = unhandled
              floor: ≥1 part handled → assemble │ 0 handled → report the empty gate, stop
Assemble ... fit the routed parts into ONE whole; reconcile the seams
Deliver .... the assembled whole + 1-line which-art-handled-which-part map
```

## Slash invocation

```
/the-clan <task> [--specialists="a,b,c"] [--router] [--write] [--out=path] [--confirm]
```

| Arg | Default | Meaning |
|---|---|---|
| `<task>` | — | The one heterogeneous task. Inline prose, a spec path, or "the thing we just discussed". |
| `--specialists="a,b,c"` | router proposes | The roster of specialist roles. Unset → the router **infers** the roster from the parts it finds (one art per part type). Set → route only into these arts; a part that fits none is unhandled. |
| `--router` | orchestrator classifies | Spawn a **separate** classifier agent to do the routing (independence over speed). Default → the orchestrator reads and routes itself. |
| `--write` | off | Specialists may **edit files** — **disjoint file sets**, one art per set. Off → read-only, specialists return reports/artifacts only. |
| `--out=path` | conversation | Persist the assembled whole to `path`. Default → deliver inline. |
| `--confirm` | off | The **only** gate — print the routing plan and wait before dispatch. Default fires without asking. |

Unsupplied flags resolved in Phase 0. Output is terse — the assembled whole is the product, not the narration.

## Roles & artifacts

- **You** — throw the task. No live decisions unless `--confirm`.
- **Orchestrator** — reads, classifies by type, routes, dispatches, assembles. Sole author of the deliverable. (Routing handed to a separate classifier if `--router`.)
- **Specialists** — one per routed part, each an expert in the art that part needs, blind to siblings except the boundary note. Each returns its handled part.

No tracker, no graph, no sprint folders — this skill stands alone, depends only on its own fan. Artifacts: an in-memory routing table + the assembled whole (inline, or `--out`).

## Voice — the clan, the gate (一門)

Speak twice: when the gate opens and the shinobi go, when the parts return assembled. Silent between — no per-specialist play-by-play. `{slots}` are the contract; the flavor is mouth. 印 = 門.

**Throw** (Phase 0, on dispatch — the roster + what routes where):
```
門  the gate opens · {K} arts to {K} parts                  [read │ write→out=path]
    {part-1} → {art-1}   ·   {part-2} → {art-2}   ·   …   ·   {part-K} → {art-K}
```

**The pause** (only `--confirm`):
```
門  before the gate opens — {K} parts, each to its art:
    {part-1}  ↳ {art-1}   ╎ not yours: {other parts belong to other arts}
    …
    speak, and the clan goes.
```

**Return** (Phase 3, on delivery — each part → which art handled it + outcome):
```
門  {handled}/{K} parts came back through the gate
    {part-1} → {art-1}  ✓ {one-phrase outcome}
    {part-3} → {art-3}  ✗ post unmanned ({no fitting art │ specialist missed})
    ─ seams: {unreconciled clashes between routed parts, or omit}
```

**Empty gate** (zero parts handled — the only hard stop):
```
門  the gate stands empty — {K} parts, none came back.
    {why — every post unmanned}
```

---

## Phase 0 — Frame (no gate)

Resolve `--specialists`, `--router`, `--write`, `--out`, `--confirm`. Read the task once.

**Classify by type** — the distinguishing brain. Walk the task and find its **parts**, each a piece that needs a *genuinely different* art:

1. **Split by type.** Break the task into parts where each part's *kind of expertise* differs — the SQL part, the CSS part, the perf part, the security part, the docs part. Type is the cut, not aspect: two parts that need the *same* art are one part, not two.
2. **Match each part to an art.** For each part, name the specialist role whose expertise fits it. `--specialists` set → route only into that roster; a part that fits none of them gets no post (unhandled — note it). Unset → infer the role from the part (one art per part type).
3. **Build the routing table** — `part → art`, one row per part. One specialist per matched part.

`--router` → spawn a separate classifier to produce the routing table (the classifier prompt is below); else the orchestrator routes itself.

**Right-size — don't manufacture arts.** If the parts are all one art, this isn't a clan — it's one specialist. Don't split a single-discipline task into fake "specialties." Route only the parts that truly need different expertise; collapse same-art parts into one post.

**Gate line** — emit the **Throw** template (see Voice), then dispatch immediately. `--confirm` → emit **The pause** template instead and **wait** for go. That flag is the only pause.

### Router prompt (only `--router`)

```
You are the gatekeeper. Read the task and route its parts to specialist arts.
Do NOT solve any part — only classify and route.

Whole task:
{task restatement}

{--specialists set: route only into this roster: {a, b, c}.}
{--specialists unset: infer the roster — one art per distinct part type.}

Split the task into PARTS by TYPE OF EXPERTISE — a part is a piece that needs a
genuinely different art (the SQL part, the CSS part, the perf part). Two pieces
needing the SAME art are ONE part. Do not invent specialties for same-art work.

Return EXACTLY a routing table:
  - For each part: {part — concrete scope} → {art / specialist role that fits it}.
  - Unroutable: any part that fits no available art (it will go unhandled), or "none".
Your final message IS the routing table — data, not chat.
```

---

## Phase 1 — Route & dispatch

Spawn one specialist **per routed part, all in parallel** — one Agent call per part, single batch, concurrent:

- `subagent_type`: the specialized type that fits the art if one squarely does, else `general-purpose`.
- `run_in_background: true`.
- `description`: e.g. `Clan: {art} on {part}`.
- `prompt`: the specialist template below, parameterized by the matched art + the part it owns.

### Per-specialist prompt template

```
You are the {role/art} specialist of this clan. The task has several parts, each
routed to a DIFFERENT art — yours is one of them. Other parts belong to other
arts; stay inside YOUR part, do NOT try to handle the whole task.

Whole task (context only):
{task restatement}

YOUR PART — {part title}, routed to you because it needs {art}:
{scope — concrete, the piece your art owns}

OTHER PARTS (other arts own these — don't touch them):
{the other part→art rows — what is NOT yours}

{--write mode only:}
Files you OWN (edit only these): {owned file set for this art}
Do NOT edit/move/reformat anything outside this set — a sibling art is in it now and a
stray edit or project-wide formatter clobbers their work. Need a change in another art's
file? Don't — list it under "cross-part needs". Do NOT commit, push, branch, or PR.

Deliver back EXACTLY:
{deliverable shape for this art — e.g. "the tuned query + why it's faster"
 │ "the CSS change (on disk) + 3-line summary"
 │ "the perf findings, each hotspot + fix"}

Close with:
  - Confidence: high | medium | low + why.
  - Cross-part needs: anything that belongs to another art, or "none".
  - Gaps: anything in your part you couldn't resolve, or "none".

Your final message IS your handled part — return data, not chat. Be self-contained.
```

`--write` → file sets disjoint, one art per set. Orchestrator never commits — user reviews and commits.

---

## Phase 2 — Land (take what comes back through the gate)

Event-driven. Collect each routed part as it lands — capture verbatim + its Confidence / Cross-part needs / Gaps.

- **Returned** → that post is manned; the part is handled. Keep it.
- **No fitting art** (a part `--specialists` couldn't cover) → **unhandled**. One-line note, move on.
- **Specialist missed** (failed, errored, denied, or stalled) → its post is unmanned, that part **unhandled**. **No retry, no resume, no respawn.** Note the empty post, move on.
- **Straggler** → don't block the assembly on it. Assemble once the bulk has landed; a late return folds in only if it arrives before you finish, else its post stays unmanned.
- **Overran its part** (touched another art's scope/files) → keep the in-scope part, drop the rest.

**Floor:** ≥1 part handled → assemble. **0 handled** → the only real failure: emit the **Empty gate** template (see Voice) and stop.

---

## Phase 3 — Assemble

Orchestrator's own work — not a hand-off. Fit the handled parts into the one whole from Phase 0:

1. **Assemble** the routed outputs into the whole in a coherent order — fit the parts together, don't transcribe ("the SQL hand said… the CSS hand said…" is a failure).
2. **Reconcile the seams** — two routed parts touch at a boundary and disagree → resolve, or flag the seam. Never silently pick one.
3. **Route each cross-part need** to the art that owns it (or note it as a seam if no art covered it).
4. **Unhandled parts** — note any post left unmanned (missed specialist or no fitting art). Fill only if trivial and cheap; otherwise list it open. Don't re-dispatch — that's babysitting.

`--write` → edits are already on disk; assembly = the seam-reconciliation pass + a unified change summary.

---

## Phase 4 — Deliver

Terse. Emit, in order:

- **Return** template (see Voice) — the `{handled}/{K}` part→art map, including any unmanned posts and `seams:`.
- **The assembled whole** — the fitted result (to `--out` if set, else inline).
- **`--write` next step** — review and commit (the skill never commits).

---

## Principles

- **Split by type, not by aspect.** Each part needs a *different* art — that's the cut. Same-art pieces are one part; uniform identical agents are a different blade.
- **Classify, then dispatch.** Read the whole, route each part to the art that fits, fire one specialist per matched part.
- **Each part to the hand that fits it.** The SQL part to a SQL hand, the CSS part to a frontend hand — expertise matched, not generalists multiplied.
- **Tolerate the empty post.** A missed specialist or an unroutable part leaves its part unhandled — noted, never healed. Assemble from what was handled.
- **Assembly, not concatenation.** The deliverable fits the routed parts into one whole; K stapled parts is a failure.
- **Right-size the clan.** Route only parts that truly need different arts. All one art → one specialist, not a manufactured clan.
- **Fire without a gate; run to the assembly.** `--confirm` is the only pause; default never asks. Only hard stop: zero parts handled.

## Don't

- Don't gate, ask, or pause unless `--confirm` is set.
- Don't manufacture specialties — if the parts are all one art, it's one specialist, not a clan.
- Don't split into uniform identical agents — that's an aspect-decomposition fan, not a route-by-type clan.
- Don't retry, resume, or respawn a missed specialist — its post stays unmanned, the part unhandled.
- Don't block the assembly waiting on a straggler.
- Don't let a specialist handle a part outside its art — each stays in its routed part.
- Don't give two `--write` specialists a shared file.
- Don't hand back K raw parts — always assemble into the whole.
- Don't commit, push, or PR in `--write` mode — the user reviews and commits.
