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
  --add-dir "$ARTIFACT_DIR" \
  -s danger-full-access \
  -o "$REPORT" \
  "$(cat "$PROMPT")"
```

- `-o "$REPORT"` writes Codex's **final message** to `$REPORT` — so tell Codex its final message *is* the report; don't also ask it to write a separate `report.md` (they'd collide).
- Use `-s danger-full-access` for GUI automation, iOS/Android simulators, desktop-app launching, screenshots, or any access outside the repo. For non-GUI checks that only need the repo and artifact directory, prefer `-s workspace-write`.
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
- **Least privilege sandbox.** Use `workspace-write` unless the flow genuinely needs GUI/out-of-repo access; escalate to `danger-full-access` only when it does.

## Don't

- Don't use this for typecheck/lint/unit tests Claude can run directly.
- Don't let Codex edit source unless the user asked for it.
- Don't probe real accounts, hosts, or user data, or close the user's apps / change system settings, without explicit approval.
- Don't report a pass you can't back with the screenshot paths or observed behavior in Codex's report.
