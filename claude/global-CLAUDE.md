<!-- Managed by skills/claude/global-CLAUDE.md via `./install.sh claude --primitive config`. Edit the source, not this copy. -->

- **Model routing (at spawn time):** whenever you launch a subagent, a Workflow
  agent, or `codex exec`, choose the model by **role** (bulk / generalist /
  ambiguous / taste / taste-hero / computer-use / reviewer) from `~/.claude/MODELS.md`,
  never by name. If the class isn't obvious, score the ticket with `~/.claude/COMPLEXITY.md`.
  Open those files only at that moment; do not read them up front.
- **Reviewer ≠ writer:** any review, critique, or judge seat runs on a different
  model than the one that wrote the work (the `reviewer` role in `~/.claude/MODELS.md`).
- **Commits:** commit each completed unit of work unless told not to. In synced
  repos run `git fetch` first; the remote may have been rewritten from another
  machine. Do not add `Co-Authored-By` or session-attribution trailers — Codex
  seats often write the code, so the attribution would be wrong.
- **Trust stated verification:** when the user says something already works, do
  not rerun the expensive step. If a check is inconclusive, write a different
  check instead of rerunning or reinterpreting the old one.
- **Typos:** when the user's prompt has a typo (not quoted, called out, or a real
  name), open the reply with one short line saying what you saw and what you read
  it as, every correction on that line, then answer normally. Missing apostrophes
  in contractions (dont, cant, didnt) are not typos.
- **Close with actions:** end substantive replies with open questions and pending
  decisions as their own short list, separate from the analysis.
