---
name: queue-up
description: Add (or create) a todo list item for this ask to be executed sequentially after your current work item is complete. For a queue that outlives the session (`.claude/queue.md`: stage, run, drain, drop, clear), the `queue` mod's `/queue` command does it with no model turn.
---

# queue-up

Add or create a todo list item in the TodoList tool for `$ARGUMENTS`. Execute this item next as part of your normal workflow.

**`--persist` or `--queue` as the first token:** the persistent queue is no longer this skill's work. Do NOT touch the TodoList and do not write `.claude/queue.md` yourself. Reply in one line that `/queue <task>` stages it (and `/queue --run`, `--drain`, `--drop qN`, `--clear` do the rest), then resume what you were doing. Where the `queue` mod is not loaded, say so instead: the old controls are kept in `claude/archived/skills/queue-up-persistent/` of the skills repo.
