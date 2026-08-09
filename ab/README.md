# ab/ — A/B gate for skill edits (/scrum whetstone)

Every edit-set to `claude/skills/scrum/SKILL.md` must pass through this gate before it
ships. Nothing is judged by the editor; nothing is discarded — every arm's full outcome
stays on disk, user-judgeable.

## Protocol

1. **Fixed benchmark** — `brief.md` (SKY HOP, small playable browser game; same failure
   domain as the street-yeet postmortem, small enough to ship inside the cap).
2. **Arm** — `./run-arm.sh <label> <candidate-SKILL.md> [wall-s] [model]` pins the
   candidate as the installed `/scrum`, runs `claude -p "/scrum <brief>"` headless
   (default `claude-sonnet-5`, 30 min wall cap, `--max-turns 300`) in a fresh sandbox
   repo. Arms run serially; identical brief, model, cap.
3. **Metrics** — `./metrics.sh <label>`: code LOC vs process-doc LOC, feat vs docs/chore
   commits, build status, turns, tokens, wall.
4. **Blind cross-family gate** — `./judge.sh <candidate-arm> <incumbent-arm>`:
   anonymizes the two sandboxes to ARM_X/ARM_Y (coin flip), `codex exec -m gpt-5.6-terra`
   (read-only) inspects both and returns
   `verdict ∈ better|worse|similar|unchanged` + `meaningful` bool + evidence;
   the script un-blinds to candidate-vs-incumbent.
5. **Keep rule** — better → candidate becomes the incumbent best. worse → revert the
   edit-set. similar/unchanged → revert, unless the edit is a pure deletion (same
   output, cheaper skill → keep, logged). **Stop rule** — candidate vs the ORIGINAL
   baseline rules `better` AND `meaningful: true`.

## Where outcomes live (nothing is thrown away)

- `~/AI_Projects/ab-scrum/runs/<arm>/` — `app/` (the sandbox repo as the run left it),
  `SKILL.used.md` (exact skill text), `stream.jsonl` (full session log), `run.json`,
  `metrics.md`, `screenshot.png` when captured. Re-running a label archives the old run
  to `runs/_archive/` — never deletes.
- `~/AI_Projects/ab-scrum/judge/<cand>-vs-<inc>/` — blinded workspace, `mapping.json`,
  raw judge output, `verdict.json`. Same archive-not-delete rule.
- Ledger: `sprint/scrum-whetstone-2026-07-26/plan.md` (one row per arm).

Run dirs live outside this repo so sandbox agents can't walk up into the skills repo's
`.itr.db` or git history.
