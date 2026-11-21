#!/usr/bin/env bash
# changelog.sh — the Changelog table of a PR description, straight from git.
#
# Prints a markdown table with one row per commit in BASE..HEAD, oldest first:
# the linked short hash, the commit line, and every file the commit touched with
# its status letter (A added, M modified, D deleted, R renamed as `old -> new`).
# The commit and file lists come from git, so they cannot disagree with the branch.
# Each file ends in `WHY?`: replace every one with a few words on what that change
# is for. A `WHY?` left in a PR description is an unfinished changelog.
#
# Usage: changelog.sh [--fold] [--remote NAME] [BASE [HEAD]]
#   --fold         wrap the table in a collapsible <details> block
#   --remote NAME  remote whose host the commit links point at (default: origin,
#                  else the first remote; no remote or an unknown host gives plain hashes)
#   BASE           the branch this PR merges into: the branch below it in the stack,
#                  or the main branch for the bottom PR (default: the main branch)
#   HEAD           the PR's branch (default: HEAD)
# Exit: 0 printed, 1 nothing to list or not a repository, 2 usage error.
#
# Test hook: TFR_GITEA names the gitea helper used to find a Gitea repo's web URL.
set -u

FOLD=0
REMOTE=""
ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --fold) FOLD=1; shift ;;
    --remote) REMOTE="${2:?--remote needs a name}"; shift 2 ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
    -*) printf 'changelog: unknown option %s\n' "$1" >&2; exit 2 ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
[ "${#ARGS[@]}" -le 2 ] || { echo "changelog: at most BASE and HEAD" >&2; exit 2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "changelog: not a git repository" >&2; exit 1; }

BASE="${ARGS[0]:-}"
HEAD_REF="${ARGS[1]:-HEAD}"
if [ -z "$BASE" ]; then
  BASE="$(tfr_main_branch)"
  [ -n "$BASE" ] || { echo "changelog: cannot tell the main branch; pass BASE" >&2; exit 2; }
fi
git rev-parse -q --verify "$BASE^{commit}" >/dev/null 2>&1 || { echo "changelog: unknown BASE $BASE" >&2; exit 2; }
git rev-parse -q --verify "$HEAD_REF^{commit}" >/dev/null 2>&1 || { echo "changelog: unknown HEAD $HEAD_REF" >&2; exit 2; }

# --- where a commit link points -----------------------------------------------------
[ -n "$REMOTE" ] || REMOTE="$(tfr_default_remote)"
COMMIT_URL=""
if [ -n "$REMOTE" ]; then
  web="$(tfr_web_base "$(git remote get-url "$REMOTE" 2>/dev/null || true)")"
  [ -n "$web" ] && COMMIT_URL="$web/commit/"
fi

COUNT="$(git rev-list --count --no-merges "$BASE..$HEAD_REF")"
if [ "$COUNT" -eq 0 ]; then
  echo "changelog: no commits in $BASE..$HEAD_REF" >&2
  exit 1
fi

if [ "$FOLD" -eq 1 ]; then
  printf '<details>\n<summary>Changelog (%s commit%s)</summary>\n\n' "$COUNT" "$([ "$COUNT" -eq 1 ] || echo s)"
fi
echo '| Commit | Change | Files |'
echo '|---|---|---|'
git -c core.quotePath=false log --reverse --no-merges --format='@@%H %s' --name-status -M "$BASE..$HEAD_REF" \
  | awk -v url="$COMMIT_URL" '
    function esc(s,   n, part, i, out) {   # a bare pipe would end the table cell
      n = split(s, part, "|"); out = part[1]
      for (i = 2; i <= n; i++) out = out "\\|" part[i]
      return out
    }
    function flush(   link) {
      if (sha == "") return
      link = (url != "") ? "[`" short "`](" url sha ")" : "`" short "`"
      printf "| %s | %s | %s |\n", link, esc(subj), (files == "" ? "(no file changes)" : files)
    }
    /^@@/ {
      flush()
      sp = index($0, " ")
      sha = substr($0, 3, sp - 3); short = substr(sha, 1, 7); subj = substr($0, sp + 1); files = ""
      next
    }
    /^$/ { next }
    {
      n = split($0, f, "\t")
      path = (n >= 3) ? f[2] " -> " f[3] : f[2]
      files = files (files == "" ? "" : "<br>") "`" substr(f[1], 1, 1) "` `" esc(path) "`: WHY?"
    }
    END { flush() }'
if [ "$FOLD" -eq 1 ]; then
  printf '\n</details>\n'
fi
