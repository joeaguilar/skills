#!/usr/bin/env bash
set -euo pipefail

# Unified skills installer for this repo.
# Symlinks a tree's `skills/` dir into the agent's home:
#   claude -> ~/.claude/skills  (source: claude/skills, no .system required)
#   codex  -> ~/.codex/skills   (source: codex/skills,  .system required)
# Dry-run by default; pass --apply to make changes. Real target dirs are backed
# up before replacement; existing symlinks are replaced atomically (ln -sfn).

usage() {
  cat <<'USAGE'
Usage:
  install.sh <claude|codex|both> [--apply] [--restore BACKUP_PATH]
             [--claude-home PATH] [--codex-home PATH]

Targets:
  claude   link ${CLAUDE_HOME:-~/.claude}/skills  -> <repo>/claude/skills
  codex    link ${CODEX_HOME:-~/.codex}/skills    -> <repo>/codex/skills
  both     install both trees

Options:
  --apply              Make changes. Without it, print the plan only (dry run).
  --restore PATH       Restore a backup into the selected target's skills dir
                       (requires a single target: claude OR codex).
  --claude-home PATH   Override Claude home (default $CLAUDE_HOME or ~/.claude).
  --codex-home PATH    Override Codex home  (default $CODEX_HOME or ~/.codex).
  -h, --help           Show this help.

Backups land in <repo>/backups/. Codex source must contain `.system`;
the Claude tree does not (Claude has no system skills here).
USAGE
}

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
BACKUP_ROOT="$REPO_DIR/backups"
CLAUDE_HOME_DIR="${CLAUDE_HOME:-$HOME/.claude}"
CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
APPLY=0
RESTORE_PATH=""
TARGET_SEL=""
timestamp="$(date +%Y%m%d-%H%M%S)"

while [ "$#" -gt 0 ]; do
  case "$1" in
    claude|codex|both) TARGET_SEL="$1"; shift ;;
    --apply) APPLY=1; shift ;;
    --restore) RESTORE_PATH="${2:?missing value for --restore}"; shift 2 ;;
    --claude-home) CLAUDE_HOME_DIR="${2:?missing value for --claude-home}"; shift 2 ;;
    --codex-home) CODEX_HOME_DIR="${2:?missing value for --codex-home}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ -z "$TARGET_SEL" ]; then
  echo "Error: choose a target (claude|codex|both)." >&2
  usage >&2
  exit 2
fi

# install_tree NAME SOURCE_DIR TARGET_DIR REQUIRE_SYSTEM
install_tree() {
  local name="$1" source="$2" target="$3" require_system="$4"

  if [ ! -d "$source" ]; then
    echo "[$name] source skills dir not found: $source" >&2
    return 1
  fi
  if [ "$require_system" -eq 1 ] && [ ! -d "$source/.system" ]; then
    echo "[$name] source is missing .system: $source" >&2
    return 1
  fi

  if [ -L "$target" ] && [ "$(readlink "$target")" = "$source" ]; then
    echo "[$name] already linked: $target -> $source"
    return 0
  fi

  local parent backup action
  parent="$(dirname "$target")"
  if [ -L "$target" ]; then
    action="replace existing symlink ($(readlink "$target")) -> $source"
  elif [ -e "$target" ]; then
    backup="$BACKUP_ROOT/${name}-skills-before-link-$timestamp"
    action="back up real dir to $backup, then symlink -> $source"
  else
    action="create symlink -> $source"
  fi

  echo "[$name] plan:"
  echo "    source: $source"
  echo "    target: $target"
  echo "    action: $action"

  if [ "$APPLY" -ne 1 ]; then
    echo "[$name] dry run only. Re-run with --apply to make this change."
    return 0
  fi

  mkdir -p "$parent"
  if [ -L "$target" ]; then
    ln -sfn "$source" "$target"            # atomic replace of a symlink
  elif [ -e "$target" ]; then
    mkdir -p "$BACKUP_ROOT"
    mv "$target" "$backup"
    echo "[$name] backed up existing skills to $backup"
    ln -s "$source" "$target"
  else
    ln -s "$source" "$target"
  fi
  echo "[$name] linked $target -> $source"
}

# restore_tree NAME TARGET_DIR BACKUP_PATH
restore_tree() {
  local name="$1" target="$2" backup="$3"
  backup="$(cd "$backup" && pwd -P)"
  local parent backup_of_current
  parent="$(dirname "$target")"
  backup_of_current="$BACKUP_ROOT/${name}-skills-replaced-during-restore-$timestamp"

  echo "[$name] restore plan:"
  echo "    target: $target"
  echo "    backup: $backup"
  echo "    action: move current target aside, move backup into target"

  if [ "$APPLY" -ne 1 ]; then
    echo "[$name] dry run only. Re-run with --apply to restore."
    return 0
  fi

  mkdir -p "$parent" "$BACKUP_ROOT"
  if [ -e "$target" ] || [ -L "$target" ]; then
    mv "$target" "$backup_of_current"
    echo "[$name] moved current target to $backup_of_current"
  fi
  mv "$backup" "$target"
  echo "[$name] restored $backup -> $target"
}

claude_source="$REPO_DIR/claude/skills"
codex_source="$REPO_DIR/codex/skills"
claude_target="$CLAUDE_HOME_DIR/skills"
codex_target="$CODEX_HOME_DIR/skills"

if [ -n "$RESTORE_PATH" ]; then
  case "$TARGET_SEL" in
    claude) restore_tree claude "$claude_target" "$RESTORE_PATH" ;;
    codex)  restore_tree codex  "$codex_target"  "$RESTORE_PATH" ;;
    both)   echo "Error: --restore needs a single target (claude OR codex)." >&2; exit 2 ;;
  esac
  exit 0
fi

status=0
case "$TARGET_SEL" in
  claude) install_tree claude "$claude_source" "$claude_target" 0 || status=1 ;;
  codex)  install_tree codex  "$codex_source"  "$codex_target"  1 || status=1 ;;
  both)
    install_tree claude "$claude_source" "$claude_target" 0 || status=1
    install_tree codex  "$codex_source"  "$codex_target"  1 || status=1
    ;;
esac

if [ "$APPLY" -ne 1 ]; then
  echo
  echo "Dry run complete. Re-run with --apply to make changes."
fi
exit "$status"
