---
name: crossfire-review
description: "Fire TWO independent adversarial code reviews at the same diff — the Codex native reviewer (via the codex plugin runtime) and a Claude Opus review agent — then synthesize both into one deduplicated, prioritized findings list (P0–P3) with a summary and a ship/hold recommendation, and offer to file the surviving findings into the project issue tracker (`itr`). Trigger when the user types /crossfire-review, or asks for a \"crossfire review\", \"dual review\", \"two adversarial reviews\", \"codex and opus review\", \"second-opinion review from two models\", \"cross-model review\", or \"have Codex and Claude both review this\". Do NOT trigger for a single-source review of the diff (use /code-review), for running only the Codex reviewer (the user runs /codex:review themselves), for red-teaming one claim or design agent-vs-agent (use /shadow-duel), for a whole-repo tech-debt audit (use /code-audit), or for a security-focused pass (use /security-review)."
---

# /crossfire-review — two reviewers, one verdict

Two independent adversarial reviews of the **same diff**, from two different models with two different blind spots: the **Codex native reviewer** (OpenAI's reviewer, run through the codex plugin's companion runtime) and a **Claude Opus review agent** briefed to attack the change. Neither sees the other's findings. The orchestrator then synthesizes: dedupe, cross-corroborate, prioritize, and hand the user one list, one summary, one recommendation — plus an offer to file the findings as tracker issues.

The value is the disagreement surface: what both flag is almost certainly real; what only one flags gets weighed on its evidence, not its source.

## Slash invocation

```
/crossfire-review [--base <ref>] [--scope auto|working-tree|branch] [--focus "text"] [--file]
```

| Arg | Default | Meaning |
|---|---|---|
| `--base <ref>` | none | Review `<ref>...HEAD` instead of the working tree. |
| `--scope` | `auto` | `auto` picks working-tree if dirty, else branch-vs-default-base. Both lanes get the **same** scope. |
| `--focus "text"` | none | Extra focus prompt appended to **both** reviewers (e.g. "concurrency", "error handling"). |
| `--file` | off | Skip the filing gate — file P0/P1 findings into `itr` without asking. P2/P3 still gated. |

## Roles & artifacts

- **You (user)** — pick the scope if it's ambiguous; rule on the filing gate at the end.
- **Orchestrator** — resolves scope, fires both lanes in parallel, synthesizes, prioritizes, recommends, files.
- **Lane A: Codex reviewer** — the plugin's native reviewer, run headless via its companion script. Findings consumed as data.
- **Lane B: Opus review agent** — one `general-purpose` subagent, `model: opus`, adversarial brief over the same scope.
- **Artifacts** — the findings report in-conversation; optionally `itr` issues in the target project. Nothing written to disk otherwise.

Requires: git repo with something to review; the codex plugin installed and authenticated (`/codex:setup` fixes it); `itr` on PATH only if filing.

---

## Phase 0 — Scope & preflight

**Announce: Phase 0 — Scope.**

1. Resolve the review target exactly once, and use it for **both** lanes:
   - `--base <ref>` → branch scope `<ref>...HEAD`.
   - Otherwise `git status --short --untracked-files=all` + `git diff --shortstat` / `--shortstat --cached`: dirty tree → working-tree scope; clean tree → branch scope against the default base. Untracked files count as reviewable.
   - Genuinely nothing to review → say so and stop.
2. Locate the codex companion runtime (newest installed version):
   ```bash
   COMPANION=$(ls -d ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs 2>/dev/null | sort -V | tail -1)
   ```
   Missing or `node` unavailable → tell the user (`/codex:setup` is the fix) and ask: proceed **Opus-only** (degraded — say so in the final report) or abort.
3. State the resolved scope in one line ("crossfire on `main...HEAD`, 14 files") and proceed — no gate here.

## Phase 1 — Fire both lanes (parallel, independent)

**Announce: Phase 1 — Crossfire.** Launch both in the same turn; neither lane ever sees the other's output.

**Lane A — Codex** (Bash, `run_in_background: true`):

```bash
node "$COMPANION" review --wait [--base <ref>] [--scope <scope>]
```

`--wait` keeps the script synchronous inside the background task so its stdout carries the full result. This lane is review-only: never let it (or yourself) fix anything mid-review.

**Lane B — Opus** (Agent tool: `subagent_type: general-purpose`, `model: opus`, `run_in_background: true`):

