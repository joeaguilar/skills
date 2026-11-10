---
name: itr
description: "Use for filing, reading, claiming, updating, or closing work in an existing itr tracker, especially across sessions or contributors. Do not create a tracker or tickets for a small untracked edit."
---

# itr — tracked work lifecycle

Use the established tracker when work needs durable ownership, dependencies,
deferred findings, or continuity. A status question authorizes reads, not starting
work. Implementation of a tracked item normally includes routine claiming,
progress, and evidence-backed closure, subject to project rules and acceptance
reserved for the user.

## Establish conventions once

Run `itr stats` and `itr agent-info` once per session. Use the latter for current
commands, flags, transitions, and attribution. If no database exists, use the
requested source or a checklist; initialize only when tracker setup is requested.

Read `STORY_STYLE.md` when present, then repository instructions. Otherwise use
[the short issue template](references/issue-template.md). No style interview is
required. Set `ITR_AGENT=codex` for writes when unset, using the shell's syntax.

## Read and file

Use bounded JSON results (`-f json`, `--fields`) when parsing. Discover state
with `next`, `ready`, `wip`, `get`, or `search` as documented by `agent-info`.
For re-entry across conflicting sources, use `whats-next` when available.

Search before creating an issue. Reuse a clear existing match; resolve ambiguity
before adding a duplicate. Capture the actual returned ID.

```text
itr search "<terms>" -f json --fields id,title,status
itr add "<title>" -k <kind> -c "<context>" -a "<acceptance>" --files "<paths>" -f json
```

For batches, send a JSON array to `itr batch add` via stdin. Check the installed
interface and use `--dry-run` when supported. Capture each result and retry only
failed items after checking partial success. Do not upgrade the executable just
because an example flag is unavailable.

## Claim, update, and close

- Read the item and dependencies before claiming. Resolve competing ownership
  instead of stealing another active claim; continue independent ready work.
- Use `claim` and `update` per `agent-info`. Record changes to scope, dependencies,
  ownership, and continuation state when useful, not after every tool call.
- Close only after original acceptance and required verification pass. Attach
  changed behavior, check results, and a durable log or commit reference when
  available. A commit message or worker assertion alone is insufficient.
- In parallel work, workers report evidence and the coordinator closes after
  integration. Failed checks and outstanding human acceptance remain open.
- When authorized recovery removes implementation, reopen affected items with
  the reason and evidence; never erase history or alter unrelated issues.

Use existing `gatr` records for failed-gate evidence (`last --json`, `errors`, log
path). Do not rerun a completed gate merely to manufacture an attachment. Retain
available evidence and its limitations when no durable record exists.

Report IDs, final state, and unresolved next actions. Do not dump JSON or invent
priority, requirements, dependencies, or completion evidence.
