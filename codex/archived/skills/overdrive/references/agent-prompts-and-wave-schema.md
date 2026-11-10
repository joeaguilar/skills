# Overdrive Agent and Wave References

## Per-arm prompt template

Each arm receives its **baked plan** — it doesn't rediscover. Inject the pre-plan values:

```
You are arm {id} in overdrive wave {N}: {title}.

Baked implementation plan (follow it; you may refine, but stay in your file set):
{plan steps from Phase 2}

Ticket body / AC:
{full body + acceptance verbatim}

Files you OWN — edit ONLY these:
{owned file list}

Files owned by neighbor arms in this wave — DO NOT touch:
{neighbor file list}

Semantic neighbor warnings:
{e.g. "arm #58 is removing util/parse::tokenize — do not call it"}

Working directory: {repo path}   Branch: {branch} (shared with other arms)

HARD RULES:
  - DO NOT commit, push, branch, or spawn a git worktree. The orchestrator is the
    sole committer; worktrees break the shared-tree self-healing.
  - Write files ATOMICALLY (write to a temp file, then move into place). Never leave a
    half-written file — a neighbor or the verify gate may read it.
  - Run configured read-only format checks. A formatter with verified file-scoped
    behavior may fix owned files using explicit paths. Do not run workspace-wide
    wrappers, code generation, or recursive module formatting during a live wave.
    Report drift outside your ownership for the orchestrator to assign after
    writers finish; do not fix neighboring files.

When done editing, run the full-repo verify gate from the repo root:
  {verify command}

It MUST exit zero before closing. If a neighbor's in-flight code makes the gate red,
report the failure and your completed work without editing outside your ownership.
The orchestrator coordinates the repair and reruns the gate after writers finish.

For a task that explicitly requires PO visual acceptance, capture the runtime
evidence but do not self-close. Return `awaiting PO visual smoke`, its AC, evidence,
and the next review action. The orchestrator holds the issue outside the execution
queue until Phase 7/8 receives the verdict. Do not wait idle for the PO in a worker.

Only after the gate and all acceptance requirements that permit worker closure pass:
  - Close the ticket:  {close command, e.g. itr close {id} "<one-line outcome>"}
  - Report: one paragraph on what changed + the last 10 lines of the verify output.
```

---

## Wave log schema (`sprint/{folder}/overdrive/wave-N.md`)

```markdown
# Wave N — sprint-N

**Pre-wave SHA:** <sha>   **Commit:** <sha> (or "rolled back")   **Smoke:** accepted | rejected×K | auto
**Closed:** itr#a, itr#b   **Quarantined:** itr#c
**Awaiting PO visual smoke:** <IDs, or none; not closed or failed>

## Arms
| Ticket | Files | Confidence | Outcome | Retries |
|--------|-------|-----------|---------|---------|
| itr#a | src/a.rs | high | closed | 0 |

## Interventions
- <orchestrator fix / flaky-gate note / rollback + reason>

## Quarantine
- itr#c — K attempts — last error: <tail> — likely cause: <low-confidence files | …>

## Pending human acceptance
- <ID — AC, runtime evidence, next review action, and eventual PO verdict>

## Contract warnings
- <symbol removed, imported by still-open itr#d>
```

---
