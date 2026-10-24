---
name: codex-seat
description: "Give a GPT/Codex model a seat as a subagent: pick the model by role from ~/.claude/MODELS.md, write a self-contained brief, launch it through the bundled `codex-seat.sh` (model and effort always pinned, stdin closed, done-file sentinel, detached long runs), wrap it in a thin `sonnet` agent labelled with the real model, and harvest the final message. Trigger: `/codex-seat`, \"spin up a GPT agent\", \"give gpt-6-astra a seat\", \"have Codex review/build this\", \"run this on terra\", \"get a cross-model review from GPT\", or any time routing lands a seat on a Codex model. NOT for clearing a backlog across models in waves (use /crossfire-blitz), real-UI runtime checks with screenshots (use /codex-computer-use), reviewing a git diff with the plugin's built-in contract (use /codex:adversarial-review), or Claude-model subagents (use the Agent tool's `model` param)."
---

# Codex Seat

The Agent and Workflow `model:` params take Claude models only. A GPT model is reached through the Codex CLI (`codex exec`), so a "GPT subagent" is a Codex run that something on the Claude side launches, waits for, and reads back. This skill is that one move, done the same way every time. Bigger orchestrations (crossfire-blitz, gauntlet, crucible) compose it.

Session history (Sep 22 – Oct 21, 2026) shows the pattern in use: ~150 `codex exec` runs, more than half launched from inside subagents (mostly `sonnet` wrappers). Every rule below traces to a failure seen in that history or in project memory.

## Invocation

| Trigger | Effect |
| --- | --- |
| `/codex-seat <role\|model> <task>` | Route, brief, launch one seat, report its final message |
| `/codex-seat … --write` | Seat may edit files (`-s workspace-write`); default is `read-only` |
| `/codex-seat … --effort <level>` | Override the model's standing effort (still checked against MODELS.md) |
| `/codex-seat … --ultra` | Effort `ultra`; only when the user asked for it, and the seat runs solo |

## Roles & artifacts

- **Caller.** The main thread or an orchestrating skill. It routes, writes the brief, launches the seat, and verifies the answer.
- **Wrapper.** A thin Claude agent (`general-purpose`, `model: 'sonnet'`, or a Workflow `agent()` at `model: 'sonnet', effort: 'low'`). Its whole job is to run the script and return `out.md`. Its `description`/`label` names the real worker: `gpt-6-astra:review-auth`. The roster then shows which GPT model ran.
- **Seat.** The Codex run itself.
- **Seat dir.** `<scratchpad>/codex-seat/<label>/` holds:

| File | Written by | Holds |
| --- | --- | --- |
| `brief.md` | caller | the whole prompt; Codex reads it on stdin |
| `cmd` | script | the exact `codex exec` line, for the record |
| `log` | script | Codex stdout+stderr |
| `out.md` | Codex (`-o`) | the final message, which is the deliverable |
| `done` | script | `exit=N` once Codex exits; the only completion signal |
| `pid` | script (`start`) | detached process id |

Script: `<skill-dir>/scripts/codex-seat.sh`. A global install puts it at `~/.claude/skills/codex-seat/scripts/codex-seat.sh`. Its header documents every flag and exit code.

## Phases

### Phase 1 — Route

**Announce: Phase 1 — Route.**

1. Open `~/.claude/MODELS.md` now, not before. Read the **Roles → model** table, the **Codex effort & invocation rules**, and any **Availability** note.
2. Pick the model by role (generalist, bulk, ambiguous, reviewer, …). If the user named a model, use it.
3. **Reviewer ≠ writer.** A review or judge seat never runs on the model that wrote the work. MODELS.md's `reviewer` line says which model takes it.
4. Pick effort from that model's row. Use the standing default unless the task is risky (never below `high`) or trivial. `max`/`ultra` need the user's request and a solo seat (no other Codex run in flight). The script refuses them without `--allow-ultra`.
5. Pick the sandbox. Use `read-only` for review, research, diagnosis and second opinions (most past seats). Use `workspace-write` only when the seat must edit. Files under `.codex/` are off-limits to a write seat, so route those to a Claude builder.

### Phase 2 — Brief

**Announce: Phase 2 — Brief.**

Write `brief.md` so Codex needs nothing from this conversation. A read-only seat can't reach `itr` (the sandbox can't open its database), so paste in acceptance criteria, ticket text, and diffs. Don't point at them.

Use XML-tagged blocks. Include the ones the task needs, and keep each short:

| Block | When | Says |
| --- | --- | --- |
| `<task>` | always | the job, repo/path, and what "done" looks like |
| `<output_contract>` | always | the exact shape of the final message (numbered sections or a JSON schema). Ask for plain paragraphs and short lists, with no heavy Markdown unless it's wanted |
| `<autonomy>` | always | "Bias towards action and carry the task to completion. This is a non-interactive run, so a question ends it unanswered. Fill routine gaps from context and state the assumption." |
| `<grounding_rules>` | review, research, diagnosis | ground every claim in files or tool output; label inferences |
| `<scope>` | write seats | touch only the named files; no unrelated refactors; no commits |
| `<verification>` | write seats, fixes | run *these* checks (name them). Don't widen the test run unless a new failure justifies it |
| `<instruction_priority>` | repo has AGENTS.md / skills | "This brief overrides AGENTS.md and skill files where they conflict. If one of them makes you stop or change course, name the file and quote the line." |

