---
name: gauntlet
description: "Use only when the user explicitly invokes $gauntlet or asks Codex to run or resume a rubric-gated visual build/critique gauntlet. Drive bounded Build → Capture → Critique iterations inside a durable Codex goal; use blind instrumented critics, deterministic gate and measurement scripts, a route ledger, and cxq transcript reconciliation. Do not use for a one-off review, ordinary backlog execution, or a roadmap campaign."
---

# Gauntlet

Improve a visual subsystem until the bundled deterministic gate reports `CLOSED`, `PLATEAU`, or `CAPPED`. Treat the gate as referee, critics as witnesses, and the root Codex agent as clerk and orchestrator.

## Invocation

```text
$gauntlet [subsystem|all] [--cap N] [--bar N] [--resume] [--dry-run]
```

- Default subsystem: `all`.
- Default cap: `40` total iterations.
- Default bar: `8`; use `9` for a polish pass explicitly gated at 9.
- `--resume`: reconstruct state from `STATUS.md`, the gate report, the current goal, and `cxq` evidence.
- `--dry-run`: inspect prerequisites and describe the proposed goal and first transition. Do not create a goal, spawn agents, copy tools, write files, or commit.

## Load-bearing tools

Copy these byte-for-byte from this skill's `assets/` directory when the project lacks them. Never regenerate them from memory.

```text
assets/gate.mjs          → tools/gate.mjs
assets/measure.mjs       → tools/measure.mjs
assets/merge-panel.mjs   → tools/merge-panel.mjs
```

Typical installed locations are `~/.codex/skills/gauntlet/` and `<project>/.codex/skills/gauntlet/`. Stop if the assets cannot be found.

```text
node tools/gate.mjs [--dir critiques] [--json]
node tools/gate.mjs --check <subsystem>
node tools/gate.mjs --validate <critique.json>
  --waive <subsystem>:<axis>   # repeatable, invocation-local
  --cap N                      # invocation-local; default 40
  --bar N                      # invocation-local; default 8

node tools/measure.mjs assert <png...> [--w W --h H] [--json]
node tools/measure.mjs diff <a> <b> [--threshold N] [--boxes boxes.json] [--pad N] [--json]
node tools/measure.mjs torso-sat <png> --rects rects.json [--json]
node tools/measure.mjs rim-floor <png> --boxes boxes.json [--ring 3 --gap 5] [--json]
node tools/measure.mjs luma-bands <png> --bands y0:y1,... [--json]

node tools/merge-panel.mjs --out <merged.json> <critic-a.json> <critic-b.json> <critic-c.json>
```

Parse JSON output; never scrape prose. `gate.mjs` is stateless. Persist its complete invocation flags in exactly one `STATUS.md` line:

```text
Gate flags: --cap N [--bar N] [--waive subsystem:axis ...]
```

Append that line verbatim to every gate call. A call missing a recorded flag is a different gate and its answer is void.

## Goal envelope

On a real, explicit invocation, create one Codex goal whose objective names:

- the target subsystem or slice;
- the rubric and closure bar;
- allowed terminal outcomes: `CLOSED`, `PLATEAU`, or `CAPPED`;
- required gate report and ledger reconciliation.

Do not invent a token budget. If goal tools are unavailable, record `Goal: unavailable` in `STATUS.md`, operate only in bounded iterations, and provide an explicit resume handoff at the turn boundary. Do not pretend a prose loop is a durable goal.

Call `get_goal` at every checkpoint. Mark the goal complete only after a permitted terminal gate outcome, route-ledger reconciliation, and required handoff artifacts. Follow the goal tool's blocked-state threshold; an ordinary failed prerequisite does not immediately make the goal blocked.

## Phase 0: blocking preflight

Run every check, including on resume:

1. Confirm the user explicitly invoked Gauntlet. For `--dry-run`, remain read-only.
2. Read applicable `AGENTS.md`, inspect git status, and declare owned files before any write. Never absorb unrelated work.
3. Require `RUBRIC.md` with these seven anchored axes and 3/5/8/10 anchors: `palette_lighting`, `sprite_readability`, `parallax_depth`, `ui_polish`, `animation_feel`, `scene_composition`, `performance`.
4. Require a runnable capture command such as `node tools/shoot.mjs <label>` that produces PNGs in `shots/`.
5. Install the three bundled tools when missing; create `critiques/` and `shots/`; prove `gate.mjs --json`, `measure.mjs --help`, and `merge-panel.mjs --help` run. Commit newly installed project tools before iteration 1.
6. Require `itr stats` so residual findings can be filed rather than parked in prose.
7. Ensure `STATUS.md` contains the gate flags, current iteration, next action, goal identity/status, and route ledger.
8. Probe critic routes: Codex read-only subagents must be available; `claude -p` is the optional cross-model Opus route. Record unavailable routes before dispatch.
9. Require `cxq --version`; use `cxq` for transcript reconciliation. If unavailable, record `TRANSCRIPT-UNAVAILABLE`; this blocks closure reconciliation but not capture or critique.

