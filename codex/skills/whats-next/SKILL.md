---
name: whats-next
description: Answer "what is next / what's left / where did we leave off" for the current project by reconciling the itr tracker, docs/ROADMAP.md, sprint/CURRENT, the latest handoff, and git state into one report. Trigger on /whats-next, or when the user asks what's next, what's left, or for status at session start or after /clear. REPORT ONLY by default — an interrogative is never permission to start work. Only with the --start flag does it claim the top ready item and begin executing it.
---

# whats-next — one-shot reconciliation of "what is next?"

Composes the answer that otherwise takes four probes: tracker state, roadmap,
sprint pointer, and git — cross-checked, with staleness flagged instead of
rendered as truth.

**The rule this skill enforces:** a status question is a request for a report.
Without `--start`, this skill NEVER claims, closes, edits, or begins anything —
every command it runs is read-only. `--start` is the explicit imperative.

## Step 0 — Use the project's OWN next-work workflow first

Projects that define a next-work surface own the answer; the generic recipe in
Step 1 is only the fallback. Check, in order:

1. **A documented procedure** — a "Finding Next Work" (or similar) section in
   the project's `CLAUDE.md`/`AGENTS.md`. Follow it verbatim (canonical example:
   Panthexia says run `./scripts/next-work.sh`, treat `itr` as authoritative for
   status/deps/assignment, `docs/NEXT.md` as the ranked human digest,
   `docs/ROADMAP.md` as the cross-sprint map).
2. **A next-work script or recipe** — `scripts/next-work.sh`, `just next`, or
   equivalent. Run it and build the report from its output.
3. **A ranked digest file** — `docs/NEXT.md` ("front door" pattern): pull-order
   table, lane tags (`next-lane`, `v1-blocker`, `product-backlog`,
   `nonblocking-followup`, `deferred-final`, `v2`). Respect the lane order —
   nonblocking follow-ups must not displace blocker lanes unless the PO says so.

**Disagreement rule (from the Panthexia convention):** when a digest file and
`itr` disagree, trust `itr` — and flag the mismatch in the report so it gets
fixed, rather than silently picking one.

**Two-grain rule (from the rustglichur convention):** ROADMAP.md answers at
*section* grain (✅/🟡/❌, release boundary); `itr ready`/`itr next` answers at
*task* grain. A complete answer gives both: "lane/section X is next; within it,
task #N."

## Step 1 — Generic gather (fallback; all read-only, from the repo root)

```sh
git log -1 --format='%h %ad %s' --date=short && git status --short | head -20
itr next -f json; itr ready -f json; itr wip -f json; itr stats
```

Then read whichever of these exist (skip silently if absent):
- `docs/NEXT.md` (ranked digest — see Step 0.3)
- `sprint/CURRENT` (a pointer file) and the sprint dir it names
- `docs/ROADMAP.md` (or `ROADMAP.md`)
- newest file in `docs/handoff/` or `docs/state-of-play.md`
- `campaign/CURRENT` and the `campaign.json` it points at

If there is no `.itr.db`, say so and reconcile from roadmap + git alone —
do not invent tracker state.

## Step 2 — Cross-check (git is ground truth)

- **Stale pointer:** if `sprint/CURRENT`, `ROADMAP.md`, or the latest handoff
  mtime lags the last commit date by >7 days, badge it `⚠ stale (Nd behind git)`.
  Never present a stale file's contents as current truth.
- **Stale claim:** any `wip`/in-progress issue with no update in >48h →
  `⚠ stale claim`.
- **Contradictions:** roadmap lines marked done (✅/[x]) whose feature still has
  open itr issues; blocked issues whose blockers are all closed (report as
  "actually unblocked").

## Step 3 — Report

Render compactly, in this order:

```
## <project> — state of play
Last commit: <h> <date> <subject> · working tree: <clean | N dirty>
Handoff/sprint: <latest pointer + staleness badge>

**Lane/section next:** <NEXT.md rank-1 lane or ROADMAP section>  (source: <NEXT.md / ROADMAP / itr-only>)
**Task next:** #<id> <title>  (why: next-lane tag / itr next / unblocked priority)
**In progress:** #<id> <title> [⚠ stale claim?]  (or "nothing claimed")
**Ready behind it:** N ready, M blocked
**Flags:** <digest-vs-itr mismatches, contradictions, stale pointers, actually-unblocked items — or "none">
```

Close the report with: `Run /whats-next --start to begin the top item.`
Then STOP. Do not continue into execution, do not ask "shall I proceed".

## `--start` — the explicit imperative

Only when the invocation contains `--start` (optionally `--start <id>` to
override the pick):

1. Render the Step-3 report first — the user still gets the picture.
2. Pick the target: the given `<id>`; else the top of the project's own
   next-work surface (rank-1 lane in `docs/NEXT.md` / `next-lane` tag /
   `just next`); else the `itr next` recommendation.
   If the pick carries a `⚠ stale claim` by someone else, say so before taking it.
3. `itr claim <id>` and begin the work per normal project conventions
   (verify gates via gatr, evidence before close, you don't own git).

## Guardrails

- Never "fix" a contradiction from this skill — flag it; fixing is its own task.
- No writes of any kind without `--start`; with `--start`, the only tracker
  write before real work begins is the single `itr claim`.
- Single project scope (the cwd repo). Cross-project rollup is the command-center
  re-entry digest (werkit itr#7), not this skill.
