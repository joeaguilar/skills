# Scroll — whetstone /scrum (epic itr#14)

Pact: /ninja-meiyaku carrying a /whetstone grind. Blade: `claude/skills/scrum/SKILL.md`
(copy of the chain-based /mission that failed on street-yeet — see
`docs/postmortem-mission-street-yeet.md`). Goal: grind until a blind gate rules the
outcome MEANINGFULLY better. Every edit-set is A/B'd; no unmeasured edit ships.

## Protocol (the gate)

- Harness: `ab/` (scripts in-repo; heavyweight run dirs at `~/AI_Projects/ab-scrum/runs/`).
- One fixed benchmark brief (`ab/brief.md`): small playable browser game — same failure
  domain as street-yeet, small enough to ship inside the cap.
- Arm = pin candidate SKILL.md as installed /scrum → `claude -p "/scrum <brief>"`,
  model `claude-sonnet-5`, wall cap 30 min, fresh sandbox repo, stream-json log kept.
- Metrics: product LOC vs process-doc LOC · feat vs docs commits · build green ·
  playable screenshot · tokens · turns · wall.
- Judge: blind, cross-family (`codex exec`, gpt-5.6-terra), arms anonymized X/Y,
  verdict ∈ better | worse | similar | unchanged + `meaningful` bool + evidence.
- Keep rule: better → candidate becomes best. worse → revert. similar/unchanged →
  revert unless the edit is a pure deletion (cheaper at equal output = keep, logged).
- Stop rule: gate rules candidate vs ORIGINAL baseline better AND meaningful.

## Targets

- #15 harness · #16 identity + baseline arm · #17 grind passes (edit-sets from the
  postmortem constraints: continuous visibility, priced rigor, ceremony caps/severity
  floor, delegated bookkeeping, intake scale gate).

## Ledger (append per arm)

| arm | candidate | verdict vs best | meaningful | kept? | notes |
|---|---|---|---|---|---|
| bare-control | (none — skill text ignored headless) | n/a | n/a | n/a | accidental bare-prompt control: playable game, 805s, 502 code LOC, 0 doc LOC, build green. Mirrors the postmortem's bare-prompt comparator. Prompt wrapper fixed to force Skill invocation. |
| base | p0-baseline.md (old chain-mission) | incumbent | — | — | skill genuinely invoked; playable, 833s, 501 code / 120 ceremony LOC, no sound (debrief says cut), 1 feat + 2 chore commits. |
| p1 | p1-product-first.md (scale gate · live landing · severity floor · ceremony diet) | **better** vs base | **true** | pending replication | 608s, 490 code / 0 ceremony LOC, audio + particles, build green. Blind verdict: `ab/candidates/verdict-p1-vs-base-r1.json`. |
| p1-r2 | same candidate, replication | worse vs base-r2 | **false** ("comparable playable games") | — | 1277s/384 code/0 doc vs 774s/381 code/155 doc. Verdict: `ab/candidates/verdict-p1-vs-base-r2.json`. Net r1+r2: no consistent meaningful edge — the v1 toy brief under-triggers the pathology (no councils/dormancy fired; sonnet shortcuts ceremony at this scale). |

Instrument sharpened: `ab/brief-v2.md` — 5 features with real dependency structure
(core → juice → sound → meta → daily-challenge) + "EVERY feature reachable from the UI,
nothing behind a flag" DoD. Designed to make the old skill's dormancy/premise ceremony
actually fire inside the cap. Pair base-v2 / p1-v2 running.

Mid-run notes:
- Canonical `claude/skills/scrum/SKILL.md` was reverted to the old mission text by the
  user/Codex side mid-session — shared arena. Candidates now live in `ab/candidates/`
  (p0-baseline.md, p1-product-first.md); the canonical file is left alone until the
  winning candidate is declared at the whisper.
- Headless invocation gotcha (measured): `claude -p "/scrum <brief>"` does NOT execute
  the skill; prompt must explicitly demand Skill-tool invocation. run-arm.sh does now.
