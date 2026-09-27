# Blitz Wave Execution Reference

## Phase 4 — Execute wave

For every task in the current wave, launch one Codex subagent in parallel. Use the active Codex subagent/background-session mechanism available in the environment. Each launch must include:

- Background execution, so all subagents in the wave can run concurrently.
- A short label, e.g. `Blitz task #42`.
- The task's repo path as the working directory.
- The per-subagent prompt template below.

If no parallel subagent mechanism is available, stop before editing and tell the user the blitz cannot execute in parallel in the current environment.

### Per-subagent prompt template

```
You are a wave subagent for blitz task {id}: {title}.

Task body:
{full body verbatim}

Files you OWN (only edit these):
{owned file list}

Files you must NOT touch (neighbor ownership and unrelated pre-existing edits):
{neighbor file list}

Neighbor warnings (semantic conflicts to avoid):
{neighbor notes — e.g. "task #58 is removing util/parse.rs::tokenize, do not call it"}

Working directory: {repo path}

Check existing owned paths and named symbols before editing; explicitly NEW files
may be absent. Report a moved/ambiguous target or additional required write path
before using it. Do not silently expand ownership.

Formatting and lint:
  - Run the configured read-only format and lint checks, including test targets
    where applicable. Keep Rust's `--all-targets` when scoping Clippy to a package.
  - Fix only owned files. A formatter with verified file-scoped behavior (such as
    `prettier --write <owned-file>` or `gofmt -w <owned-file>`) is allowed. Confirm
    its configuration/wrapper cannot expand the write set. Avoid crate/repo-wide
    formatting, code generation, or recursive module formatting during the wave;
    hand-edit when the tool's write boundary is uncertain.
  - Report outside-scope failures instead of repairing neighbor or user files.
  - Report check results; checks already included in the verify gate need not
    run a second time just to produce separate status lines.

When you finish editing, run the full-repo verify gate from the repo root:
  {verify command}

Run it in the foreground and wait for it to finish in this same turn. Do not launch it as a background task and then end your turn, and do not defer the close to a later turn. The gate result and the close command below must both happen before you yield. A subagent that backgrounds the gate and stops leaves its task stranded: the orchestrator then has to inspect the work and close it.

It MUST exit zero before closing. If another worker's in-flight code makes the gate red, report the exact failure and your completed work. Never repair outside your owned files. The orchestrator will coordinate the repair or run the gate after the other writer finishes.

Runtime-evidence gate — UI-touching / user-visible / behavioral diffs ONLY:
  A green verify gate is NOT enough to close a change a user can see or feel. If
  your diff touches UI or any user-visible/behavioral surface, you MUST capture
  runtime evidence before closing: drive the actual flow end-to-end and/or take a
  Playwright screenshot. If your change "wrote a value", exercise the READ site
  and prove it consumes the value; don't stop at confirming the write.

  Cover each entry point/mode named by the AC, including its read/restore path.
  If a test-only task changes production source, identify those sites and the
  behavior change explicitly. Do not change shipping behavior just to improve
  a coverage score; report any necessary scope change before implementing it.

  Pure non-UI work — refactors, backend-only logic, docs, config with no
  user-visible surface — is EXEMPT: the verify gate is its close gate. Do not
  stall a non-UI task hunting for a screenshot.

Visual Gate PO-smoke gate — stories whose AC contains a Visual Gate block ONLY:
  If this task's AC contains the `LOOK AT / IGNORE / EXPECTED / CONFOUNDERS`
  Visual Gate block, you MUST NOT self-close on green gate plus your own
  screenshot alone. Instead:
    1. Capture your runtime evidence as above (drive the flow / screenshot).
    2. Return CLOSE-PENDING to the orchestrator with evidence keyed to LOOK AT /
       EXPECTED and the documented smoke command. Leave the issue open as
       `awaiting PO visual smoke`; do not wait idle for a human inside the worker.
    3. The orchestrator gathers PO acceptance in the review step and owns the
       deferred close. Your screenshot does not substitute for required approval.

Report concrete out-of-scope bugs/gaps with evidence and impact. File them only
when the run's tracker policy authorizes it, checking duplicates first; otherwise
return them for orchestrator triage. Do not make unrelated issue creation a new
condition for closing the assigned task.

Only after the gate is fully green (and, for UI/behavioral diffs, runtime evidence is captured; and, for Visual-Gate stories, the PO has confirmed the smoke):
  - Close this task in the tracker: {close command}
  - Report a one-paragraph summary of what you changed and the verify-gate output (last 10 lines).

Do NOT commit, push, or branch. The user reviews and commits at the end.
```

---
