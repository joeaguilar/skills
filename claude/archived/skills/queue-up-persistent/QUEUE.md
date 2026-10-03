# queue-up --queue — the persistent sheath (loaded only on `--queue`)

A queue is a sheath. Sliding a blade in is not drawing it.

**Posture.** Reached only via `/queue-up --queue …` (bare `/queue-up <task>` is the in-session TodoList path; `/queue-up --persist <task>` is the cheap append that writes the same line format without loading this file). Staging is silent and cheap. A stage is NEVER permission to work — only `--now`, `--run`, `--drain` draw steel.

## Slash invocation
```
/queue-up --queue <task>            stage; keep doing what you were doing
/queue-up --queue --now <task>      stage + run once the in-flight step lands
/queue-up --queue --later <task>    stage for ANOTHER session; this one won't offer to run it
/queue-up --queue                   show the queue
/queue-up --queue --run [qN]        pop head (or qN) and execute it, then stop
/queue-up --queue --drain           run head→tail until empty or first failure
/queue-up --queue --drop qN         remove qN
/queue-up --queue --clear           empty the queue (done + pending)
```
`<task>` = free text, a slash command (`/blitz`, `/code-review --fix`), or `#id` (an itr issue). Stored verbatim.

## The sheath — `.claude/queue.md` in the target repo
Create on first stage. One line per item, head = top. Never reorder silently.

```md
# queue
- [ ] q1 · 2026-08-22 14:20 · <task> · @<branch>
- [>] q2 · … · running
- [x] q3 · … · done <sha|note>
- [!] q4 · … · failed: <one line>
- [~] q5 · … · later
```
States: `[ ]` pending · `[>]` running · `[x]` done · `[!]` failed · `[~]` later (another session). Ids monotonic, never reused. `@branch` = branch at stage time — run on a different branch → say so first, don't switch.

## Phases

### Phase 0 — Stage (every form with `<task>`)
1. Read `.claude/queue.md` if present; next id = max + 1.
2. Append one line. Text verbatim. `--later` → `[~]`.
3. Reply in ONE line: `queued q<N> · <task, ≤8 words> · <N pending>`. Then resume whatever was in flight — no summary, no "shall I".
4. `--now` → finish the in-flight step (current tool call / edit / test — not the whole task), then Phase 1 on q<N>. Mid-task work stays half-done and visible in `git status`; say so in the one line.

### Phase 1 — Run (`--run`, `--now`, each `--drain` step)
1. Mark `[>]`. Announce: `Announce: Phase 1 — q<N> <task>`.
2. Execute as if the user had typed the task now. Slash command → invoke it. `#id` → claim in `itr`, work it per the project's conventions. Free text → do it; project `CLAUDE.md`/`AGENTS.md` conventions apply.
3. Land → `[x]` + sha (or `no-commit` note). Blocked/failed → `[!]` + one-line reason, work left in the tree, NOT reverted.
4. `--run` → stop after one item. `--drain` → next `[ ]`; `[!]` stops the drain. `[~]` is skipped always.

### Phase 2 — Show (`/queue-up` bare, and after every Phase 1)
Print the file's pending + running lines as-is, then one line: `<P pending · R running · F failed · L later> · next: q<N>` or `queue empty`.

## Session hooks
- Session start / after `/clear`: a `[ ]` exists → mention once: `queue: N pending — /queue-up --run`. Never auto-run.
- Current work finishes and `[ ]` exists → same one-liner. Still never auto-run.
- `[>]` found at session start = prior session died mid-cut → downgrade to `[!] interrupted`, keep the tree.

## Principles
- Stage is free; cut is deliberate. Three verbs draw steel: `--now`, `--run`, `--drain`.
- Verbatim in, verbatim out. Don't rewrite, groom, or merge the user's words.
- Head first. FIFO unless the user names qN.
- Never invent a queue in a repo the user hasn't staged into.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. Applies to the work a queued task lands. `.claude/queue.md` itself is personal staging — never committed by this skill; respect the project's `.gitignore` either way.

## Don't
- No auto-run, ever — an appended line is not an instruction.
- No file of issues into `itr` — `#id` is consumed, not created.
- No reordering, deduping, or "helpful" grouping.
- No reversion on failure; leave evidence in the tree and the `[!]` line.
- No prose around the one-line reply after a stage.
