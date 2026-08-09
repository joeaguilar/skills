# Auto-versioning north star & archetypes

This is the canonical design the skill installs, reverse-engineered from the
`itr`, `ccq`, `gatr`, and `kgr` repos. `itr` is the most-evolved reference.

## The flow (all archetypes)

On every push to `main`, a GitHub Actions workflow (`auto-version.yml`):

1. Finds the latest `v*` tag (baseline `v0.0.0` if none).
2. Reads every commit since that tag — **subject and body** (the body is where
   `BREAKING CHANGE:` footers live).
3. Derives the SemVer bump, highest wins:
   - `type!:` in the subject, or a `BREAKING CHANGE:` footer → **major**
   - `feat:` → **minor**
   - `fix:` → **patch**
   - none of the above → **no release** (exits cleanly, no tag)
4. Bumps the ecosystem manifest to the new version (see archetypes), commits it
   with `[skip version]`, and pushes to `main`.
5. Creates and pushes the `vX.Y.Z` tag pointing at that sync commit.

`[skip version]` in a commit message opts a push out entirely. The sync commit
carries it so it can't recurse — and `GITHUB_TOKEN` pushes don't trigger
workflows anyway (defense in depth).

### Why sync the manifest *before* tagging

So the tagged tree carries a matching version. Otherwise the manifest (and
anything that reads it — `cargo install --list`, `npm view`, a build-time
fallback) drifts behind the tags. Git tags stay the source of truth; the
manifest is a mirror kept honest by the sync commit.

## Archetypes

### Rust crate (the full itr treatment) — `assets/rust/`

- `auto-version.yml` — bump logic **plus** a Cargo manifest-sync block
  (`sed` on `Cargo.toml`, `awk` on `Cargo.lock`) and a step that dispatches
  `release.yml` via `gh workflow run` (a `GITHUB_TOKEN` push can't trigger the
  tag-push workflow directly, so it's dispatched explicitly).
- `release.yml` — on tag push (or manual dispatch), creates a **draft** GitHub
  Release with `generate_release_notes: true`, then a 7-target build matrix
  (linux gnu/musl, macos x86/arm, windows x86/arm) uploads `.tar.gz`/`.zip`
  archives + `.sha256` into that draft, and a final `publish` job flips it to
  published + latest. Release is created **once up front** so matrix jobs
  don't race to create it, and created **as a draft** so it isn't discoverable
  until it's complete (see below).
- `build.rs` + `src/version_shape.rs` — embed `git describe --tags` into the
  binary as `<BIN>_VERSION`, shaped to stay semver-looking on tagless checkouts.
  `version_shape.rs` is `include!`d (not a module) so the same code is unit-
  tested. **Read `env!("<BIN>_VERSION")` in your binary** or the env var is inert.
- `CHANGELOG.md` — hand-maintained, newest-first, with a `## Versioning`
  preamble. itr deliberately does **not** auto-generate this.

#### Why the release starts as a draft

The install scripts (`install.sh`, `install.ps1`) resolve "latest" by following
the `github.com/<owner>/<repo>/releases/latest` redirect — deliberately, since
it needs no API token and no rate limit. That makes release *visibility* the
contract, not just the tag.

Publishing the release before the matrix uploads breaks that contract for the
length of the build. Measured on itr v3.1.0: release public at `19:09:43Z`,
first asset `+97s`, last asset `+178s`. In that window the redirect resolved to
a release whose every asset 404'd, and `install.sh`'s source fallback needs a
cloned repo — so a `curl … | bash` user got no install at all.

GitHub excludes drafts from `/releases/latest`. Creating the release as a draft
means the redirect keeps serving the previous *complete* release until the new
one is whole, which downgrades a hard failure into "you got the previous
version for three minutes". The publish job (`needs: [create-release, build]`)
also turns any single failed target into "stays a draft" rather than "latest is
missing three platforms".

Draft-first has one sharp edge, learned the hard way on itr v3.1.1. The upload
step must pass `draft: true` **explicitly**. `softprops/action-gh-release`
claims to preserve the existing draft flag on update; it doesn't, and the first
matrix target to finish published a 2-of-14-asset release as `latest`. The
first attempt at this fix therefore reproduced the very bug it was meant to
remove — with a *shorter* window, which is worse, because it looks like it
worked. Hence two independent safeguards: the explicit flag on every upload,
and an asset-count gate in the publish job that refuses to publish an
incomplete release. Neither is redundant; the count gate is what turns "an
upload step misbehaved" into a red workflow rather than a silent partial
release.

This is why the tag and the release are allowed to disagree briefly: the tag
exists the moment `auto-version.yml` pushes it (so `git describe` and version
pins see it), while the *latest redirect* deliberately lags until assets exist.
Version pins pointed at a brand-new tag still 404 during that window, and
should stay a hard error — silently serving an older version than the one the
user explicitly pinned is worse than failing.

### `ccq` / `gatr` / `kgr` — the tag-only variant

Byte-identical to itr's workflow **except** they omit the manifest-sync block
(they pin `Cargo.toml` and rely on `build.rs`/`git describe` at runtime). The
skill flags this as "upgrade available" and can bring them to itr parity by
adding the sync block (rerun apply with `--force`).

### Node package — `assets/node/`

- `auto-version.yml` — same bump logic; the sync step uses `jq` to set
  `.version` in `package.json` and, when present, the root + `.packages[""]`
  version in `package-lock.json`. `npm version` is avoided on purpose (it wants
  a clean tree, makes its own commit/tag, and needs node set up — a plain `jq`
  edit is toolchain-free). Includes changelog generation (below).
- No `release.yml` by default — npm/GitHub publishing is a separate concern.

### Generic (no manifest) — `assets/generic/`

- `auto-version.yml` — bump logic + changelog generation, no manifest sync.
  This is the right choice for shell/docs/mixed repos (e.g. a git-hooks repo).

## Auto-generated changelog (node + generic)

The node and generic workflows extend the north star: they bucket the same
commits into **Breaking / Added / Fixed / Changed / Docs**, render a dated
`## vX.Y.Z` section, and splice it into `CHANGELOG.md` directly under a
`<!-- BEGIN AUTO -->` marker (newest-first), committing it in the same
`[skip version]` sync commit. If `CHANGELOG.md` has no marker, generation is
skipped silently — so the workflow is safe to add before the seed file exists.
`chore/style/test/build/ci` commits never appear in the changelog and never
trigger a release.

## Adapting to other ecosystems (Python, Go, etc.)

The only archetype-specific part is the manifest-sync step. To support, say,
Python, copy `assets/generic/auto-version.yml` and insert a sync for
`pyproject.toml` before the commit step, e.g.:

```bash
sed -i -E "0,/^version = \".*\"\$/s//version = \"${NEW_VERSION}\"/" pyproject.toml
git add pyproject.toml
```

Go modules carry no version field (the tag *is* the version), so Go is a pure
generic install — no sync needed.
