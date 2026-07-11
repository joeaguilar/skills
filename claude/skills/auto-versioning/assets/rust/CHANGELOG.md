# Changelog

All notable user-facing changes are recorded here.

## Versioning

- Release tags use `vMAJOR.MINOR.PATCH`.
- Pushes to `main` are auto-tagged by `.github/workflows/auto-version.yml`:
  a `type!:` / `BREAKING CHANGE:` commit → major bump, `feat:` → minor,
  `fix:` → patch. Commits without those subjects do not create a tag.
- Add `[skip version]` to a commit message to skip auto-tagging.
- `.github/workflows/release.yml` builds release archives and SHA256 files
  from `v*` tags; GitHub release notes are generated automatically. This file
  is the terse, hand-maintained history.
- Built binaries embed `git describe --tags --always --dirty` through
  `build.rs`, falling back to the Cargo package version when git metadata is
  unavailable.
- `Cargo.toml` `package.version` tracks the latest `v*` tag: `auto-version.yml`
  commits a manifest sync (marked `[skip version]`) before creating each tag,
  so the tagged tree carries a matching version. Git tags remain the source of
  truth.

## Entry Format

- Keep newest sections first.
- Use `### Release notes` for user-visible behavior, commands, docs, and fixes.
- Use `### Upgrade notes` for compatibility, install, and migration actions.
- Group bullets as `Added`, `Changed`, `Fixed`, `Docs`, or `CI` when a release
  has more than one kind of change.

## Unreleased

### Release notes

-
