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
- **Rust + `draft-first publish: NO`** → `release.yml` publishes the release
  before the build matrix has uploaded anything, so `/releases/latest` points at
  an assetless release for the length of the build. See
  [Draft-first publishing](#draft-first-publishing) — it's a small, surgical
  edit; prefer patching the existing `release.yml` over `--force`, which would
  discard any local customization (smoke-test step, extra targets).
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

## Draft-first publishing

Any archetype that ships **binaries** must create the GitHub Release as a
**draft** and publish it only after every build target has uploaded. This is
part of the standard install, not an optimization — install scripts resolve the
version by following the `/releases/latest` redirect, so a release that is
public before its assets exist is a release that hands users a 404.

Measured on `itr` v3.1.0 (7-target matrix): the release went public at
`19:09:43Z`, the first asset landed at `+97s`, the last at `+178s`. For those
~3 minutes `curl … | bash` resolved the new tag and then failed every download.
The source-build fallback doesn't save it — that path needs a cloned repo with a
manifest, which a curl-pipe user doesn't have, so the install fails outright
instead of quietly serving the previous version.

Three edits to `release.yml`, all in the Rust template already:

1. `create-release` gains `draft: true` and exposes the tag as a job output:
   ```yaml
   outputs:
     tag: ${{ steps.tag.outputs.name }}
   ```
2. The matrix upload step **must also pass `draft: true`**. This is the step
   people get wrong. `softprops/action-gh-release` documents that it carries the
   existing release's draft flag forward on update — it does not. Observed on
   itr v3.1.1: the first matrix target to finish published the draft (the
   release's `published_at` was identical to the first asset's upload time),
   putting a 2-of-14-asset release at `/releases/latest` for 2.5 minutes. Never
   rely on flag carry-forward; state it.
3. A final `publish` job, `needs: [create-release, build]`, which verifies the
   asset count **before** publishing and fails the workflow if artifacts are
   missing (`EXPECTED_ASSETS` = targets × 2 for archive + `.sha256`), then:
   ```yaml
   - env:
       GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
       TAG: ${{ needs.create-release.outputs.tag }}
     run: gh release edit "$TAG" --draft=false --latest --repo "$GITHUB_REPOSITORY"
   ```
   `gh release edit` touches only the draft flag, so the generated release notes
   survive. `--latest` sets the redirect target explicitly rather than relying on
   date ordering.

Two properties worth stating to the user when you install this:

- **A failed target leaves an unpublished draft.** `needs: build` means one
  broken platform blocks publication, so `/releases/latest` keeps pointing at the
  last *complete* release instead of a half-populated new one. Recovery is a
  `workflow_dispatch` re-run of `release.yml` for that tag.
- **Drafts are invisible to anonymous users but the tag is not.** `git describe`
  and `ITR_VERSION`-style pins see the tag immediately; only the *latest*
  redirect waits. Pinning a brand-new version during the build window still
  404s — that's correct, and it's why the pin path should stay a hard error
  rather than silently falling back.

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
4. **Draft-first is wired** — if the repo publishes binaries, re-run
   `--check` and confirm `draft-first publish: yes`. The workflow YAML should
   parse into exactly three jobs with `create-release → build → publish`:
   ```bash
   python3 -c "import yaml;d=yaml.safe_load(open('.github/workflows/release.yml'));print({k:v.get('needs') for k,v in d['jobs'].items()})"
   ```

After the first real release lands, check that the redirect and the assets
agree. **Assert against the specific tag, not the `latest` alias** — the alias
is cached and lags, which is exactly how a broken run can look green:

```bash
# During the build: the new tag's release must be invisible (404 = still a
# draft), while /releases/latest still resolves to the previous version.
curl -o /dev/null -w 'tag endpoint: %{http_code}\n' \
  https://api.github.com/repos/<owner>/<repo>/releases/tags/<new-tag>
curl -fsSLI -o /dev/null -w 'latest -> %{url_effective}\n' \
  https://github.com/<owner>/<repo>/releases/latest

# After it finishes: published, complete, and the redirect target.
curl -fsSL https://api.github.com/repos/<owner>/<repo>/releases/tags/<new-tag> \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('draft:',d['draft'],'assets:',len(d['assets']),'published:',d['published_at'])"
```

The single most diagnostic field is **`published_at` vs the newest asset's
`created_at`**. `published_at` must come *after* the last asset. If it matches
the *first* asset's timestamp, an upload step published the draft — check that
every upload step passes `draft: true`.

A `latest` release with fewer assets than targets×2 means draft-first isn't
working, whatever the workflow run's green checkmark says.

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
