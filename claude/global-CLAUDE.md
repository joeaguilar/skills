<!-- Managed by skills/claude/global-CLAUDE.md via `./install.sh claude --primitive config`. Edit the source, not this copy. -->

- **Model routing (at spawn time):** whenever you launch a subagent, a Workflow
  agent, or `codex exec`, choose the model by **role** (bulk / generalist /
  ambiguous / taste / taste-hero / computer-use / reviewer) from `~/.claude/MODELS.md`,
  never by name. If the class isn't obvious, score the ticket with `~/.claude/COMPLEXITY.md`.
  Open those files only at that moment; do not read them up front.
- **Reviewer ≠ writer:** any review, critique, or judge seat runs on a different
  model than the one that wrote the work (the `reviewer` role in `~/.claude/MODELS.md`).
- **Adversarial review:** before calling a behavior change done, have a fresh
  agent on the `reviewer` role try to break it against the acceptance criteria;
  your own review agrees with your own reasoning. A finding counts only with a
  failing input or counterexample. The brief, severities and round cap are in
  `~/.claude/ADVERSARIAL-REVIEW-AND-RED-CHECKS.md`; open it at that moment.
- **Tests prove themselves:** a test is evidence only after you have seen it fail,
  on the code without the change or with a changed line deliberately broken and
  restored. A test written by reading the code passes by construction. Run that
  red run as `gatr run --tag red-<name> -- <cmd>`; the how-to is in the same file.
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
- **Gates through gatr:** when `gatr` is on PATH, run every build/test/lint gate as
  `gatr run --tag <name> -- <cmd>` and read results with `gatr last` / `gatr errors`,
  not by piping output through tail or grep (the `gatr` skill has the details).
- **kgr before grep:** when `kgr` is on PATH, answer structural code questions
  (where X is defined or used, whether it is dead, what depends on a file, a tour
  of the repo) with kgr first; grep is for strings, comments and languages kgr
  does not parse (the `kgr` skill has the details).
- **Close with actions:** end substantive replies with open questions and pending
  decisions as their own short list, separate from the analysis.
