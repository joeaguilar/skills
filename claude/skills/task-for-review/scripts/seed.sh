#!/usr/bin/env bash
# seed.sh — the part of seeding a task-for-review project that never varies.
#
# New project (no repository, or one with no commits): `git init` on main, write the
# scaffolding below, initialise the itr tracker when itr is installed, and make the
# first commit on main. This is the one commit an agent makes on main.
#
# Existing project (the repository already has commits): add only the pieces that
# are missing, and commit them on the current branch. It must be run from a linked
# worktree, so the change reaches main as a reviewed PR; from the main checkout it
# refuses and lists what is missing.
#
# Safe to re-run: a file that exists is never overwritten. The two lines a project
# needs (the ignore entry, the opt-in line) are appended when absent.
#
# Scaffolding:
#   .gitignore                          holds `.claude/worktrees/`
#   AGENTS.md                           project facts + the opt-in line (the source)
#   CLAUDE.md                           imports AGENTS.md
#   .github/pull_request_template.md    the PR description sections
#   glossary.md                         terms + "what this is NOT"
#
# Usage: seed.sh [--name NAME] [--dry-run] [ROOT]
#   --name NAME   project name written into the templates (default: ROOT's folder name)
#   --dry-run     print what would happen; write nothing
#   ROOT          project folder (default: the current directory)
# Exit: 0 done or nothing to add, 1 refused (reason on stderr), 2 usage error.
#
# Output, one `key: value` line per action:
#   mode: new | adopt        created: PATH        appended: PATH (WHAT)
#   kept: PATH               tracker: …           committed: SHA SUBJECT
#   next: …                  a step left to the agent, in order
# With --dry-run the action keys read would-create / would-append.
#
# Test hook: TFR_ITR names the itr binary (default `itr`).
set -u

OPT_IN_LINE='This project works in task-for-review mode: load the task-for-review skill before changing any tracked file.'
COMMIT_SUBJECT='chore(seed): add task-for-review scaffolding'

NAME=""
DRY=0
ROOT="."
while [ $# -gt 0 ]; do
  case "$1" in
    --name) NAME="${2:?--name needs a value}"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
    -*) printf 'seed: unknown option %s\n' "$1" >&2; exit 2 ;;
    *) ROOT="$1"; shift ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
TEMPLATES="$SCRIPT_DIR/../templates"
[ -d "$TEMPLATES" ] || { printf 'seed: templates folder missing at %s\n' "$TEMPLATES" >&2; exit 2; }
if ! cd "$ROOT" 2>/dev/null; then
  printf 'seed: cannot enter %s\n' "$ROOT" >&2
  exit 2
fi
ROOT="$(pwd -P)"
[ -n "$NAME" ] || NAME="$(basename "$ROOT")"
ITR_BIN="${TFR_ITR:-itr}"

# --- which case is this ---------------------------------------------------------
IN_REPO=0
HAS_COMMITS=0
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  IN_REPO=1
  TOP="$(git rev-parse --show-toplevel)"
  if ! cd "$TOP" 2>/dev/null; then printf 'seed: cannot enter %s\n' "$TOP" >&2; exit 2; fi
  ROOT="$(pwd -P)"
  git rev-parse -q --verify HEAD >/dev/null 2>&1 && HAS_COMMITS=1
fi
if [ "$HAS_COMMITS" -eq 1 ]; then MODE="adopt"; else MODE="new"; fi

# --- what is missing --------------------------------------------------------------
# Each plan entry is `ACTION<TAB>PATH<TAB>NOTE`.
PLAN=""
plan() { PLAN="${PLAN}$1"$'\t'"$2"$'\t'"${3:-}"$'\n'; }

if [ ! -f .gitignore ]; then plan create .gitignore
elif ! grep -qxF '.claude/worktrees/' .gitignore; then plan append .gitignore 'ignore .claude/worktrees/'
else plan kept .gitignore
fi

if [ ! -f AGENTS.md ]; then plan create AGENTS.md
elif ! grep -qF 'task-for-review mode' AGENTS.md; then plan append AGENTS.md 'opt-in line'
else plan kept AGENTS.md
fi

if [ ! -f CLAUDE.md ]; then plan create CLAUDE.md
elif grep -qE '^@AGENTS\.md[[:space:]]*$' CLAUDE.md || grep -qF 'task-for-review mode' CLAUDE.md; then plan kept CLAUDE.md
else plan append CLAUDE.md 'opt-in line'
fi

PR_TEMPLATE=""
for f in .github/pull_request_template.md .gitea/pull_request_template.md pull_request_template.md docs/pull_request_template.md; do
  if [ -f "$f" ]; then PR_TEMPLATE="$f"; break; fi
done
if [ -z "$PR_TEMPLATE" ]; then plan create .github/pull_request_template.md; else plan kept "$PR_TEMPLATE"; fi

if [ ! -f glossary.md ]; then plan create glossary.md; else plan kept glossary.md; fi

MISSING="$(printf '%s' "$PLAN" | awk -F'\t' '$1 != "kept"' | grep -c . || true)"

