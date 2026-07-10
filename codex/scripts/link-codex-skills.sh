#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  link-codex-skills.sh [--apply] [--source PATH] [--codex-home PATH]
  link-codex-skills.sh --restore BACKUP_PATH [--codex-home PATH]

By default this script performs a dry run. Pass --apply to create a real
$CODEX_HOME/skills overlay: Codex owns `.system`, while each repository-managed
non-system skill is linked individually. Existing paths are backed up first.

Options:
  --apply             Make changes. Without this flag, print the plan only.
  --source PATH       Skills directory to link. Defaults to ../skills.
  --codex-home PATH   Codex home. Defaults to $CODEX_HOME or ~/.codex.
  --restore PATH      Restore a previous backup into $CODEX_HOME/skills.
  -h, --help          Show this help.
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
CODEX_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
SOURCE_DIR="$CODEX_DIR/skills"
BACKUP_ROOT="$CODEX_DIR/backups"
CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
APPLY=0
RESTORE_PATH=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply)
      APPLY=1
      shift
      ;;
    --source)
      SOURCE_DIR="${2:?missing value for --source}"
      shift 2
      ;;
    --codex-home)
      CODEX_HOME_DIR="${2:?missing value for --codex-home}"
      shift 2
      ;;
    --restore)
      RESTORE_PATH="${2:?missing value for --restore}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd -P)"
TARGET_DIR="$CODEX_HOME_DIR/skills"
timestamp="$(date +%Y%m%d-%H%M%S)"

if [ -n "$RESTORE_PATH" ]; then
  RESTORE_PATH="$(cd "$RESTORE_PATH" && pwd -P)"
  echo "Restore plan:"
  echo "  Codex home: $CODEX_HOME_DIR"
  echo "  Target:     $TARGET_DIR"
  echo "  Backup:     $RESTORE_PATH"
  if [ "$APPLY" -ne 1 ]; then
    echo "Dry run only. Re-run with --apply to restore."
    exit 0
  fi

  mkdir -p "$CODEX_HOME_DIR" "$BACKUP_ROOT"
  if [ -e "$TARGET_DIR" ] || [ -L "$TARGET_DIR" ]; then
    mv "$TARGET_DIR" "$BACKUP_ROOT/replaced-during-restore-$timestamp"
  fi
  mv "$RESTORE_PATH" "$TARGET_DIR"
  echo "Restored $RESTORE_PATH to $TARGET_DIR"
  exit 0
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Source skills directory does not exist: $SOURCE_DIR" >&2
  exit 1
fi

if [ ! -d "$SOURCE_DIR/.system" ]; then
  echo "Source skills directory is missing .system: $SOURCE_DIR" >&2
  exit 1
fi

backup_path="$BACKUP_ROOT/codex-skills-root-before-overlay-$timestamp"

echo "Link plan:"
echo "  Source:     $SOURCE_DIR"
echo "  Codex home: $CODEX_HOME_DIR"
echo "  Target:     $TARGET_DIR"
echo "  Backup:     $backup_path (only when replacing a root symlink)"
echo "  Action:     preserve a real .system directory; link non-system skills individually"

if [ "$APPLY" -ne 1 ]; then
  echo "Dry run only. Re-run with --apply to make this change."
  exit 0
fi

mkdir -p "$CODEX_HOME_DIR" "$BACKUP_ROOT"

if [ -L "$TARGET_DIR" ]; then
  mv "$TARGET_DIR" "$backup_path"
  mkdir -p "$TARGET_DIR"
  if [ -d "$backup_path/.system" ]; then
    cp -R "$backup_path/.system" "$TARGET_DIR/.system"
  else
    cp -R "$SOURCE_DIR/.system" "$TARGET_DIR/.system"
  fi
  echo "Backed up existing root link to $backup_path"
elif [ ! -e "$TARGET_DIR" ]; then
  mkdir -p "$TARGET_DIR"
  cp -R "$SOURCE_DIR/.system" "$TARGET_DIR/.system"
elif [ ! -d "$TARGET_DIR" ]; then
  echo "Target exists but is not a directory or symlink: $TARGET_DIR" >&2
  exit 1
elif [ ! -d "$TARGET_DIR/.system" ]; then
  cp -R "$SOURCE_DIR/.system" "$TARGET_DIR/.system"
fi

while IFS= read -r source_skill; do
  name="$(basename "$source_skill")"
  [ "$name" = ".system" ] && continue
  [ -f "$source_skill/SKILL.md" ] || continue
  target_skill="$TARGET_DIR/$name"
  skill_backup="$BACKUP_ROOT/codex-skill-$name-before-link-$timestamp"

  if [ -L "$target_skill" ] && [ "$(readlink "$target_skill")" = "$source_skill" ]; then
    echo "[$name] already linked: $target_skill -> $source_skill"
  elif [ -L "$target_skill" ]; then
    ln -sfn "$source_skill" "$target_skill"
    echo "[$name] replaced symlink -> $source_skill"
  elif [ -e "$target_skill" ]; then
    mv "$target_skill" "$skill_backup"
    ln -s "$source_skill" "$target_skill"
    echo "[$name] backed up to $skill_backup, then linked -> $source_skill"
  else
    ln -s "$source_skill" "$target_skill"
    echo "[$name] linked -> $source_skill"
  fi
done < <(find "$SOURCE_DIR" -mindepth 1 -maxdepth 1 -type d | sort)

echo "Installed Codex skill overlay at $TARGET_DIR"