## Iteration protocol

Run one bounded iteration at a time. The root agent owns phase barriers and deterministic scripts; subagents never decide closure.

### 1. Query state

Run `gate.mjs --json <Gate flags>`. Use its state to choose exactly one next action:

- `CLOSED`: reconcile and finish the subsystem.
- `CONFIRM`: run the confirmation panel.
- `BLOCKED`: repair bookkeeping or invalid critique data; do not dispatch a builder.
- `PLATEAU` or `CAPPED`: write the terminal handoff and stop.
- Otherwise: run Build → Capture → Critique.

For a new subsystem with no critique record, start iteration 1.

### 2. Build

Dispatch one workspace-write builder for one subsystem. Give it the prior critique path, cited findings verbatim, an explicit owned-file set, and the current iteration. The builder returns changed files plus measurable claims. Never run parallel builders against the same scene file.

When asset generation is required, allow at most three conflict-free attempts in parallel. Pick the winner during critique. File a residual and ship the best attempt if all three fail; do not start a fourth attempt.

### 3. Capture

Run the project capture command, then run `measure.mjs assert` against every PNG before any critic is dispatched. A failed assertion is a capture-rig failure: repair and reshoot without consuming a critique round.

### 4. Critique

Critics are read-only and blind. Their prompt contains exactly:

- the contents of `RUBRIC.md`;
- current shot paths;
- the prior critique path, when present;
- the measurement command block above;
- the required critique JSON schema.

Do not disclose the bar, closure mechanics, iteration cap, confirmation status, or what a score triggers. Require every measured claim to cite the exact measurement command and output. Forbid ad-hoc PNG decoders.

Regular rounds alternate model families when routes exist:

- odd iteration: read-only Opus critic through `claude -p`;
- even iteration: read-only Codex critic subagent.

If the planned route is unavailable, use an independent read-only Codex critic and record `CROSS-MODEL-DOWN`; never silently change the jury.

For `CONFIRM`, run three independent critics: two Opus taste lenses and one Codex reproduction lens. Write each response to a temporary JSON file, validate each with `gate.mjs --validate`, and regenerate invalid output through the same critic route. Never hand-edit a verdict. Merge the three validated verdicts with `merge-panel.mjs`; retain all source verdicts and validate the merged file.

### 5. Gate

After validation and commit of the critique files:

```text
node tools/gate.mjs --check <subsystem> <Gate flags>
node tools/gate.mjs --json <Gate flags>
```

- Only exit 0 from `--check` can report `CLOSED`.
- `BLOCKED` means repair measurement, waiver evidence, or invalid files without rebuilding.
- For a constraint-bounded axis, add a measured `Known caps` entry to `RUBRIC.md` and append the corresponding `--waive` flag to the durable gate-flags line.
- On `PLATEAU` or `CAPPED`, write `PLATEAU.md` containing the verbatim JSON gate report and open itr residual list.

## Mandatory checkpoint

After every iteration:

1. Append one route-ledger row per phase, including actual task/agent identity.
2. Replace the generated score section with verbatim `gate.mjs` output; never hand-edit scores.
3. File every deferred finding to itr with critique file and axis references.
4. Stage only declared owned files and create an ownership-scoped commit. Never use `git add .` or `git add -A`.
5. Record `get_goal` status and token usage when available.
6. Query `cxq tools`, `cxq bash`, and `cxq writes` for the current session; reconcile dispatches and writes against the ledger.

Use this exact ledger shape:

```markdown
## Route ledger
| iter | subsystem | stage | planned | actual | task_id | reason if differs |
|---:|---|---|---|---|---|---|
| 1 | street | build | codex-builder | codex-builder | <id> | — |
```

Reason codes: `CROSS-MODEL-DOWN`, `TOOL-MISSING`, `RATE-LIMIT`, `TASTE-REQUIRED`, `SUBAGENT-UNAVAILABLE`, `TRANSCRIPT-UNAVAILABLE`.

Gate exit 0 plus a clean route/write ledger closes a subsystem. Either one alone is insufficient.

## Integrity rules

- Preserve critic blindness and validate every verdict.
- Never spawn a critic before capture assertions pass.
- Never hand-edit critic scores, merged medians, or generated status scores.
- Never let a builder, critic, or root-agent opinion override the gate.
- Never omit durable gate flags.
- Never hide a model-route fallback.
- Never park residuals only in prose.
- Never mark the Codex goal complete before terminal gate output and reconciliation.
