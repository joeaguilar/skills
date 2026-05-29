#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  link-codex-skills.sh [--apply] [--source PATH] [--codex-home PATH]
  link-codex-skills.sh --restore BACKUP_PATH [--codex-home PATH]

By default this script performs a dry run. Pass --apply to replace
$CODEX_HOME/skills with a symlink to this repository's codex/skills tree.
Before replacement, the existing skills path is moved to codex/backups.

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

if [ -L "$TARGET_DIR" ] && [ "$(readlink "$TARGET_DIR")" = "$SOURCE_DIR" ]; then
  echo "$TARGET_DIR already points to $SOURCE_DIR"
  exit 0
fi

backup_path="$BACKUP_ROOT/codex-skills-before-link-$timestamp"

echo "Link plan:"
echo "  Source:     $SOURCE_DIR"
echo "  Codex home: $CODEX_HOME_DIR"
echo "  Target:     $TARGET_DIR"
echo "  Backup:     $backup_path"
echo "  Action:     move existing target to backup, then symlink target to source"

if [ "$APPLY" -ne 1 ]; then
  echo "Dry run only. Re-run with --apply to make this change."
  exit 0
fi

mkdir -p "$CODEX_HOME_DIR" "$BACKUP_ROOT"

if [ -e "$TARGET_DIR" ] || [ -L "$TARGET_DIR" ]; then
  mv "$TARGET_DIR" "$backup_path"
  echo "Backed up existing skills to $backup_path"
fi

ln -s "$SOURCE_DIR" "$TARGET_DIR"
echo "Linked $TARGET_DIR -> $SOURCE_DIR"
