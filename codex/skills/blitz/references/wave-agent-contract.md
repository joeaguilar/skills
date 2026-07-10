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

Files you must NOT touch (owned by neighbor subagents in this wave):
{neighbor file list}

Neighbor warnings (semantic conflicts to avoid):
{neighbor notes — e.g. "task #58 is removing util/parse.rs::tokenize, do not call it"}

Working directory: {repo path}

Prohibited commands — DO NOT run any of these under any circumstances:

  - DO NOT run `cargo fmt` — it operates crate-wide regardless of file args.
    Even `cargo fmt -- path/to/owned_file.rs` reformats the ENTIRE crate, wiping
    neighbor subagents' in-flight edits. Wiped neighbor edits in sprint-1
    W1.intervention-2 (~20min recovery via `git fsck --unreachable` blobs).
  - DO NOT run any other write-mode formatter, regardless of file args — same
    project-wide footgun pattern as `cargo fmt`:
      * `npm run format`, `npm run fmt`, `prettier --write`, `prettier -w`
      * `ruff format` (without `--check`), `black .`, `black <file>`
      * `gofmt -w`, `goimports -w`
      * Any wrapper script that shells out to the above

  READ-ONLY check variants ARE SAFE — they inspect without modifying and are
  expected as part of the verify gate:
      * `cargo fmt --check`            — safe (read-only)
      * `prettier --check`, `npm run format:check` — safe (read-only)
      * `ruff format --check`          — safe (read-only)
      * `gofmt -l` (lists drift, no write) — safe (read-only)

  If the verify gate's read-only check reports formatting drift OUTSIDE your
  owned files, do NOT auto-fix it with a write-mode formatter — surface the
  drift in your final report and let the orchestrator triage. Inside your
  owned files, hand-edit the offending lines instead of reaching for a
  write-mode formatter.

When you finish editing, run the full-repo verify gate from the repo root:
  {verify command}

Run it in the foreground and wait for it to finish in this same turn. Do not launch it as a background task and then end your turn, and do not defer the close to a later turn. The gate result and the close command below must both happen before you yield. A subagent that backgrounds the gate and stops leaves its task stranded: the orchestrator then has to inspect the work and close it.

It MUST exit zero. The full-repo gate is intentional — if another wave subagent left a temporary error in code outside your owned files, attempt to fix it; your verify run is also their safety net. If after best effort the gate is still red on something clearly outside your scope, stop and report.

Runtime-evidence gate — UI-touching / user-visible / behavioral diffs ONLY:
  A green verify gate is NOT enough to close a change a user can see or feel. If
  your diff touches UI or any user-visible/behavioral surface, you MUST capture
  runtime evidence before closing: drive the actual flow end-to-end and/or take a
  Playwright screenshot. If your change "wrote a value", exercise the READ site
  and prove it consumes the value; don't stop at confirming the write.

  Pure non-UI work — refactors, backend-only logic, docs, config with no
  user-visible surface — is EXEMPT: the verify gate is its close gate. Do not
  stall a non-UI task hunting for a screenshot.

Visual Gate PO-smoke gate — stories whose AC contains a Visual Gate block ONLY:
  If this task's AC contains the `LOOK AT / IGNORE / EXPECTED / CONFOUNDERS`
  Visual Gate block, you MUST NOT self-close on green gate plus your own
  screenshot alone. Instead:
    1. Capture your runtime evidence as above (drive the flow / screenshot).
    2. Report your work as CLOSE-PENDING, not closed: describe the visual change
       in observational terms keyed to the AC's LOOK AT / EXPECTED lines, and
       explicitly ask the PO to run the project's visual smoke path documented in
       the AC or project instructions (for example, `cargo native` when that is
       the project's smoke command).
    3. Do NOT run the close command yet. Wait for PO confirmation within the wave
       window.
    4. If the PO confirms: run the close command.
    5. If the PO is unavailable within the wave window: QUARANTINE the task
       (leave it open, report `awaiting PO visual smoke`). Do NOT self-close.
       The orchestrator's Phase 7 treats this as a soft quarantine — the wave
       still proceeds and the story resolves at `$sprint-review` under PO eyes.

Only after the gate is fully green (and, for UI/behavioral diffs, runtime evidence is captured; and, for Visual-Gate stories, the PO has confirmed the smoke):
  - Close this task in the tracker: {close command}
  - Report a one-paragraph summary of what you changed and the verify-gate output (last 10 lines).

Do NOT commit, push, or branch. The user reviews and commits at the end.
```

---
