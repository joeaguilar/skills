#!/usr/bin/env bash
set -euo pipefail

CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
AGENTS_HOME_DIR="${AGENTS_HOME:-$HOME/.agents}"
CODEX_SKILLS="$CODEX_HOME_DIR/skills"
AGENT_SKILLS="$AGENTS_HOME_DIR/skills"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SOURCE_SKILLS="${CODEX_SKILL_SOURCE:-$(cd "$SCRIPT_DIR/../skills" && pwd -P)}"
status=0
duplicates=0
drift=0
stale=0

if [ ! -d "$CODEX_SKILLS" ]; then
  echo "ERROR: Codex skills root is missing: $CODEX_SKILLS" >&2
  exit 1
fi

printf 'Installed Codex skill audit\n'
printf '  canonical: %s\n' "$CODEX_SKILLS"
printf '  legacy:    %s\n' "$AGENT_SKILLS"
printf '  source:    %s\n' "$SOURCE_SKILLS"

if [ ! -d "$SOURCE_SKILLS" ]; then
  printf 'ERROR: repository skills root is missing: %s\n' "$SOURCE_SKILLS" >&2
  exit 1
fi

if [ -L "$CODEX_SKILLS" ]; then
  printf '  WARN: canonical root is a symlink; system-skill refreshes can mutate its target: %s\n' "$(readlink "$CODEX_SKILLS")"
  status=1
elif [ ! -d "$CODEX_SKILLS/.system" ]; then
  printf '  ERROR: canonical overlay has no real .system directory\n'
  status=1
fi

# Compare installed repository-managed skills, including references and scripts.
# Uninstalled skills, unique local skills, and product-owned .system are outside
# this audit. Normalize CRLF so Windows checkouts do not produce false drift.
while IFS= read -r source_skill; do
  name="$(basename "$source_skill")"
  [ "$name" = ".system" ] && continue
  [ -f "$source_skill/SKILL.md" ] || continue
  installed_skill="$CODEX_SKILLS/$name"
  if [ ! -e "$installed_skill" ] && [ ! -L "$installed_skill" ]; then
    continue
  fi
  if ! diff --strip-trailing-cr -qr --exclude=.git --exclude=__pycache__ \
      --exclude='*.pyc' "$source_skill" "$installed_skill" >/dev/null 2>&1; then
    stale=$((stale + 1))
    status=1
    printf '  STALE:     %s (installed payload differs from repository)\n' "$name"
  fi
done < <(find "$SOURCE_SKILLS" -mindepth 1 -maxdepth 1 -type d | sort)

if [ -d "$AGENT_SKILLS" ]; then
  while IFS= read -r legacy_skill; do
    name="$(basename "$legacy_skill")"
    canonical_skill="$CODEX_SKILLS/$name"
    [ -f "$legacy_skill/SKILL.md" ] || continue
    [ -f "$canonical_skill/SKILL.md" ] || continue
    duplicates=$((duplicates + 1))
    if cmp -s "$legacy_skill/SKILL.md" "$canonical_skill/SKILL.md"; then
      printf '  DUPLICATE: %s (identical payload)\n' "$name"
    else
      drift=$((drift + 1))
      status=1
      printf '  DRIFT:     %s (legacy and canonical payloads differ)\n' "$name"
    fi
  done < <(find "$AGENT_SKILLS" -mindepth 1 -maxdepth 1 \( -type d -o -type l \) | sort)
fi

printf 'Summary: duplicates=%d drift=%d stale=%d status=%s\n' "$duplicates" "$drift" "$stale" "$([ "$status" -eq 0 ] && echo clean || echo action-required)"
exit "$status"
