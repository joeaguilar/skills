---
name: queue-up
description: Add (or create) a todo list item for this ask to be executed sequentially after your current work item is complete. `--persist` stages it in the project's `.claude/queue.md` for a later session; `--queue` opens the full persistent-queue controls (run/drain/drop/clear).
---

# queue-up

Add or create a todo list item in the TodoList tool for `$ARGUMENTS`. Execute this item next as part of your normal workflow.

**`--persist` as the first token:** do NOT touch the TodoList. Append one line to the project's `.claude/queue.md` (create it with a `# queue` header if absent), then reply in one line and resume what you were doing:
`- [ ] q<N> · <YYYY-MM-DD HH:MM> · <task verbatim> · @<branch>` — N = max existing id + 1.

**`--queue` as the first token:** read `QUEUE.md` in this skill's directory and follow it with the remaining arguments (`<task>`, `--now`, `--later`, `--run`, `--drain`, `--drop`, `--clear`, or nothing to show the queue).
