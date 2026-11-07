# Global Codex rules

Always-on rules for every Codex session on this machine. The canonical copy is
`codex/global-AGENTS.md` in the skills repo, deliberately not named `AGENTS.md` so it is
never read as that folder's project guidance. `./install.sh codex --primitive config
--apply` links it to `~/.codex/AGENTS.md`. Edit the repo copy, never the linked one.

- **Gates through gatr:** when `gatr` is on PATH, run every build, test and lint gate as
  `gatr run --tag <name> -- <cmd>` and read the result with `gatr last` / `gatr errors`,
  not by piping the output through `Select-Object -Last`, `tail` or `rg`. The full log
  stays on disk, so the result survives a lost context (the `gatr` skill has the details).
- **kgr before rg:** when `kgr` is on PATH, answer structural code questions (where X is
  defined or used, whether it is dead, what depends on a file, a tour of the repo) with
  kgr first; `rg` is for strings, comments and languages kgr does not parse (the `kgr`
  skill has the details).
- **Read big files in ranges:** for a source file longer than a few hundred lines, read
  only the part you need (`Get-Content -TotalCount N`,
  `Get-Content <file> | Select-Object -Skip N -First M`, or `kgr skeleton` / `kgr show`
  for its outline or one definition), and never dump a whole source file with
  `Get-Content -Raw` or `cat`. A whole-file dump stays in context for the rest of the
  session.
