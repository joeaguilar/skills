---
name: splitting-blade
description: "Recursively decompose ONE oversized task — split, re-split pieces still too big down to small leaves, solve each leaf with one agent, fuse results back up to the root under hard depth/fanout clamps (`--write`). Trigger: `/splitting-blade`, \"recursively decompose this\", \"divide and conquer, then split the parts again\". NOT for a one-level flat cut (use /fan-of-agents)."
---

# /splitting-blade — cut the cut, and cut again

One task too big for a single pass in. The orchestrator splits it; any child still too big gets split AGAIN; recursion bottoms out at small leaves one agent can finish; the leaves are solved and fused up — child into parent, parent into parent — until the root is whole.

**Ninja posture.** Infer the split and cut — **no gate**. The blade is parallel-tolerant at the leaf: a failed leaf is a gap in its parent's fuse — note it, fuse what landed, move on. But runaway recursion is the real danger: the **depth and fanout clamps are load-bearing guardrails** — honor them strictly. Runs straight from root-split to root-assembly.

## The loop at a glance

```
Frame ...... read the task, set base-condition + max-depth + fanout    [silent — pause only on --confirm]
Split ...... node a base case? → solve with ONE agent (leaf)
              not a base case AND depth < max? → split into {fanout} children, recurse each (parallel)
              not a base case BUT depth = max? → DEPTH WALL: solve as-is, note coarseness
Solve ...... leaves run in parallel within a level; a failed leaf = a gap, no retry
Fuse-up .... combine children into their parent, parent into its parent, up to the root
Deliver .... the assembled root + the tree (depth reached · leaves solved/missed)
```

## Slash invocation

```
/splitting-blade <task> [--max-depth=N] [--fanout=N] [--base="condition"] [--write] [--out=path] [--confirm]
```

