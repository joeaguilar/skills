#!/usr/bin/env bash
set -euo pipefail

# Unified primitive installer for this repo.
#
# Dry-run by default. Existing real target dirs are backed up before replacement;
# existing symlinks are replaced atomically with ln -sfn.

usage() {
  cat <<'USAGE'
Usage:
  install.sh <claude|codex|both> [--apply] [--scope global|local]
             [--primitive skills|agents|commands|all]
             [--primitives skills,agents] [--all-primitives]
             [--project PATH] [--restore BACKUP_PATH]
             [--claude-home PATH] [--codex-home PATH]

Targets:
  claude   manage primitives under claude/<primitive>
  codex    manage primitives under codex/<primitive>
  both     manage both platform trees

Scopes:
  global   install into ${CLAUDE_HOME:-~/.claude} and/or ${CODEX_HOME:-~/.codex}
  local    install into <project>/.claude and/or <project>/.codex

Options:
  --apply              Make changes. Without it, print the plan only (dry run).
  --scope SCOPE        Install scope: global or local (default: global).
  --primitive TYPE     Primitive root: skills, agents, commands, config, or all
                       (default: skills, preserving legacy behavior). `config`
                       links individual home files (claude: settings.json +
                       statusline.sh) rather than a directory root; it is opt-in
                       and is NOT included in --all-primitives.
  --primitives LIST    Comma-separated primitive roots.
  --all-primitives     Select all standard primitive roots.
  --global             Alias for --scope global.
  --local [PATH]       Alias for --scope local with optional project path.
  --project PATH       Project root for --scope local (default: cwd).
  --restore PATH       Restore a backup into the selected target root
                       (requires one platform and one primitive type).
  --claude-home PATH   Override Claude home (default $CLAUDE_HOME or ~/.claude).
  --codex-home PATH    Override Codex home  (default $CODEX_HOME or ~/.codex).
  -h, --help           Show this help.

Examples:
  install.sh codex --apply
  install.sh both --primitive all --apply
  install.sh both --all-primitives --apply
  install.sh claude --scope local --project /path/to/project --primitive commands --apply
  install.sh codex --local /path/to/project --primitives skills,agents --apply

Codex skills must contain `.system`; other primitive roots are optional unless
selected directly. `config` is Claude-only today; for codex it is a no-op.
USAGE
}

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
BACKUP_ROOT="$REPO_DIR/backups"
CLAUDE_HOME_DIR="${CLAUDE_HOME:-$HOME/.claude}"
CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
PROJECT_DIR="$(pwd -P)"
APPLY=0
RESTORE_PATH=""
TARGET_SEL=""
SCOPE_SEL="global"
PRIMITIVE_SEL="skills"
timestamp="$(date +%Y%m%d-%H%M%S)"

while [ "$#" -gt 0 ]; do
  case "$1" in
    claude|codex|both) TARGET_SEL="$1"; shift ;;
    --apply) APPLY=1; shift ;;
    --scope) SCOPE_SEL="${2:?missing value for --scope}"; shift 2 ;;
    --primitive) PRIMITIVE_SEL="${2:?missing value for --primitive}"; shift 2 ;;
    --primitives) PRIMITIVE_SEL="${2:?missing value for --primitives}"; shift 2 ;;
    --all-primitives) PRIMITIVE_SEL="all"; shift ;;
    --global) SCOPE_SEL="global"; shift ;;
    --local)
      SCOPE_SEL="local"
      if [ "$#" -gt 1 ] && [ "${2#-}" = "$2" ]; then
        PROJECT_DIR="$2"
        shift 2
      else
        shift
      fi
      ;;
    --project) PROJECT_DIR="${2:?missing value for --project}"; shift 2 ;;
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

case "$SCOPE_SEL" in
  global|local) ;;
  *) echo "Error: --scope must be global or local." >&2; exit 2 ;;
esac

validate_primitive() {
  case "$1" in
    skills|agents|commands|config) ;;
    *) echo "Error: primitive roots must be skills, agents, commands, or config." >&2; exit 2 ;;
  esac
}

