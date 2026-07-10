#!/usr/bin/env bash
set -euo pipefail

CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
AGENTS_HOME_DIR="${AGENTS_HOME:-$HOME/.agents}"
CODEX_SKILLS="$CODEX_HOME_DIR/skills"
AGENT_SKILLS="$AGENTS_HOME_DIR/skills"
status=0
duplicates=0
drift=0

if [ ! -d "$CODEX_SKILLS" ]; then
  echo "ERROR: Codex skills root is missing: $CODEX_SKILLS" >&2
  exit 1
fi

printf 'Installed Codex skill audit\n'
printf '  canonical: %s\n' "$CODEX_SKILLS"
printf '  legacy:    %s\n' "$AGENT_SKILLS"

if [ -L "$CODEX_SKILLS" ]; then
  printf '  WARN: canonical root is a symlink; system-skill refreshes can mutate its target: %s\n' "$(readlink "$CODEX_SKILLS")"
  status=1
elif [ ! -d "$CODEX_SKILLS/.system" ]; then
  printf '  ERROR: canonical overlay has no real .system directory\n'
  status=1
fi

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

printf 'Summary: duplicates=%d drift=%d status=%s\n' "$duplicates" "$drift" "$([ "$status" -eq 0 ] && echo clean || echo action-required)"
exit "$status"
