---
name: auto-versioning
description: >-
  Use when someone wants versioning, release tags, or a changelog handled
  automatically by CI instead of by hand. Typical asks: automatic SemVer tags on
  every push or merge to main, deriving the next version and git tag from
  Conventional Commits, semantic-release-style releases without the Node
  toolchain, having GitHub pick the semver bump, a self-regenerating CHANGELOG
  from commit history, or copying the versioning another project (e.g. itr, kgr)
  already uses. Installs a GitHub Actions workflow that reads Conventional
  Commits since the last tag, bumps the language manifest (Cargo.toml,
  package.json, pyproject, etc.), and pushes a vX.Y.Z tag — optionally with
  cross-platform release builds and an auto-generated changelog; works for Rust,
  Node, Python, Go, or generic repos, including brand-new ones just after git
  init. Also proactively OFFER it when a repo has no auto-version workflow, or has
  one that pushes tags but never bumps the manifest. Not for writing a single
  commit message, explaining what SemVer means, cutting one manual tag, or
  reverting a bot's version-bump commit.
---

# Auto-versioning

Install the `itr` family's automatic versioning into any repo: push to `main`
→ Conventional Commits decide the SemVer bump → the manifest is bumped and a
`vX.Y.Z` tag is pushed. Read `references/north-star.md` for the full design and
rationale; this file is the workflow for applying it.

## When to offer it

This skill is most useful *unprompted*. When you're working in a git repo and
notice it lacks auto-versioning — or has a partial setup — surface it. The
detector makes this a one-liner; run it early when versioning/releases come up.

## Step 1 — Detect current state

Run the bundled detector against the target repo. It changes nothing:

```bash
scripts/apply-auto-versioning.sh --check --repo <path>
```

It prints the **archetype** (rust / node / generic), the binary/crate name, and
which pieces already exist. Read the output before proposing anything:

- **`auto-version.yml: MISSING`** → offer a fresh install.
- **Rust + `manifest sync … NO — upgrade available`** → the workflow pushes
  tags but doesn't keep `Cargo.toml`/`Cargo.lock` in step, so the manifest drifts
  behind the tags. Offer to add the sync (rerun apply with `--force`).
- **Everything present + parity `yes`** → already fully wired; nothing to do.

## Step 2 — Confirm the plan, then apply

Tell the user what will be written and let them confirm — this adds CI that
pushes tags and commits to `main`, so it shouldn't be a surprise. Then:

```bash
# Fresh install (archetype auto-detected):
scripts/apply-auto-versioning.sh --repo <path>

# Rust, workflow only (skip release.yml + build.rs):
scripts/apply-auto-versioning.sh --repo <path> --no-release

# Upgrade a tags-only workflow to also sync the manifest:
scripts/apply-auto-versioning.sh --repo <path> --force
```

The script is **non-destructive**: it skips files that already exist unless
`--force` is passed, and reports every `WROTE`/`SKIP`. It substitutes the crate
name into the Rust templates automatically. Useful flags: `--type
rust|node|generic` to override detection, `--bin NAME` to override the crate
name.

### What lands, by archetype

| Archetype | Files written |
| --- | --- |
| **rust** | `auto-version.yml` (with Cargo sync + release dispatch), `release.yml` (7-target matrix), `build.rs`, `src/version_shape.rs`, `CHANGELOG.md` (hand-maintained seed) |
| **node** | `auto-version.yml` (package.json + lockfile sync, changelog gen), `CHANGELOG.md` (auto seed with marker) |
| **generic** | `auto-version.yml` (tag-only, changelog gen), `CHANGELOG.md` (auto seed with marker) |

For ecosystems without a template (Python, Go, …), start from `generic` and
follow the "Adapting to other ecosystems" section of `references/north-star.md`.

## Step 3 — Verify before calling it done

The workflow only runs once the repo is on GitHub with Actions enabled, so you
can't observe a real tag locally. Instead confirm the mechanics:

1. **Templates are valid & fully substituted** — no leftover `__BIN__` /
   `__ENVPREFIX__`, and the YAML parses. The apply step already reports what it
   wrote; a quick `grep -c __BIN__ .github/workflows/*.yml` should be `0`.
2. **Rust binary read site** — if `build.rs` was installed, the binary must read
   `env!("<BIN>_VERSION")` for the tag to reach `--version`; otherwise it's inert.
   Point this out; wire it only if the user wants it.
3. **First release expectation** — set expectations: no tags yet → baseline
   `v0.0.0`; the next `feat:`/`fix:` push to `main` cuts the first tag. Commits
   that are only `chore/docs/style/test/build/ci` won't trigger a release.

Then stage the new files and commit with a conventional message (e.g.
`ci: add auto-version workflow`) so the change itself follows the convention the
workflow depends on.

## Notes

- **Independent of any local git hook.** A repo may also ship a client-side
  `post-merge` tagging hook (e.g. a git-hooks repo). CI-based auto-versioning is
  separate and more robust — a release never depends on a contributor having a
  hook installed. Mention this if both are present; they don't conflict.
- **Manifest sync commits to `main`.** The workflow needs `contents: write` (and
  `actions: write` for the Rust release dispatch). These are in the templates.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes.