if [ "$PRIMITIVE_SEL" != "all" ]; then
  for primitive in ${PRIMITIVE_SEL//,/ }; do
    validate_primitive "$primitive"
  done
fi

if [ "$SCOPE_SEL" = "local" ]; then
  PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd -P)"
fi

platforms_for_selection() {
  case "$TARGET_SEL" in
    claude) echo "claude" ;;
    codex) echo "codex" ;;
    both) printf '%s\n' claude codex ;;
  esac
}

primitives_for_selection() {
  case "$PRIMITIVE_SEL" in
    all) printf '%s\n' skills agents commands ;;
    *)
      for primitive in ${PRIMITIVE_SEL//,/ }; do
        echo "$primitive"
      done
      ;;
  esac
}

platform_home() {
  case "$1" in
    claude) echo "$CLAUDE_HOME_DIR" ;;
    codex) echo "$CODEX_HOME_DIR" ;;
  esac
}

platform_local_home() {
  case "$1" in
    claude) echo "$PROJECT_DIR/.claude" ;;
    codex) echo "$PROJECT_DIR/.codex" ;;
  esac
}

target_root() {
  local platform="$1"
  if [ "$SCOPE_SEL" = "global" ]; then
    platform_home "$platform"
  else
    platform_local_home "$platform"
  fi
}

primitive_required() {
  # `skills` remain required. Optional roots are skipped for --primitive all, but
  # treated as required when the caller selects that root explicitly.
  local primitive="$1"
  [ "$primitive" = "skills" ] || [ "$PRIMITIVE_SEL" != "all" ]
}

# install_root PLATFORM PRIMITIVE SOURCE_DIR TARGET_DIR
install_root() {
  local platform="$1" primitive="$2" source="$3" target="$4"
  local require_source=0
  if primitive_required "$primitive"; then
    require_source=1
  fi

  if [ ! -d "$source" ]; then
    if [ "$require_source" -eq 1 ]; then
      echo "[$platform/$primitive] source dir not found: $source" >&2
      return 1
    fi
    echo "[$platform/$primitive] skipped: optional source dir not found: $source"
    return 0
  fi

  if [ "$platform" = "codex" ] && [ "$primitive" = "skills" ] && [ ! -d "$source/.system" ]; then
    echo "[codex/skills] source is missing .system: $source" >&2
    return 1
  fi

  if [ -L "$target" ] && [ "$(readlink "$target")" = "$source" ]; then
    echo "[$platform/$primitive] already linked: $target -> $source"
    return 0
  fi

  local parent backup action
  parent="$(dirname "$target")"
  if [ -L "$target" ]; then
    action="replace existing symlink ($(readlink "$target")) -> $source"
  elif [ -e "$target" ]; then
    backup="$BACKUP_ROOT/${platform}-${SCOPE_SEL}-${primitive}-before-link-$timestamp"
    action="back up real dir to $backup, then symlink -> $source"
  else
    action="create symlink -> $source"
  fi

  echo "[$platform/$primitive] plan:"
  echo "    scope:  $SCOPE_SEL"
  echo "    source: $source"
  echo "    target: $target"
  echo "    action: $action"

  if [ "$APPLY" -ne 1 ]; then
    echo "[$platform/$primitive] dry run only. Re-run with --apply to make this change."
    return 0
  fi

  mkdir -p "$parent"
  if [ -L "$target" ]; then
    ln -sfn "$source" "$target"
  elif [ -e "$target" ]; then
    mkdir -p "$BACKUP_ROOT"
    mv "$target" "$backup"
    echo "[$platform/$primitive] backed up existing root to $backup"
    ln -s "$source" "$target"
  else
    ln -s "$source" "$target"
  fi
  echo "[$platform/$primitive] linked $target -> $source"
}

