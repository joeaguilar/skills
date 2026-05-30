#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  link-agent-skills.sh [--apply] [--source PATH] [--agents-home PATH]

Links non-system Codex skills into ~/.agents/skills for Codex skill loading.
The .system skill tree remains owned by ~/.codex/skills and is intentionally
not linked here.

Options:
  --apply             Make changes. Without this flag, print the plan only.
  --source PATH       Codex skills directory. Defaults to ../skills.
  --agents-home PATH  Agents home. Defaults to $AGENTS_HOME or ~/.agents.
  -h, --help          Show this help.
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
CODEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
SOURCE_DIR="$CODEX_DIR/skills"
BACKUP_ROOT="$CODEX_DIR/backups"
AGENTS_HOME_DIR="${AGENTS_HOME:-$HOME/.agents}"
APPLY=0
timestamp="$(date +%Y%m%d-%H%M%S)"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --source) SOURCE_DIR="${2:?missing value for --source}"; shift 2 ;;
    --agents-home) AGENTS_HOME_DIR="${2:?missing value for --agents-home}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Source skills directory does not exist: $SOURCE_DIR" >&2
  exit 1
fi

SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd -P)"
TARGET_DIR="$AGENTS_HOME_DIR/skills"

echo "Agent skill link plan:"
echo "  Source:      $SOURCE_DIR"
echo "  Agents home: $AGENTS_HOME_DIR"
echo "  Target:      $TARGET_DIR"
echo "  Scope:       non-system skills only"

if [ "$APPLY" -eq 1 ]; then
  mkdir -p "$TARGET_DIR" "$BACKUP_ROOT"
fi

found=0
while IFS= read -r source_skill; do
  name="$(basename "$source_skill")"
  [ "$name" = ".system" ] && continue
  [ -f "$source_skill/SKILL.md" ] || continue
  found=1

  target_skill="$TARGET_DIR/$name"
  backup_path="$BACKUP_ROOT/agents-skill-$name-before-link-$timestamp"

  if [ -L "$target_skill" ] && [ "$(readlink "$target_skill")" = "$source_skill" ]; then
    echo "[$name] already linked: $target_skill -> $source_skill"
    continue
  fi

  if [ -L "$target_skill" ]; then
    action="replace symlink ($(readlink "$target_skill")) -> $source_skill"
  elif [ -e "$target_skill" ]; then
    action="back up existing path to $backup_path, then symlink -> $source_skill"
  else
    action="create symlink -> $source_skill"
  fi

  echo "[$name] $action"

  if [ "$APPLY" -ne 1 ]; then
    continue
  fi

  if [ -L "$target_skill" ]; then
    ln -sfn "$source_skill" "$target_skill"
  elif [ -e "$target_skill" ]; then
    mv "$target_skill" "$backup_path"
    ln -s "$source_skill" "$target_skill"
  else
    ln -s "$source_skill" "$target_skill"
  fi
done < <(find "$SOURCE_DIR" -mindepth 1 -maxdepth 1 -type d | sort)

if [ "$found" -ne 1 ]; then
  echo "No non-system skills found under $SOURCE_DIR" >&2
  exit 1
fi

if [ -d "$TARGET_DIR" ]; then
  extras="$(comm -13 \
    <(find "$SOURCE_DIR" -mindepth 1 -maxdepth 1 -type d -exec sh -c 'for p do b=$(basename "$p"); [ "$b" = ".system" ] || [ ! -f "$p/SKILL.md" ] || echo "$b"; done' sh {} + | sort) \
    <(find "$TARGET_DIR" -mindepth 1 -maxdepth 1 \( -type d -o -type l \) -exec basename {} \; | sort))"
  if [ -n "$extras" ]; then
    echo "Unmanaged target skills left untouched:"
    printf '%s\n' "$extras" | sed 's/^/  /'
  fi
fi

if [ "$APPLY" -ne 1 ]; then
  echo "Dry run only. Re-run with --apply to make changes."
fi
