#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: retire-agent-skill-duplicates.sh [--apply]

Moves ~/.agents/skills entries whose names also exist in ~/.codex/skills into
codex/backups. Unique legacy-only skills are preserved. Dry-run is the default.
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
CODEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
BACKUP_ROOT="$CODEX_DIR/backups"
CODEX_SKILLS="${CODEX_HOME:-$HOME/.codex}/skills"
AGENT_SKILLS="${AGENTS_HOME:-$HOME/.agents}/skills"
APPLY=0
timestamp="$(date +%Y%m%d-%H%M%S)"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ ! -d "$CODEX_SKILLS" ] || [ ! -d "$AGENT_SKILLS" ]; then
  echo "Both $CODEX_SKILLS and $AGENT_SKILLS must exist." >&2
  exit 1
fi

found=0
while IFS= read -r legacy_skill; do
  name="$(basename "$legacy_skill")"
  [ -f "$legacy_skill/SKILL.md" ] || continue
  [ -f "$CODEX_SKILLS/$name/SKILL.md" ] || continue
  found=1
  backup="$BACKUP_ROOT/retired-agent-skill-$name-$timestamp"
  echo "[$name] move $legacy_skill -> $backup"
  if [ "$APPLY" -eq 1 ]; then
    mkdir -p "$BACKUP_ROOT"
    mv "$legacy_skill" "$backup"
  fi
done < <(find "$AGENT_SKILLS" -mindepth 1 -maxdepth 1 \( -type d -o -type l \) | sort)

if [ "$found" -eq 0 ]; then
  echo "No duplicate legacy skill names found."
elif [ "$APPLY" -ne 1 ]; then
  echo "Dry run only. Re-run with --apply to retire these duplicates."
fi
