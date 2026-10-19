import type { Claim } from '../types'

// The words handed to Claude when the person presses a ¤ button. The mod gathers
// with no model call; these are for what only a reader of prose can do.

/** The `start` skill's body, as it stood when the mod took its place. */
export const START_BODY = `Start the next thing, whatever it is.

Check CLAUDE.md, AGENTS.md, README.md for the project conventions for finding the next work to do.

If there is no procedure in the docs, look for HANDOFF.md, TODO.md, docs/NEXT.md, any ranked list, or any file the project keeps to determine what's next. Don't run anything undocumented.

If there is no convention, you find a conflict in any documentation about what is next, or there doesn't seem to be any work, ask.

Before starting declare first, in one sentence, what you will be working on and its source.

Stop where the conventions say the work should end. If there is no identified stop condition, stop after one item.`

/** The `whats-next` skill's body, report-only: its steps 0 to 3 and the guardrails that go with them. */
export const ASK_BODY = `Answer "what is next / what's left / where did we leave off" for this project: one reconciled report.

**The rule:** a status question is a request for a report. NEVER claim, close, edit, or begin anything here; every command you run is read-only.

## Step 0 — Use the project's OWN next-work workflow first

Projects that define a next-work surface own the answer; the generic recipe in
Step 1 is only the fallback. Check, in order:

1. **A documented procedure** — a "Finding Next Work" (or similar) section in
   the project's \`CLAUDE.md\`/\`AGENTS.md\`. Follow it verbatim (canonical example:
   Panthexia says run \`./scripts/next-work.sh\`, treat \`itr\` as authoritative for
   status/deps/assignment, \`docs/NEXT.md\` as the ranked human digest,
   \`docs/ROADMAP.md\` as the cross-sprint map).
2. **A next-work script or recipe** — \`scripts/next-work.sh\`, \`just next\`, or
   equivalent. Run it and build the report from its output.
3. **A ranked digest file** — \`docs/NEXT.md\` ("front door" pattern): pull-order
   table, lane tags (\`next-lane\`, \`v1-blocker\`, \`product-backlog\`,
   \`nonblocking-followup\`, \`deferred-final\`, \`v2\`). Respect the lane order —
   nonblocking follow-ups must not displace blocker lanes unless the PO says so.

**Disagreement rule:** when a digest file and \`itr\` disagree, trust \`itr\` — and
flag the mismatch in the report so it gets fixed, rather than silently picking one.

**Two-grain rule:** ROADMAP.md answers at *section* grain (✅/🟡/❌, release
boundary); \`itr ready\`/\`itr next\` answers at *task* grain. A complete answer
gives both: "lane/section X is next; within it, task #N."

## Step 1 — Generic gather (fallback; all read-only, from the repo root)

\`\`\`sh
git log -1 --format='%h %ad %s' --date=short && git status --short | head -20
itr next -f json; itr ready -f json; itr wip -f json; itr stats
\`\`\`

Then read whichever of these exist (skip silently if absent):
- \`docs/NEXT.md\` (ranked digest — see Step 0.3)
- \`sprint/CURRENT\` (a pointer file) and the sprint dir it names
- \`docs/ROADMAP.md\` (or \`ROADMAP.md\`)
- newest file in \`docs/handoff/\` or \`docs/state-of-play.md\`
- \`campaign/CURRENT\` and the \`campaign.json\` it points at

If there is no \`.itr.db\`, say so and reconcile from roadmap + git alone —
do not invent tracker state.

## Step 2 — Cross-check (git is ground truth)

- **Stale pointer:** if \`sprint/CURRENT\`, \`ROADMAP.md\`, or the latest handoff
  mtime lags the last commit date by >7 days, badge it \`⚠ stale (Nd behind git)\`.
  Never present a stale file's contents as current truth.
- **Stale claim:** any \`wip\`/in-progress issue with no update in >48h →
  \`⚠ stale claim\`.
- **Contradictions:** roadmap lines marked done (✅/[x]) whose feature still has
  open itr issues; blocked issues whose blockers are all closed (report as
  "actually unblocked").

## Step 3 — Report

Render compactly, in this order:

\`\`\`
## <project> — state of play
Last commit: <h> <date> <subject> · working tree: <clean | N dirty>
Handoff/sprint: <latest pointer + staleness badge>

**Lane/section next:** <NEXT.md rank-1 lane or ROADMAP section>  (source: <NEXT.md / ROADMAP / itr-only>)
**Task next:** #<id> <title>  (why: next-lane tag / itr next / unblocked priority)
**In progress:** #<id> <title> [⚠ stale claim?]  (or "nothing claimed")
**Ready behind it:** N ready, M blocked
**Flags:** <digest-vs-itr mismatches, contradictions, stale pointers, actually-unblocked items — or "none">
\`\`\`

Close the report with: \`Run /whats-next --start to begin the top item.\`
Then STOP. Do not continue into execution, do not ask "shall I proceed".

## Guardrails

- Never "fix" a contradiction from here — flag it; fixing is its own task.
- No writes of any kind.
- Single project scope (the cwd repo).`

const GATHERED = 'State of play as the whats-next mod gathered it just now, with no model call, from git, itr and the pointer files:'

/** What Start hands Claude when the gathering has a pick. */
export const beginText = (task: { id: number; title: string }, claim: Claim | undefined, state: string) =>
  [
    `[whats-next] Begin #${task.id}${task.title === '' ? '' : ` ${task.title}`}. Claim it first with \`itr claim ${task.id}\`, the only tracker write before real work begins, then do the work per this project's conventions: verification gates through gatr, evidence before close, and commit the work as it lands unless told otherwise.`,
    claim !== undefined && claim.staleHours > 0
      ? `#${task.id} carries a stale claim${claim.assignee === '' ? '' : ` by ${claim.assignee}`} (no update in ${claim.staleHours}h): say so before taking it.`
      : '',
    '',
    GATHERED,
    '',
    state,
  ]
    .filter((line, at, all) => line !== '' || all[at - 1] !== '')
    .join('\n')

/** What Ask hands Claude: the report-only instructions, and what is already known. */
export const askText = (state: string) =>
  [`[whats-next] ${ASK_BODY}`, '', '---', '', `${GATHERED} Trust it for those facts; your part is whatever procedure the project documents in prose.`, '', state].join('\n')
