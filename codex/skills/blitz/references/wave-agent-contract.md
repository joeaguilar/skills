# Worker contract

Give each worker its original requirements, repository, owned paths, forbidden
paths (including user edits and neighbors), relevant API contracts, targeted
verification command, and expected evidence.

- Check paths and symbols before editing; report ambiguous targets.
- Report additional required write paths before using them so the coordinator
  can resolve ownership. Preserve other workers' and the user's changes.
- Never stage, commit, switch branches, or perform broad cleanup.
- Scope formatters and generators to owned outputs. If their write boundary is
  uncertain, report it rather than running them during concurrent work.
- Run assigned targeted checks and wait for results. Report outside-scope
  failures without repairing neighbors. The coordinator runs the full gate
  after writers finish.
- For changed behavior, exercise the real entry/read/restore paths relevant to
  acceptance. Capture UI evidence where needed; backend work needs no screenshot.
- Return changed files, implemented acceptance, commands and results, limitations,
  and required human verdicts. Do not close tracker items independently.
- Report out-of-scope findings without expanding the task or filing unrelated
  issues unless the run authorizes it.

Use a task-specific prompt rather than a large generic ceremony. Inherit the
session model unless the user or project requires another. Do not create nested
orchestration layers.
