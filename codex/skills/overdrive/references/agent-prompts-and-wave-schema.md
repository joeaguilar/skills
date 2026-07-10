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
  - DO NOT run any write-mode formatter — it rewrites the whole project and wipes
    neighbors' in-flight edits:
      cargo fmt (even with a path arg) · prettier --write/-w · npm run format/fmt ·
      ruff format (no --check) · black · gofmt -w · goimports -w · any wrapper of these.
    READ-ONLY checks are SAFE and expected: cargo fmt --check · prettier --check ·
    ruff format --check · gofmt -l. If a read-only check reports drift OUTSIDE your
    owned files, surface it — do not auto-fix with a write-mode formatter. Inside your
    files, hand-edit the offending lines.

When done editing, run the full-repo verify gate from the repo root:
  {verify command}

It MUST exit zero. The full-repo gate is intentional: if a neighbor left a temporary
error outside your files, try to fix it — your run is also their safety net. If the gate
stays red on something clearly outside your scope after best effort, STOP and report
(do not guess-fix and risk a worse break).

Only after the gate is fully green:
  - Close the ticket:  {close command, e.g. itr close {id} "<one-line outcome>"}
  - Report: one paragraph on what changed + the last 10 lines of the verify output.
```

---

## Wave log schema (`sprint/{folder}/overdrive/wave-N.md`)

```markdown
# Wave N — sprint-N

**Pre-wave SHA:** <sha>   **Commit:** <sha> (or "rolled back")   **Smoke:** accepted | rejected×K | auto
**Closed:** itr#a, itr#b   **Quarantined:** itr#c

## Arms
| Ticket | Files | Confidence | Outcome | Retries |
|--------|-------|-----------|---------|---------|
| itr#a | src/a.rs | high | closed | 0 |

## Interventions
- <orchestrator fix / flaky-gate note / rollback + reason>

## Quarantine
- itr#c — K attempts — last error: <tail> — likely cause: <low-confidence files | …>

## Contract warnings
- <symbol removed, imported by still-open itr#d>
```

---
