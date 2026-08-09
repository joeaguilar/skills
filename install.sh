#!/usr/bin/env bash
set -euo pipefail

# Unified primitive installer for this repo.
#
# Dry-run by default. Existing real target dirs are backed up before replacement;
# existing links are replaced in place. Codex skills are the exception: the
# installer keeps a real `.system` overlay and links custom skills individually
# so product refreshes cannot mutate the source checkout.
#
# Windows (Git Bash/MSYS): `ln -s` silently degrades to a deep COPY unless
# MSYS=winsymlinks:nativestrict is exported, which needs Developer Mode. A copy
# looks installed but never receives repo updates. So on Windows, directories
# are linked with NTFS junctions (mklink /J — no privileges needed, and Git
# Bash sees them as symlinks: -L is true, readlink resolves) and files try a
# native symlink, then a hardlink, then loudly fall back to copy.

usage() {
  cat <<'USAGE'
Usage:
  install.sh <claude|codex|both> [--apply] [--scope global|local]
             [--primitive skills|agents|commands|workflows|all]
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
  --primitive TYPE     Primitive root: skills, agents, commands, workflows,
                       config, or all (default: skills, preserving legacy
                       behavior). `workflows` is Claude-only (no Workflow tool
                       on Codex) and is skipped as optional for codex under
                       --all-primitives. `config` links individual home files
                       (claude: settings.json + statusline.sh) rather than a
                       directory root; it is opt-in and is NOT included in
                       --all-primitives.
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

Codex skills must contain `.system`; installation seeds a real Codex-owned copy
and links non-system children individually. Other primitive roots are optional
unless selected directly. `config` is Claude-only today; for codex it is a no-op.
`workflows` is Claude-only by design (no Workflow tool on Codex); it is skipped
for codex under --all-primitives and errors if selected directly for codex.
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
    skills|agents|commands|workflows|config) ;;
    *) echo "Error: primitive roots must be skills, agents, commands, workflows, or config." >&2; exit 2 ;;
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
    all) printf '%s\n' skills agents commands workflows ;;
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

# --- portable links ---------------------------------------------------------

on_windows() { case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) return 0 ;; *) return 1 ;; esac; }

# remove_link TARGET — remove an existing link without touching what it points at.
# On Windows a junction must be removed with rmdir; POSIX rm handles symlinks.
remove_link() {
  local target="$1"
  if on_windows && [ -d "$target" ]; then
    # MSYS_NO_PATHCONV stops MSYS mangling /switches; then plain /c is required
    MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$target")"
  else
    rm "$target"
  fi
}

# link_dir SOURCE TARGET — directory link: NTFS junction on Windows, symlink
# elsewhere. TARGET must not exist. Dies if the result is not a real link
# (i.e. if anything silently copied instead).
link_dir() {
  local source="$1" target="$2"
  if on_windows; then
    MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$target")" "$(cygpath -w "$source")" >/dev/null
  else
    ln -s "$source" "$target"
  fi
  if [ ! -L "$target" ]; then
    echo "FATAL: $target is not a link after linking (silent copy?) — refusing to continue" >&2
    return 1
  fi
}

# link_file SOURCE TARGET — file link. TARGET must not exist. On Windows tries
# native symlink (needs Developer Mode), then hardlink, then copies with a loud
# warning (a hardlink survives edits-in-place but is severed when git rewrites
# the source inode; re-run install after big pulls).
link_file() {
  local source="$1" target="$2"
  if on_windows; then
    local ws wt
    ws="$(cygpath -w "$source")"; wt="$(cygpath -w "$target")"
    if MSYS_NO_PATHCONV=1 cmd /c mklink "$wt" "$ws" >/dev/null 2>&1; then
      return 0
    fi
    if MSYS_NO_PATHCONV=1 cmd /c mklink /H "$wt" "$ws" >/dev/null 2>&1; then
      echo "    note: hardlinked (no symlink privilege) — re-run install if git rewrites the source file"
      return 0
    fi
    cp "$source" "$target"
    echo "    WARNING: copied, not linked — enable Developer Mode (or export MSYS=winsymlinks:nativestrict) for real file links" >&2
    return 0
  fi
  ln -s "$source" "$target"
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
    remove_link "$target"
  elif [ -e "$target" ]; then
    mkdir -p "$BACKUP_ROOT"
    mv "$target" "$backup"
    echo "[$platform/$primitive] backed up existing root to $backup"
  fi
  link_dir "$source" "$target"
  echo "[$platform/$primitive] linked $target -> $source"
}

