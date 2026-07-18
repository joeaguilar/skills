---
name: codex-computer-use
description: "Ask Codex CLI (gpt-5.6-terra) to verify a local app with real computer use — GUI/browser automation, simulators, desktop-app launching, screenshots — as an independent runtime inspection. Trigger: \"have Codex/gpt-5.6-terra test this flow\", \"get Codex to verify the UI at runtime\". NOT for checks Claude can run itself, for driving the app with Claude's own tools (use /run or /verify), or for handing Codex a coding task (use /codex:rescue)."
---

# Codex Computer Use

Use Codex as a separate local verification agent when the task needs real UI interaction, screenshots, simulator/browser/device state, or an independent runtime check outside Claude's current context. Codex (gpt-5.6-terra) drives the machine through shell — launching apps, `xcrun simctl`, browsers, `screencapture` — and can read back the screenshots it captures.

Do **not** use this for ordinary code reading, typechecking, linting, or tests Claude can run directly. Launching apps, simulators, or browsers to verify the requested work is fine without asking; ask first only if the run could disrupt the user's environment beyond that (closing their apps, changing system settings, acting on real accounts or data).

## Invocation

| Trigger | Effect |
| --- | --- |
| `/codex-computer-use` | Hand a self-contained verification task to Codex CLI and report the result |

## Workflow

1. **Create a temp artifact directory** for the prompt, screenshots, logs, and the report.
2. **Write a self-contained prompt** with the repo path, exact flow, constraints, artifact directory, and required report format.
3. **Run `codex exec` non-interactively**, capturing Codex's final message as the report.
4. **Read Codex's report**, inspect or reference the screenshot paths, and summarize pass/fail/blocked for the user.

Command shape:

```bash
ARTIFACT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/codex-computer-use.XXXXXX")"
REPORT="$ARTIFACT_DIR/report.md"
PROMPT="$ARTIFACT_DIR/prompt.md"

# ...write the self-contained prompt to "$PROMPT" (see Prompt Requirements below),
# instructing Codex to save screenshots/logs into "$ARTIFACT_DIR" and to make its
# FINAL message the full structured report...

codex exec \
  -C "$PWD" \
  -m gpt-5.6-terra \
  -c model_reasoning_effort="high" \
  --add-dir "$ARTIFACT_DIR" \
  -s danger-full-access \
  -o "$REPORT" \
  "$(cat "$PROMPT")"
```

- `-c model_reasoning_effort="high"` pins terra's standing default — a bare `codex exec` inherits `~/.codex/config.toml`, which may be set to `ultra` (per the Codex 5.6 rules in `claude/MODELS.md`, ultra is user-requested-only). Only bump to `ultra` if the user asked for it; this is already a solo run, so that satisfies the solo-lane half of the gate.
- `-o "$REPORT"` (the letter **o**, not zero) writes Codex's **final message** to `$REPORT` — so tell Codex its final message *is* the report; don't also ask it to write a separate `report.md` (they'd collide).
- **`-s danger-full-access` is the mode this skill runs in.** Real computer use — launching a browser or GUI app, driving a simulator, reaching a local server on `localhost` — requires it. Under `-s workspace-write` Codex's sandbox **denies network by default (so `localhost` is unreachable) *and* blocks browser/GUI launch**, so a computer-use run there comes back **BLOCKED** without ever loading the app. If a run reports BLOCKED and never reached the UI, this is almost always why — rerun with `danger-full-access`. Only use `workspace-write` for a rare in-repo, no-network, no-GUI check, and those usually belong in `/run` or `/verify`, not here.
- **`danger-full-access` removes *all* sandboxing** (full network, filesystem, and process access) — a real privilege escalation. Scope the prompt to the app under test on `localhost`; the "launch without asking" latitude covers launching that local app, **not** reaching real hosts, accounts, or system state (see Don't).
- `-C "$PWD"` sets Codex's working root; point it at the repo you want verified. `--add-dir "$ARTIFACT_DIR"` keeps the artifact dir writable when it lives outside that root.
- Add `--skip-git-repo-check` when the working directory is not a git repository.

## Prompt Requirements

Tell Codex:

- The exact behavior to verify.
- The platform and app type (iOS, Android, web, Electron, CLI, desktop).
- Known launch commands, test credentials, seed data, deep links, or fixtures.
- Whether source edits are allowed. **Default: no edits.**
- Where screenshots and logs go (`$ARTIFACT_DIR`), and that its **final message must be the report**.
- To return **pass / fail / blocked**, plus steps performed, observed behavior, screenshot paths (absolute), and actionable feedback.

Keep the prompt specific enough that Codex does not need the surrounding Claude conversation.

## Principles

- **Independent check, not a proxy for Claude's own tools.** Reach for Codex when the value is a *second* agent driving real UI outside Claude's context — not to offload work Claude can do inline.
- **Evidence over assertion.** A report that claims "works" without a screenshot path or observed-behavior detail is a blocked run, not a pass — say so to the user.
- **Full-access sandbox is the norm here — and a real escalation.** Genuine computer use (browser, GUI, simulator, `localhost`) requires `-s danger-full-access`; `workspace-write` can't reach a local server or launch a browser and comes back BLOCKED. Because full access removes all sandboxing, keep the prompt scoped to the app under test on `localhost` and never point it at real accounts, hosts, or system state.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. A pure verification run edits no source (screenshots and reports live in the temp artifact dir) — nothing lands in the repo, so there is nothing to commit; if the user allowed Codex to edit source, commit those changes.

## Don't

- Don't use this for typecheck/lint/unit tests Claude can run directly.
- Don't let Codex edit source unless the user asked for it.
- Don't probe real accounts, hosts, or user data, or close the user's apps / change system settings, without explicit approval.
- Don't report a pass you can't back with the screenshot paths or observed behavior in Codex's report.