```
You are an adversarial code reviewer. Review this change as if you must find what
is wrong with it before it merges — correctness first, then security, then
performance, then maintainability. Do NOT fix anything; do NOT praise; report.

Scope: {exact same scope — e.g. `git diff <base>...HEAD`, or the dirty working
tree incl. untracked files}. Gather the diff yourself with git, and read enough
surrounding source to judge each finding in context.
{--focus: "Pay particular attention to: {focus}."}

For every finding return EXACTLY:
- file:line —
- severity: blocker | major | minor | nit
- summary: one sentence stating the defect
- evidence: the concrete failure scenario (inputs/state → wrong behavior)
- fix: one-line suggested direction

Only report findings you can defend with evidence from the code — no vague
misgivings, no style-guide sermons. If the change is genuinely clean, say
"no findings" plainly. Your final message IS the findings list — data, not chat.
```

Wait for both. One lane fails or times out → retry it once; still dead → continue single-lane and mark the report **degraded** with which lane is missing.

## Phase 2 — Synthesize & prioritize

**Announce: Phase 2 — Synthesis.** Orchestrator work — no new agents:

1. **Normalize** both outputs into one schema: `file:line · severity · summary · evidence · source`.
2. **Dedupe** on root cause (same defect reported at different lines is one finding). Merged findings get `source: both` — that's corroboration, the strongest signal in the room.
3. **Judge the singletons.** A finding only one reviewer raised is weighed on its evidence: check the cited code yourself before keeping it. Discard anything vague, wrong about the code, or outside the diff's blast radius — and say how many were discarded and why in one line.
4. **Prioritize** every survivor:
   - **P0** — merge-blocker: correctness or security defect with a concrete failure scenario.
   - **P1** — should fix before ship: real defect, bounded blast radius.
   - **P2** — follow-up: real but deferrable (perf, robustness, missing test).
   - **P3** — nit: take-it-or-leave-it polish.
   - Corroboration bumps confidence, not priority — a `both`-sourced nit is still a nit.

## Phase 3 — Report

**Announce: Phase 3 — Verdict.** Deliver in-conversation:

1. **Summary** — 2–4 sentences: overall state of the change, where the two reviewers agreed, where they diverged and who was right.
2. **Prioritized findings** — one table, P0 first: `P · file:line · finding · source (codex/opus/both) · suggested fix`.
3. **Recommendation** — exactly one of:
   - **Ship** — no P0/P1 survived.
   - **Ship after fixes** — P0/P1s exist and are small; list precisely which must land first.
   - **Hold** — a P0 undermines the approach itself; say what a sound version needs.
4. Degraded run (one lane missing) → flag it here; a one-lane crossfire is just a review.

## Phase 4 — File the findings

**Announce: Phase 4 — Filing.** If any findings survived, `AskUserQuestion` (once):

- **File P0+P1** (Recommended) — the actionable core into `itr`.
- **File everything** — P0–P3.
- **Don't file** — report stands as the record.

(`--file` set → file P0/P1 without asking; still gate P2/P3.)

Each issue: title = the finding summary; body = file:line, evidence, suggested fix, priority, and source attribution (`crossfire-review: codex+opus`, or the single lane). Match the project's story conventions if `STORY_STYLE.md` exists. Report the created issue IDs, then stop — this skill reviews and files; it never fixes.

---

## Principles

- **Independence is the product.** The lanes run blind to each other; synthesis is the only place they meet. Leak one's findings into the other's prompt and you've bought one review twice.
- **Same scope, both lanes.** Reviewers looking at different diffs can't corroborate anything.
- **Corroboration ranks evidence, not severity.** `both` means "almost certainly real", not "automatically P0".
- **The orchestrator verifies before it ranks.** Every surviving singleton was checked against the actual code — the report contains no finding you couldn't defend yourself.
- **Review-only.** No lane, and not the orchestrator, edits code. The outputs are the report and (opted-in) tracker issues.

## Don't

- Don't run the lanes serially when both are available — fire them in the same turn.
- Don't paraphrase away a reviewer's concrete evidence during normalization; the failure scenario is the finding.
- Don't present both raw reviews side-by-side as the deliverable — synthesis is the job.
- Don't inflate priorities to look thorough, or drop a lone-source P0 just because the other lane missed it.
- Don't file issues without the gate (except P0/P1 under `--file`), and don't fix anything, commit, or push.
- Don't proceed silently in degraded mode — a missing lane changes what the verdict is worth.