# install_codex_skills SOURCE_DIR TARGET_DIR
# Keep Codex-owned `.system` payloads as a real directory under CODEX_HOME while
# linking each repository-managed skill individually. A root symlink would let
# Codex system-skill refreshes write into this git checkout.
install_codex_skills() {
  local source="$1" target="$2"
  if [ ! -d "$source/.system" ]; then
    echo "[codex/skills] source is missing .system: $source" >&2
    return 1
  fi

  local root_backup="" root_action
  if [ -L "$target" ]; then
    root_backup="$BACKUP_ROOT/codex-${SCOPE_SEL}-skills-root-before-overlay-$timestamp"
    root_action="replace root symlink with a real overlay directory; preserve .system; link managed skills individually; backup root link to $root_backup"
  elif [ -d "$target" ]; then
    root_action="preserve real overlay and .system; reconcile managed per-skill links"
  elif [ -e "$target" ]; then
    echo "[codex/skills] target exists but is not a directory or symlink: $target" >&2
    return 1
  else
    root_action="create real overlay, seed .system, and link managed skills individually"
  fi

  echo "[codex/skills] plan:"
  echo "    scope:  $SCOPE_SEL"
  echo "    source: $source"
  echo "    target: $target"
  echo "    action: $root_action"

  if [ "$APPLY" -eq 1 ]; then
    mkdir -p "$(dirname "$target")" "$BACKUP_ROOT"
    if [ -L "$target" ]; then
      mv "$target" "$root_backup"
      mkdir -p "$target"
      if [ -d "$root_backup/.system" ]; then
        cp -R "$root_backup/.system" "$target/.system"
      else
        cp -R "$source/.system" "$target/.system"
      fi
      echo "[codex/skills] backed up root link to $root_backup"
    elif [ ! -e "$target" ]; then
      mkdir -p "$target"
      cp -R "$source/.system" "$target/.system"
    elif [ ! -d "$target/.system" ]; then
      cp -R "$source/.system" "$target/.system"
    fi
  fi

  local source_skill name target_skill backup action
  while IFS= read -r source_skill; do
    name="$(basename "$source_skill")"
    [ "$name" = ".system" ] && continue
    [ -f "$source_skill/SKILL.md" ] || continue
    target_skill="$target/$name"
    backup="$BACKUP_ROOT/codex-${SCOPE_SEL}-skill-$name-before-link-$timestamp"

    if [ -L "$target_skill" ] && [ "$(readlink "$target_skill")" = "$source_skill" ]; then
      echo "[codex/skills/$name] already linked: $target_skill -> $source_skill"
      continue
    elif [ -L "$target_skill" ]; then
      action="replace symlink ($(readlink "$target_skill")) -> $source_skill"
    elif [ -e "$target_skill" ]; then
      action="back up existing path to $backup, then symlink -> $source_skill"
    else
      action="create symlink -> $source_skill"
    fi
    echo "[codex/skills/$name] $action"

    if [ "$APPLY" -ne 1 ]; then
      continue
    fi
    if [ -L "$target_skill" ]; then
      remove_link "$target_skill"
    elif [ -e "$target_skill" ]; then
      mv "$target_skill" "$backup"
    fi
    link_dir "$source_skill" "$target_skill"
  done < <(find "$source" -mindepth 1 -maxdepth 1 -type d | sort)

  if [ "$APPLY" -ne 1 ]; then
    echo "[codex/skills] dry run only. Re-run with --apply to make this change."
  fi
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
    rm "$target"
  elif [ -e "$target" ]; then
    mkdir -p "$BACKUP_ROOT"
    mv "$target" "$backup"
    echo "[$platform/config] backed up existing file to $backup"
  fi
  link_file "$source" "$target"
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
      if [ "$platform" = "codex" ] && [ "$primitive" = "skills" ]; then
        install_codex_skills "$source" "$target" || status=1
      else
        install_root "$platform" "$primitive" "$source" "$target" || status=1
      fi
    fi
  done < <(primitives_for_selection)
done < <(platforms_for_selection)

if [ "$APPLY" -ne 1 ]; then
  echo
  echo "Dry run complete. Re-run with --apply to make changes."
fi
exit "$status"
