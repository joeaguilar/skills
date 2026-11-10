# Optional wave commits and recovery

Read for explicitly requested wave commits or recovery of a recorded wave.

Record the baseline revision and index before dispatch. Require an existing Git
repository and isolate owned changes from pre-existing work. Never stash, reset,
clean, or absorb user edits to manufacture a baseline. Resolve an ambiguous
index or overlapping changes before committing; independent planning can continue.

After the integrated gate and required acceptance pass:

1. Inspect the scoped diff, including owned untracked files and generated outputs.
2. Stage explicit owned paths. Confirm no unrelated edits are staged and run
   `git diff --cached --check`.
3. Follow repository identity, message, attribution, and hook requirements.
4. Create the requested commit, record its SHA and task IDs, and verify HEAD
   advanced with user work intact. Inspect and re-verify after a hook failure
   or modification; never bypass hooks or automatically amend a prior commit.

Prefer an in-scope repair for a later failure. Rejection alone does not authorize
discarding work. If rollback is requested or already authorized, require a clean
worktree and verify the recorded wave is the expected HEAD. Revert only recorded
commits in reverse order using `git revert` and repository commit rules. On
conflicts or unexpected edits, stop rollback and report the state; never use
hard reset or broad clean.

After successful rollback, reopen only items whose implementation was removed,
attaching revert evidence. Keep accepted, failed, and human-pending states
distinct. Re-run the relevant gate before further implementation.
