---
name: itr
description: Use the itr CLI to file issues in the project's agent-first issue tracker. Trigger when Codex is asked to file, log, open, create, or track an issue, bug, ticket, task, backlog item, or multiple issues from a list, even when the user does not mention itr. Do not trigger for claiming, starting, updating, closing, or otherwise working existing issues unless the user is creating a new issue.
---

# itr - File Issues

`itr` is the project's issue tracker CLI and should already be on `PATH`. For filing, use `itr add`; for bulk filing, use `itr batch add`.

## Before Filing

1. Run `itr stats` once per session to confirm a database exists. If it says to run `itr init`, surface that to the user and confirm before creating `.itr.db`.
2. Run `itr agent-info` once per session for current flags, urgency rules, and conventions. Prefer that output over examples in this skill.
3. Look up project story conventions before writing titles, bodies, acceptance criteria, and tags:
   - Prefer `./STORY_STYLE.md`.
   - Then scan `AGENTS.md`, `CODEX.md`, or other repo-local agent instruction files for issue or story style.
   - If no style file exists, continue with the defaults below and print one soft suggestion: `No STORY_STYLE.md found - consider /story-style to capture project conventions.` Skip the suggestion if the user already declined it this session.

When a style exists, follow it for title shape, body template, acceptance format, tags, priority scheme, terminology, and voice.

## Single Issue Command

```bash
itr add "<title>" -p <priority> -k <kind> -c "<context>" -a "<acceptance>" --tags "<a,b>" --files "<path1,path2>" -f json
```

- `title`: imperative and specific, such as `Fix race in upload queue`.
- `-p`: `critical`, `high`, `medium`, or `low`. Default to `medium` unless the user signals otherwise.
- `-k`: `bug`, `feature`, `task`, or `epic`. Ask only when genuinely ambiguous.
- `-c` / `--body`: why the issue matters and any reproduction or implementation context.
- `-a`: concrete acceptance criteria. Omit only if the user explicitly wants a placeholder.
- `--files`: relative paths implicated by the issue.
- `--tags` / `--skills`: comma-separated values. Use existing tags when possible; inspect with `itr list -f json --fields tags`.
- `--blocked-by` / `--parent`: set when the user names a dependency or parent epic.

If `ITR_AGENT` is unset, prefix filing commands with `ITR_AGENT=codex` for audit attribution unless `itr agent-info` or project conventions specify another value.

## Bulk Filing

When the user gives a list of issues, use `itr batch add` with a JSON array on stdin instead of one command per issue. The schema mirrors `itr add`; confirm exact field names with `itr agent-info`.

## Workflow

1. Gather the minimum clear title, priority signal, kind, and acceptance criteria. Ask one focused question if the request is too vague to file responsibly.
2. Check for duplicates with `itr search "<key terms>" -f json --fields id,title,status`. If a likely match exists, ask whether to relate to it instead of creating a duplicate.
3. File with JSON output and capture the new issue ID.
4. Report the issue ID and a one-line summary. Do not dump full JSON.

## Guardrails

- Do not invent priority, kind, or acceptance criteria the user did not imply; ask or omit the optional field.
- Do not use absolute tool paths; `itr` should be on `PATH`.
- Do not file the same issue twice.
- Do not claim, start, update, or close issues from this skill.
