---
name: auto-versioning
description: "Use to configure or repair CI-driven version bumps, release tags, and changelog synchronization. Adapt to the project's manifests and release policy; do not cut a live release merely to test the configuration."
---

# Auto Versioning

Inspect existing workflows, release branches, tags, manifests/lockfiles, and
repository contribution rules. Prefer repairing the established release tool
over installing a competing one. Determine whether the task is version planning,
workflow generation, or an explicitly requested release.

Read [CI integration](references/ci-integration.md) when creating or changing a
release workflow. It covers concurrency, manifest synchronization, token-trigger
behavior, and publication order. Preserve custom build targets and branch rules.

For simple stable `vX.Y.Z` projects, the bundled read-only helper computes a
Conventional Commits proposal without touching files, tags, or remotes:

```text
python <skill-dir>/scripts/plan_version.py --repo <project>
python <skill-dir>/scripts/plan_version.py --repo <project> --base v1.2.3
```

It considers stable version tags reachable from HEAD, then breaking changes,
features, and fixes/performance fixes since the selected base. With no stable tag
it uses `0.0.0`, overridable with `--initial-version`. Prerelease, workspace,
independent-package, and nonstandard tag policies need the project's tooling;
do not present the helper as a universal release manager.

Generate the workflow and any required manifest-update code for the detected
project. Match its version source and lockfile semantics; do not overwrite an
existing build script or regex-replace the first `version` in an arbitrary TOML
file. Use established tooling or a structured parser. Preserve manual changelog
sections, and ensure the tagged commit actually contains the intended version.

Validate in disposable local repositories: no relevant changes, fix, feature,
breaking footer, rerun/idempotence, existing tags, and manifest/lockfile alignment.
Check generated YAML and shell/script syntax. A local test must not push a real
tag, dispatch a live workflow, or publish assets. State what remains untested
without CI access. Finish with the concrete files and the activation/release
behavior; respect existing authorization for any later external action.
