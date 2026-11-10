# Dual Blitz Lane Artifact Reference

## Phase 4 - Write Lane Artifacts

Create exactly two agent-facing artifacts:

```text
dual-blitz/
  CURRENT
  dual-blitz-<N>-YYYY-MM-DD-<slug>/
    agent-1.md
    agent-2.md
```

`dual-blitz/CURRENT` contains only the run folder name. It is written before agents launch and is not edited by lane agents.

Each lane agent owns only its own artifact. Agent 1 may append outcomes to `agent-1.md`; Agent 2 may append outcomes to `agent-2.md`. Neither agent edits the sibling artifact or any shared run-state file.

Use this artifact shape:

```markdown
# Dual Blitz <run> - Agent <1|2>

**Mode:** execute-lane
**Source:** <sprint/itr/path>
**Lane goal:** <one sentence>
**Verify gate:** <command>
**Concurrency:** <N inner blitz workers max>
**Artifact owner:** agent-<N> only

## Safety Contract
- Execute only the Lane Backlog below.
- Edit only files listed in Owned Files, unless a task discovers a required extra file that is not forbidden; record it before editing.
- Never edit Forbidden Files.
- Never run write-mode formatters or code generators that can touch files outside Owned Files.
- If required work crosses into Forbidden Files, quarantine the task and continue with unrelated work.
- The API sees both lanes at once, so effective fan-out is 2 x concurrency-per-agent. On a rate-limit cascade (workers in both lanes failing identically at the same time), halve inner concurrency before respawning only the failed tasks.
- Do not commit, push, or rewrite history.

## Owned Files
- <file or root>

## Forbidden Files
- <file or root owned by the other lane>
- <parked conflict files>

## Neighbor Warnings
- <semantic warning or "none">

## Lane Backlog
| ID | Title | Risk | Files | Dependencies | Acceptance |
|----|-------|------|-------|--------------|------------|
| ... |

## Parked For This Lane
- <id/title> - <reason>

## Execution Instructions
Run a lane-contained `$blitz`:
1. Treat `Lane Backlog` as the complete tracker. Do not list or execute global backlog items.
2. Build inner waves exactly like `$blitz`: no two inner workers in the same wave may own the same file.
3. Pass each inner worker the Safety Contract, Owned Files, Forbidden Files, Neighbor Warnings, task body, and verify gate.
4. Run the full verify gate between inner waves.
5. Quarantine, do not improvise, when a task needs forbidden files or cross-lane coordination.
6. Append outcomes to this artifact only.

## Outcomes
<!-- Agent <N> appends compact wave outcomes here. -->
```

If `itr` supports safe tag updates according to `itr agent-info`, optionally tag lane tasks after approval with `dual-blitz-<N>` and `dual-agent-1` or `dual-agent-2`. The artifacts remain the source of truth; do not depend on tracker filters for safety.