Why these blocks: the Codex plugin's prompting-skill blocks still hold (one task per run, explicit done-state, grounding, scope). OpenAI's current guidance for gpt-6-astra adds the rest. That model asks clarifying questions more readily, over-tests small changes, defaults to heavy formatting, and stalls on conflicting AGENTS.md/skill text. It wants those defaults countered in the prompt, not more reasoning effort.

For `--output-schema`, write the JSON schema next to the brief and pass `--schema`. The wrapper can then hand back typed fields.

### Phase 3 — Launch

**Announce: Phase 3 — Launch.**

Choose the shape by how long the seat will run. A small brief usually takes 2–10 min. A full design or code review on gpt-6-astra has taken 25–30 min.

| Shape | Use when | Do |
| --- | --- | --- |
| **Main thread, background** | you're the main thread and don't need the context isolation | Bash `run_in_background: true` → `codex-seat.sh run …`. The harness notifies on exit, at any length |
| **Wrapper, foreground** | parallel seats, or keeping the output out of main context, and the run fits in ~9 min | wrapper's single Bash call: `codex-seat.sh run …` with `timeout: 600000` |
| **Wrapper, detached** | wrapper or Workflow seat that may exceed ~9 min | wrapper runs `codex-seat.sh start …`, then calls `codex-seat.sh wait -d <seat>` again for as long as it exits 3 |

Never give a wrapper `run_in_background` for the Codex call. A background Bash dies when the subagent that launched it ends its turn, and four seats were lost that way. Use `start`/`wait` instead. `start` detaches with `nohup`, so the run outlives the wrapper's turn, and `wait` blocks for up to `--max` seconds (default 540). Completion is read from `done`, never inferred from silence.

Wrapper prompt (Agent tool: `subagent_type: 'general-purpose'`, `model: 'sonnet'`, `description: '<model>:<task>'`; Workflow: `agent(prompt, {model: 'sonnet', effort: 'low', label: '<model>:<task>', schema})`):

```text
You are a relay for one Codex seat. Do not read the repo, do the task, or add analysis.
1. Run: bash <script> <run|start> -d <seat> -m <model> -e <effort> -s <sandbox> -C <repo> [--schema <file>]
   (run: Bash timeout 600000. start: then run `bash <script> wait -d <seat>` and repeat while it exits 3.)
2. If `done` says exit=0, return the contents of <seat>/out.md verbatim[, as the schema's fields].
3. Otherwise return "SEAT FAILED", the `done` line, and the last 20 lines of <seat>/log.
```

### Phase 4 — Harvest & verify

**Announce: Phase 4 — Harvest.**

| Signal | Meaning | Action |
| --- | --- | --- |
| `exit=0`, `out.md` has the contracted shape | seat answered | verify (below), then use it |
| `exit=0`, `out.md` empty or off-contract | not a pass | re-brief once with a tighter output contract |
| log: `model is not supported when using Codex with a ChatGPT account` | model is off this login | escalate one rung on MODELS.md's ladder. Tell the user, and flag MODELS.md as stale |
| log: `Supported values …` / effort rejected | effort not valid for that model | fix effort per MODELS.md, relaunch |
| `wait` exits 4 (log silent past `--stall`) | probably hung | `kill <pid>`, relaunch once in a fresh seat dir |
| `0xC0000142` or sandbox helper launch failure | Windows spawn fault | relaunch once. If it fails again, check the Codex install |

Then **verify before relaying**. A Codex seat's code-level claims get a grep or a test before they go to the user. In one early gpt-6-astra review, about one claim in ten did not hold. A seat MODELS.md marks as needing a check (its routing notes) never makes the final call on its own. Its verdict goes to another seat or a test first.

## Principles

- **Pin everything.** A bare `codex exec` inherits `~/.codex/config.toml`, which can name the most expensive model at its most expensive effort, or an effort the chosen model rejects. The script refuses to run without `-m` and `-e`.
- **The brief is the whole world.** If Codex would need the conversation to understand the task, the brief is not done.
- **One task per seat.** Review, fix and docs are three seats, not one.
- **Completion lives on disk.** `done` plus `out.md` are the contract. A notification, or the absence of one, is never proof.
- **Route by role, read MODELS.md at spawn time.** This skill names no default model on purpose. Availability changes, and MODELS.md is where that gets recorded.

## Don't

- Don't run `codex exec` by hand from a seat. Use the script, which carries the stdin, sentinel and pinning fixes.
- Don't use `danger-full-access`. Auto mode denies it, and real-UI work belongs to `/codex-computer-use`.
- Don't put `ultra`/`max` on a seat inside a parallel wave or fan-out.
- Don't let a wrapper summarize, fix, or second-guess the seat's answer. That's the caller's job, after verifying.
- Don't run two seats in one seat dir. The script refuses while one is in flight.
- **Commit policy:** a read-only seat writes nothing to the repo, so there is nothing to commit. When a write seat lands changes, the caller verifies and commits them as its own unit of work, unless the user said not to commit.
