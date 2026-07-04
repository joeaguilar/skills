---
name: plr
description: Use the `plr` CLI (Prompt Library in Rust) to store, retrieve, and organize reusable prompts kept as markdown files on disk. Trigger ANY time the user wants to save, reuse, look up, or manage a prompt/system-prompt/instruction-template — even if they don't say "plr". Phrases that should fire this skill include "save this as a prompt", "reuse my X prompt", "what prompts do I have", "get my code-review prompt", "add this to my prompt library", "list my prompts", "find a prompt about Y", "promote this prompt to my global/profile library", and similar. Also fire when the user wants to feed a stored prompt into an LLM or copy one to the clipboard. Do NOT fire for authoring brand-new prose the user just wants written once (not saved), or for editing arbitrary markdown files that aren't prompts.
---

# plr — prompt library

`plr` manages reusable prompts as markdown files. Prefer it over hand-rolling a
prompts folder + `grep`: it scopes prompts, resolves them by precedence, emits
JSON for you to parse, and **scrubs hidden Unicode payloads from every prompt at
write time** (Trojan Source, zero-width injection, homoglyphs).

## Default rules

- When you'll parse the output, pass `--format json`.
- When piping a stored prompt into an LLM or the clipboard, use `plr get <name> --raw`
  (body only, no frontmatter).
- Prompts live in three scopes; name resolution is **local → profile → global**
  (most specific wins). Pass `-s <scope>` to force one.

| Scope     | Location                       | Use it for                                 |
|-----------|--------------------------------|--------------------------------------------|
| `global`  | `~/.plr/global/`               | Machine-wide prompts shared everywhere      |
| `profile` | `~/.plr/profile/`              | The user's personal library                 |
| `local`   | nearest `.plr/` (walks upward) | Project prompts, committed to the repo      |

`$PLR_HOME` overrides the `~/.plr` base.

## Question → command mapping

| User asks…                                  | Command                                             |
|---------------------------------------------|-----------------------------------------------------|
| "what prompts do I have?"                   | `plr show all --format json`                         |
| "list my profile/local/global prompts"      | `plr show profile` (or `local`/`global`)             |
| "find a prompt about X"                      | `plr search "X" --format json`                       |
| "get / show me the X prompt"                | `plr get X --format json`                            |
| "give me the raw body of X" (to feed an LLM)| `plr get X --raw`                                    |
| "filter prompts by tag Y"                   | `plr list --tag Y --format json`                     |
| "save this as a prompt named X"             | `plr new X --stdin` (pipe the body in)              |
| "save X with tags/description"              | `plr new X -t a,b -d "desc" --stdin`                |
| "import this .md file as a prompt"          | `plr new X --file path.md`                           |
| "promote / move X to my profile library"    | `plr move X --to profile`                            |
| "share X machine-wide"                      | `plr copy X --to global`                             |
| "open my prompts folder"                    | `plr open profile`                                   |

## Workflows

### Retrieve a stored prompt to use it
`plr get <name> --raw` gives you the exact body to send to a model. Add
`-s <scope>` only if the same name exists in multiple scopes and the user wants a
specific one. If unsure the prompt exists, `plr search "<term>" --format json`
first.

### Save a prompt the user just wrote
Pipe the body via stdin so nothing is mangled:
```sh
printf '%s' "$BODY" | plr new my-prompt -t topic,lang -d "one-line description" --stdin
```
Default scope is `local` (project `.plr/`). Use `-s profile` for the user's
personal library or `-s global` for machine-wide. If there's no `.plr/` in the
project and the user wants a project-local prompt, create the dir first
(`mkdir .plr`) or save to `profile` instead.

### Answer "what do I have?"
`plr show all --format json` returns every prompt across scopes. Parse `name`,
`scope`, `tags`, `description`. `plr get <name> --format json` additionally
returns `body` and `path`.

## Gotchas

- **Scrubbing is silent-by-default success.** On `new`/`move`/`copy`, plr strips
  suspicious characters and prints a `Scrubbed N …` note to stderr. That's
  expected hardening, not an error — surface it to the user if N > 0, since it
  means the source text contained hidden characters.
- **`local` scope can be absent.** If there's no `.plr/` up the tree,
  local-scoped commands error. Fall back to `profile`, or create `.plr/`.
- **Only `name` is required** in frontmatter; unknown keys are preserved on
  read/write.
- **`--raw` omits frontmatter** — use it for feeding models, not for showing the
  user the full record.

## When NOT to use plr

- One-off prose the user wants written, not stored.
- Editing arbitrary markdown that isn't a reusable prompt.
- Managing issues (that's `itr`) or navigating code (that's `kgr`).

## Updating plr

`plr upgrade` rebuilds and reinstalls from the source checkout — run it only when
the user explicitly asks to update plr.
