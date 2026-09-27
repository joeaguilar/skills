# CI integration

Choose the release branch and version source from repository evidence. A protected
branch may require a release PR rather than a bot push. Keep that policy intact.

Use full history/tags for version calculation and serialize release writers with
a branch/package concurrency group. Do not cancel a publishing job midway. Recheck
the intended remote head before committing/tagging, and fail on a conflicting tag
instead of force-moving it. Prefer an atomic branch/tag push when supported; make
reruns verify existing state rather than silently creating another version.

Give the publishing job only the permissions it needs. Read-only planning needs
no write token. Keep untrusted event text out of interpolated shell code; use
structured arguments or environment values. Follow the project's action pinning
policy and verify current action versions before adding them.

Events caused by `GITHUB_TOKEN` generally do not launch additional workflows;
`workflow_dispatch` and `repository_dispatch` are exceptions; some bot-created or
updated pull-request events also create runs that require approval. Do not assume
a bot-pushed tag triggers a separate release job. Use a documented explicit dispatch
or keep dependent jobs in the same workflow. See [GitHub's trigger documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
and [token permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)
when implementing the exact flow.

For manifests, distinguish a single Rust package from workspace inheritance,
Node package versions from workspace/lockfile versions, and static Python versions
from dynamic version providers. Use the ecosystem's existing release tool when
possible. Do not assume every Rust package has a committed Cargo.lock, every Node
project uses npm, or every Python project owns a literal version in pyproject.toml.

Build and verify assets before exposing a release as ready. For a matrix upload,
assemble a draft release and publish after all required assets succeed. Keep
failed drafts distinguishable from completed releases; a partial asset set must
not become the advertised latest release. Do not add cross-platform matrices,
runtime version-display code, or a changelog format unless the user needs them.

Before activation, inspect the generated diff for the actual trigger, branch,
permissions, version source, tag target, and rerun behavior. Existing authorization
to set up the workflow covers reversible local file edits; a test run should use
a scratch repository or read-only plan. Request a separate external action only
when it falls outside the task's already-established authorization.