# install_file PLATFORM SOURCE TARGET — symlink a single home file (the `config` primitive).
# Mirrors install_root, but for one file: a real file at the target is backed up first.
install_file() {
  local platform="$1" source="$2" target="$3"
  if [ ! -f "$source" ] && [ ! -L "$source" ]; then
    echo "[$platform/config] source file not found: $source" >&2
    return 1
  fi

  if [ -L "$target" ] && [ "$(readlink "$target")" = "$source" ]; then
    echo "[$platform/config] already linked: $target -> $source"
    return 0
  fi

  local parent backup action
  parent="$(dirname "$target")"
  if [ -L "$target" ]; then
    action="replace existing symlink ($(readlink "$target")) -> $source"
  elif [ -e "$target" ]; then
    backup="$BACKUP_ROOT/${platform}-${SCOPE_SEL}-config-$(basename "$target")-before-link-$timestamp"
    action="back up real file to $backup, then symlink -> $source"
  else
    action="create symlink -> $source"
  fi

  echo "[$platform/config] plan:"
  echo "    scope:  $SCOPE_SEL"
  echo "    source: $source"
  echo "    target: $target"
  echo "    action: $action"

  if [ "$APPLY" -ne 1 ]; then
    echo "[$platform/config] dry run only. Re-run with --apply to make this change."
    return 0
  fi

  mkdir -p "$parent"
  if [ -L "$target" ]; then
    ln -sfn "$source" "$target"
  elif [ -e "$target" ]; then
    mkdir -p "$BACKUP_ROOT"
    mv "$target" "$backup"
    echo "[$platform/config] backed up existing file to $backup"
    ln -s "$source" "$target"
  else
    ln -s "$source" "$target"
  fi
  echo "[$platform/config] linked $target -> $source"
}

# install_config PLATFORM — link known home config files into the platform home.
# Claude manages settings.json + statusline.sh; codex has no managed config files yet.
install_config() {
  local platform="$1" home
  home="$(target_root "$platform")"
  case "$platform" in
    claude)
      install_file claude "$REPO_DIR/claude/settings.json" "$home/settings.json"
      install_file claude "$REPO_DIR/statusline.sh"        "$home/statusline.sh"
      ;;
    codex)
      echo "[codex/config] no managed config files defined; skipping"
      ;;
  esac
}

# restore_root PLATFORM PRIMITIVE TARGET_DIR BACKUP_PATH
restore_root() {
  local platform="$1" primitive="$2" target="$3" backup="$4"
  backup="$(cd "$backup" && pwd -P)"
  local parent backup_of_current
  parent="$(dirname "$target")"
  backup_of_current="$BACKUP_ROOT/${platform}-${SCOPE_SEL}-${primitive}-replaced-during-restore-$timestamp"

  echo "[$platform/$primitive] restore plan:"
  echo "    target: $target"
  echo "    backup: $backup"
  echo "    action: move current target aside, move backup into target"

  if [ "$APPLY" -ne 1 ]; then
    echo "[$platform/$primitive] dry run only. Re-run with --apply to restore."
    return 0
  fi

  mkdir -p "$parent" "$BACKUP_ROOT"
  if [ -e "$target" ] || [ -L "$target" ]; then
    mv "$target" "$backup_of_current"
    echo "[$platform/$primitive] moved current target to $backup_of_current"
  fi
  mv "$backup" "$target"
  echo "[$platform/$primitive] restored $backup -> $target"
}

if [ -n "$RESTORE_PATH" ]; then
  if [ "$TARGET_SEL" = "both" ] || [ "$PRIMITIVE_SEL" = "all" ]; then
    echo "Error: --restore needs one platform and one primitive root." >&2
    exit 2
  fi
  platform="$TARGET_SEL"
  primitive="$PRIMITIVE_SEL"
  restore_root "$platform" "$primitive" "$(target_root "$platform")/$primitive" "$RESTORE_PATH"
  exit 0
fi

status=0
while IFS= read -r platform; do
  while IFS= read -r primitive; do
    if [ "$primitive" = "config" ]; then
      install_config "$platform" || status=1
    else
      source="$REPO_DIR/$platform/$primitive"
      target="$(target_root "$platform")/$primitive"
      install_root "$platform" "$primitive" "$source" "$target" || status=1
    fi
  done < <(primitives_for_selection)
done < <(platforms_for_selection)

if [ "$APPLY" -ne 1 ]; then
  echo
  echo "Dry run complete. Re-run with --apply to make changes."
fi
exit "$status"