# --- refusals, before anything is written -------------------------------------------
if [ "$MODE" = "adopt" ] && [ "$MISSING" -gt 0 ]; then
  GIT_DIR_ABS="$(git rev-parse --path-format=absolute --git-dir)"
  GIT_COMMON_ABS="$(git rev-parse --path-format=absolute --git-common-dir)"
  if [ "$GIT_DIR_ABS" = "$GIT_COMMON_ABS" ]; then
    {
      echo "seed: this repository already has commits, and this is its main checkout."
      echo "seed: nothing was written. Missing pieces:"
      printf '%s' "$PLAN" | awk -F'\t' '$1 != "kept" { printf "seed:   %s %s\n", $1, $2 }'
      echo "seed: create a worktree on its own branch under .claude/worktrees/, run seed.sh there, and open a PR."
    } >&2
    exit 1
  fi
fi
if [ "$DRY" -eq 0 ] && [ "$MISSING" -gt 0 ]; then
  if [ -z "$(git config user.name 2>/dev/null)" ] || [ -z "$(git config user.email 2>/dev/null)" ]; then
    echo "seed: git user.name or user.email is not set, so the commit would fail. Nothing was written." >&2
    exit 1
  fi
fi

echo "mode: $MODE"

# --- apply ------------------------------------------------------------------------
render() { # template file -> stdout with {{name}} filled in
  local body
  body="$(cat "$TEMPLATES/$1")"
  printf '%s\n' "${body//\{\{name\}\}/$NAME}"
}
append_line() { # file line — on its own line, after a blank line
  [ -n "$(tail -c 1 "$1" 2>/dev/null)" ] && printf '\n' >> "$1"
  printf '\n%s\n' "$2" >> "$1"
}

if [ "$DRY" -eq 0 ] && [ "$IN_REPO" -eq 0 ]; then
  git init -q -b main . || { echo "seed: git init failed" >&2; exit 1; }
fi

CHANGED=""
while IFS=$'\t' read -r action path note; do
  [ -z "$action" ] && continue
  case "$action" in
    kept) echo "kept: $path"; continue ;;
  esac
  if [ "$DRY" -eq 1 ]; then
    if [ "$action" = "create" ]; then echo "would-create: $path"; else echo "would-append: $path ($note)"; fi
    continue
  fi
  if [ "$action" = "create" ]; then
    mkdir -p "$(dirname "$path")"
    case "$path" in
      .gitignore) printf '%s\n' '.claude/worktrees/' > "$path" ;;
      AGENTS.md) render AGENTS.md > "$path" ;;
      CLAUDE.md) render CLAUDE.md > "$path" ;;
      .github/pull_request_template.md) cat "$TEMPLATES/pr-description.md" > "$path" ;;
      glossary.md) render glossary.md > "$path" ;;
    esac
    echo "created: $path"
  else
    case "$path" in
      .gitignore) [ -n "$(tail -c 1 "$path")" ] && printf '\n' >> "$path"; printf '%s\n' '.claude/worktrees/' >> "$path" ;;
      *) append_line "$path" "$OPT_IN_LINE" ;;
    esac
    echo "appended: $path ($note)"
  fi
  CHANGED="${CHANGED}${path}"$'\n'
done <<< "$PLAN"

# --- tracker (new projects only: the database belongs in the main checkout) ----------
ITR_READY=0
if [ "$MODE" = "new" ] && command -v "$ITR_BIN" >/dev/null 2>&1; then
  if [ -f .itr.db ]; then
    echo "tracker: itr (already initialised)"
    ITR_READY=1
  elif [ "$DRY" -eq 1 ]; then
    echo "would-create: .itr.db (itr init)"
  elif "$ITR_BIN" init -q --db "$ROOT/.itr.db" >/dev/null 2>&1; then
    for line in '.itr.db' '.itr.db-*'; do
      grep -qxF -- "$line" .gitignore || printf '%s\n' "$line" >> .gitignore
    done
    case "$CHANGED" in *".gitignore"*) ;; *) CHANGED="${CHANGED}.gitignore"$'\n' ;; esac
    echo "tracker: itr (initialised, .itr.db gitignored)"
    ITR_READY=1
  else
    echo "tracker: itr init failed"
  fi
elif [ "$MODE" = "new" ]; then
  echo "tracker: none (itr is not installed)"
fi

# --- commit ------------------------------------------------------------------------
if [ "$DRY" -eq 0 ] && [ -n "$CHANGED" ]; then
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    git add -- "$path" || { echo "seed: git add $path failed" >&2; exit 1; }
  done <<< "$CHANGED"
  if git commit -q -m "$COMMIT_SUBJECT" >/dev/null; then
    echo "committed: $(git rev-parse --short HEAD) $COMMIT_SUBJECT"
  else
    echo "seed: the commit failed; the files are written and staged" >&2
    exit 1
  fi
fi

if [ "$MISSING" -eq 0 ]; then
  echo "next: nothing to add; the scaffolding is already in place"
  exit 0
fi
if [ "$MODE" = "new" ]; then
  echo "next: initialise the language stack by judgment and commit it separately"
  [ "$ITR_READY" -eq 1 ] && echo "next: run the itr-snapshot skill so the tracker travels with the repo"
  echo "next: fill in AGENTS.md and glossary.md with what is known about the project"
  [ -z "$(git remote 2>/dev/null)" ] && echo "next: create the remote(s) and push main, after confirming names and visibility with the user"
else
  echo "next: open a PR for this branch; the scaffolding reaches main when it merges"
fi
exit 0
