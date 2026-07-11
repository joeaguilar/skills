#!/usr/bin/env bash
#
# apply-auto-versioning.sh — install itr-style auto-versioning into a repo.
#
# Detects the project archetype (Rust crate / Node package / generic) and drops
# in a GitHub Actions workflow that, on every push to main, derives the SemVer
# bump from Conventional Commits, bumps the ecosystem manifest, and pushes a
# vX.Y.Z tag. Idempotent and non-destructive: existing files are left alone
# unless --force is given.
#
# Usage:
#   apply-auto-versioning.sh --check [--repo DIR]
#   apply-auto-versioning.sh [--repo DIR] [--type rust|node|generic]
#                            [--bin NAME] [--no-release] [--force]
#
#   --check        Report archetype + current state, then exit. Changes nothing.
#   --repo DIR     Target repo (default: current directory).
#   --type         Override archetype detection.
#   --bin NAME     Binary/crate name for Rust templates (default: Cargo.toml name).
#   --no-release   Rust: skip release.yml + build.rs (workflow-only install).
#   --force        Overwrite files that already exist.
#
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS="$SKILL_DIR/assets"

REPO="."
TYPE=""
BIN=""
CHECK=0
FORCE=0
NO_RELEASE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --check)      CHECK=1 ;;
    --force)      FORCE=1 ;;
    --no-release) NO_RELEASE=1 ;;
    --repo)       REPO="$2"; shift ;;
    --type)       TYPE="$2"; shift ;;
    --bin)        BIN="$2"; shift ;;
    -h|--help)    sed -n '3,21p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

cd "$REPO"
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: $REPO is not a git repository (run 'git init' first)." >&2
  exit 1
fi
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ---- Detect archetype ------------------------------------------------------
crate_name() {
  awk '/^\[package\]/{p=1;next} /^\[/{p=0} p && /^name[[:space:]]*=/{
    gsub(/.*=[[:space:]]*"|".*/,""); print; exit }' Cargo.toml 2>/dev/null
}
if [ -z "$TYPE" ]; then
  if [ -f Cargo.toml ]; then TYPE="rust"
  elif [ -f package.json ]; then TYPE="node"
  else TYPE="generic"; fi
fi
[ "$TYPE" = "rust" ] && [ -z "$BIN" ] && BIN="$(crate_name || true)"

# ---- Inspect current state -------------------------------------------------
WF=".github/workflows/auto-version.yml"
has_wf=0;      [ -f "$WF" ] && has_wf=1
has_sync=0;    [ -f "$WF" ] && grep -qE 'Cargo\.lock|package\.json|sync manifest' "$WF" && has_sync=1
has_release=0; [ -f .github/workflows/release.yml ] && has_release=1
has_build=0;   [ -f build.rs ] && has_build=1
has_changelog=0; [ -f CHANGELOG.md ] && has_changelog=1

echo "Repo:        $REPO_ROOT"
echo "Archetype:   $TYPE${BIN:+  (bin: $BIN)}"
echo "auto-version.yml: $( [ $has_wf = 1 ] && echo present || echo MISSING )"
if [ "$TYPE" = "rust" ] && [ $has_wf = 1 ]; then
  echo "  manifest sync (itr parity): $( [ $has_sync = 1 ] && echo yes || echo 'NO — upgrade available' )"
fi
[ "$TYPE" = "rust" ] && echo "release.yml: $( [ $has_release = 1 ] && echo present || echo MISSING )"
[ "$TYPE" = "rust" ] && echo "build.rs:    $( [ $has_build = 1 ] && echo present || echo MISSING )"
echo "CHANGELOG.md: $( [ $has_changelog = 1 ] && echo present || echo MISSING )"

if [ "$CHECK" = 1 ]; then
  exit 0
fi

# ---- Copy helper: subst __BIN__/__ENVPREFIX__, no-clobber unless --force ----
ENVPREFIX="$(printf '%s' "${BIN:-APP}" | tr '[:lower:]-' '[:upper:]_' | tr -cd 'A-Z0-9_')"
place() { # $1 src  $2 dest
  local src="$1" dest="$2"
  if [ -f "$dest" ] && [ "$FORCE" != 1 ]; then
    echo "  SKIP  $dest (exists — use --force to overwrite)"
    return
  fi
  mkdir -p "$(dirname "$dest")"
  sed -e "s/__BIN__/${BIN:-app}/g" -e "s/__ENVPREFIX__/${ENVPREFIX}/g" "$src" > "$dest"
  echo "  WROTE $dest"
}

echo ""
echo "Applying $TYPE auto-versioning:"
case "$TYPE" in
  rust)
    place "$ASSETS/rust/auto-version.yml" "$WF"
    if [ "$NO_RELEASE" != 1 ]; then
      place "$ASSETS/rust/release.yml"     ".github/workflows/release.yml"
      place "$ASSETS/rust/build.rs"        "build.rs"
      place "$ASSETS/rust/version_shape.rs" "src/version_shape.rs"
    fi
    [ "$has_changelog" = 1 ] || place "$ASSETS/rust/CHANGELOG.md" "CHANGELOG.md"
    ;;
  node)
    place "$ASSETS/node/auto-version.yml" "$WF"
    [ "$has_changelog" = 1 ] || place "$ASSETS/generic/CHANGELOG.md" "CHANGELOG.md"
    ;;
  generic)
    place "$ASSETS/generic/auto-version.yml" "$WF"
    [ "$has_changelog" = 1 ] || place "$ASSETS/generic/CHANGELOG.md" "CHANGELOG.md"
    ;;
  *) echo "Unknown type: $TYPE" >&2; exit 2 ;;
esac

echo ""
echo "Done. Next steps:"
echo "  1. Review the files above; commit them with a conventional message."
echo "  2. Push to main on GitHub — the first feat:/fix: bump cuts the next tag."
if [ "$TYPE" = "rust" ] && [ "$NO_RELEASE" != 1 ] && [ "$has_build" = 0 ]; then
  echo "  3. To surface the tag in --version, read env!(\"${ENVPREFIX}_VERSION\") in your binary."
fi
