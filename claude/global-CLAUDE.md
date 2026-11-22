<!-- Managed by skills/claude/global-CLAUDE.md via `./install.sh claude --primitive config`. Edit the source, not this copy. -->

- **Builds:** when I ask for something to be built, build it directly, in one run, and
  come back when it runs. Do not use a planning or orchestration skill for it (spec-writer,
  sprint, blitz, crossfire-blitz, sprint-review, the campaigns, crucible, gauntlet,
  feature-build, forge-change and the like) and do not suggest one, unless I name it. Tool
  skills (gatr, kgr, itr, gitea, impeccable, the language best-practice skills, codex-seat
  for a reviewer) are fine. The program still applies, as part of the same run: set the
  project up properly (git repository, `project.toml`, a `ci` gate), write unit tests, run a
  proof test that drives the real product and keep the evidence (browser automation or
  computer use for a UI; the real command on real data, from PowerShell, for a CLI), and
  get one adversarial review. Ask only product questions, state your default, and keep
  working; do not end the turn on a plan, a gate or a list of decisions. Why: twice a
  process skill turned a build into a day of process with nothing to look at (mission on
  street-yeet, 2026-07; sprint and blitz on status, 2026-11), where a direct build took
  under an hour.
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
  machine. Every commit message is one line, `type(scope): summary`, with no body:
  the scope is required and names the work the commit belongs to (`fix(gitea): …`).
  Do not add `Co-Authored-By` or session-attribution trailers — Codex
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
- **Read big files in ranges:** for a source file longer than a few hundred lines,
  read only the part you need (`Read` with `offset`/`limit`, or `kgr skeleton` /
  `kgr show` for its outline or one definition), and never `cat` a source file. A
  whole-file dump stays in context and is re-read on every later turn.
- **Bash over PowerShell:** on Windows, run commands and scripts in the Bash tool;
  use PowerShell only for what needs it (cmdlets, the registry, Windows-only APIs).
  PowerShell calls fail about three times as often as Bash ones.
- **Close with actions:** end substantive replies with open questions and pending
  decisions as their own short list, separate from the analysis.