| Arg | Default | Meaning |
|---|---|---|
| `<task>` | — | The one big task. Inline prose, a spec path, or "the thing we just scoped". |
| `--max-depth=N` | `3` | Hard recursion floor. **Clamp 1–4** (`>4` → clamp 4 + warn; `<1` → bump 1). Guard against runaway recursion: at max depth, **stop splitting** and solve the piece as-is. |
| `--fanout=N` | `3` | Children per split. **Clamp 2–5** (`>5` → clamp 5 + warn: a node's fuse degrades past ~5 children; `<2` → bump 2). |
| `--base="condition"` | small enough that ONE agent finishes it in a single pass — single concern, bounded files | What makes a piece a leaf. Override to tune where recursion bottoms out. |
| `--write` | off | Leaves may **edit files** — disjoint sets across the WHOLE tree. Off → read-only, leaves return reports/artifacts. |
| `--out=path` | conversation | Persist the assembled root + tree. Default → inline. |
| `--confirm` | off | The **only** gate — print the planned split + clamps and wait before the first cut. |

Unsupplied flags resolved in Phase 0. Output is terse — the assembled root is the product, not the tree-walk.

## Roles & artifacts

- **You** — throw the task. No live decisions unless `--confirm`.
- **Orchestrator** — owns the recursion: decides base-case vs split, spawns planners/leaves, fuses children up to the root. Sole author of the deliverable.
- **Splitter agents** (planner role) — given a too-big node, return how to cut it into `≤ fanout` disjoint children (no solving — just the cut). The orchestrator may instead split a clear node itself.
- **Leaf agents** (worker role) — given a base-case piece, solve it in one pass, blind to siblings except the boundary note.

No tracker/graph/sprint deps — stands alone. Artifacts: an in-memory split tree + the assembled root (inline, or `--out`).

## Voice — the splitting blade (bunshin)

Speak twice: when the first cut is thrown, when the tree is fused. Silent through the recursion — no per-node chatter. `{slots}` are the contract; the flavor is mouth. 印 = 分.

**Throw** (Phase 0, on the first cut):
```
分  the cut splits the cut · max-depth {D} · fanout {F}
    root: {one-line task}                                  [read │ write→out=path]
    base: {base condition}
```

**The pause** (only `--confirm`):
```
分  before the first cut — split to depth {D}, {F} children per split
    root: {task}   leaf when: {base condition}
    speak, and the blade splits.
```

**Return** (Phase 3, precedes the assembled root):
```
分  the tree is fused · depth reached {d}/{D} · {leaves_solved}/{leaves_total} leaves landed
    shape: {root → children → … one-line tree sketch}
    gaps: {missed leaves folded as holes in their parent, or "none"}
```

**Depth wall** (a piece hit max-depth still un-splittable — solved coarse):
```
分  depth wall at {D} · {node} could not split further — solved as one coarse piece.
    coarseness: {what finer recursion would have separated, left fused}
```

---

## Phase 0 — Frame (no gate)

Resolve `--max-depth` (clamp 1–4), `--fanout` (clamp 2–5), `--base`, `--write`, `--out`, `--confirm`. Read the task once.

**Set the base condition** — what makes a piece a leaf (no further split). Default: small enough that one agent finishes it in a single pass — one concern, bounded files. A bad base condition is the difference between a clean tree and runaway recursion; if the task implies a natural leaf size, state it.

**The split rule** — for any node, pick the cut that yields disjoint children that together cover the node (sub-areas, sub-questions, sub-modules, sub-sections). Children must not overlap; in `--write` mode their **file sets are disjoint across the entire tree**, not just among siblings.

Emit the **Throw** template, then cut. `--confirm` → emit **The pause** and wait. That flag is the only pause.

---

## Phase 1 — Split (recurse)

The control flow is a recursion on each node, starting at the root (depth 0):

```
process(node, depth):
  if node meets the base condition           → LEAF: solve it (one leaf agent)
  else if depth == max-depth                 → DEPTH WALL: solve as-is (one leaf agent, coarse) + note
  else                                       → SPLIT into ≤ fanout disjoint children
                                                spawn process(child, depth+1) for all children IN PARALLEL
                                                fuse the children's results into this node (Phase 2)
```

**Splitting a node** — either the orchestrator cuts a clear node itself, or it spawns ONE splitter agent (planner) to propose the cut. Use the splitter when the node is large/unfamiliar enough that the cut itself needs reasoning.

### Splitter (planner) prompt template

```
You are splitting ONE node of a larger recursive decomposition. Do NOT solve it —
only cut it into disjoint children that together cover it.

Node to split (depth {depth} of max {D}):
{node restatement}

Cut it into AT MOST {fanout} children. Each child must be a self-contained
sub-piece; together they must cover this node with NO overlap and NO gap.
{--write: each child must own a DISJOINT file set — name the files per child.}

Return EXACTLY, per child:
  - Title: short name of the child.
  - Scope: concrete boundary of what this child covers.
  - Base?: is this child small enough to be a leaf (one agent, one pass)? yes | no.
  {--write: Files: the disjoint file set this child owns.}
Then: Coverage check — confirm the children cover the node with no overlap/gap.
Your final message IS the cut — data, not chat.
```

**Leaves run in parallel within a level** — spawn all base-case/depth-wall children of the level concurrently, one Agent call per leaf, single batch:

- `subagent_type: general-purpose` (a specialized type only if one squarely fits a leaf).
- `run_in_background: true`.
- `description`: e.g. `Leaf d{depth}.{path}`.
- `prompt`: the leaf template below.

### Leaf (worker) prompt template

```
You are ONE leaf of a recursively split task — the smallest piece, solved alone.
Siblings own the rest of the tree in parallel — stay inside your leaf; do NOT try
to solve the parent or the whole task.

Whole task (context only):
{root task restatement}

YOUR LEAF — {leaf title} (path: {root → … → this leaf}):
{leaf scope — concrete, bounded}

OUT OF SCOPE (siblings/other branches own these — don't cover them):
{boundary notes}

{--write mode only:}
Files you OWN (edit only these): {owned disjoint file set}
Do NOT edit/move/reformat anything outside this set — a sibling elsewhere in the
tree is in it now and a stray edit clobbers their work. Need a change in another
leaf's file? Don't — list it under "cross-leaf needs". Do NOT commit, push, branch, or PR.

Deliver back EXACTLY:
{deliverable shape — e.g. "findings list, each file:line + severity + fix"
 │ "the sub-answer + 3 strongest supporting points"
 │ "the code change (on disk) + 5-line summary"}

Close with:
  - Confidence: high | medium | low + why.
  - Cross-leaf needs: anything that belongs to another branch, or "none".
  - Gaps: anything in your leaf you couldn't resolve, or "none".
Your final message IS your leaf result — return data, not chat. Be self-contained.
```

`--write` → leaf file sets disjoint across the whole tree. Orchestrator never commits — user reviews and commits.

---

## Phase 2 — Fuse up

Bottom-up, the orchestrator's own work — not a hand-off:

- **Collect leaves** event-driven. A returned leaf is solved; a leaf that failed, errored, stalled, or overran its scope is a **gap** — **no retry, no respawn**. Keep any in-scope part of an overrun, drop the rest.
- **Fuse children into their parent** — integrate the children's results into the parent's coherent result (don't transcribe "child 1 said… child 2 said…"). Reconcile clashes between siblings; route each cross-leaf need to the branch that owns it; a missed leaf is a hole noted in its parent's fuse, filled only if trivial and cheap.
- **Recurse the fuse upward** — a fused parent becomes a child of ITS parent; fuse again, level by level, until the root is assembled.
- **Depth-wall nodes** fuse like any leaf, but carry the coarseness note up so the root knows where finer recursion was clamped off.

**Stop** when: every leaf has returned or been marked a gap, and the root is assembled. (Base case reached at every leaf, root fused.) `--write` → edits are already on disk; the fuse is the reconciliation pass + a unified change summary.

---

## Phase 3 — Deliver

Terse. Emit, in order:

- **Return** template (see Voice) — depth reached, `{leaves_solved}/{leaves_total}`, the tree sketch, gaps. Add a **Depth wall** line for each node clamped at max depth.
- **The assembled root** — the fused-up deliverable (to `--out` if set, else inline).
- **`--write` next step** — review and commit (the skill never commits).

---

## Principles

- **Recursive split.** A node is a base case (solve with one agent) or it splits into `≤ fanout` children that recurse. The recursion IS the blade.
- **Tree flow, parallel within a level.** Children of a split run concurrently; the depth is what serializes — a parent waits for its children to fuse.
- **Fuse up, not flat.** Children combine into their parent, parent into parent, to the root — the deliverable is assembled bottom-up, never N stapled leaves.
- **Stop at the base case, every leaf.** Done = every branch bottomed out (or hit the depth wall) and the root is whole.
- **Clamp the recursion — hard.** Depth defaults 3, clamps 1–4; fanout defaults 3, clamps 2–5. At max depth, stop splitting and solve coarse. The clamps are guardrails, not suggestions.
- **Right-size the leaf.** A good base condition keeps leaves one-pass-sized; too coarse wastes the tree, too fine explodes it.
- **Fire without a gate; run to a fused root.** `--confirm` is the only pause.

## Don't

- Don't gate, ask, or pause unless `--confirm` is set.
- Don't blow past the clamps — never recurse below max-depth's stop, never split wider than fanout. Runaway recursion is the footgun this blade guards against.
- Don't keep splitting at the depth wall — solve the piece as-is and note its coarseness.
- Don't retry, resume, or respawn a missed leaf — a miss is a gap in its parent's fuse.
- Don't let a leaf solve its parent or the whole task — each stays in its leaf.
- Don't give two leaves anywhere in the tree a shared `--write` file — sets are disjoint across the entire tree.
- Don't hand back the raw leaves — always fuse up into one assembled root.
- Don't commit, push, or PR in `--write` mode — the user reviews and commits.
