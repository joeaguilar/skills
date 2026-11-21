#!/usr/bin/env bash
# preflight.sh — is this project in order for task-for-review work?
#
# One read-only pass over a project, run before any work starts. It prints
# `key: value` facts (a key that can hold several values repeats, one per line),
# then one `blocker:` line for each thing that would stop the work from reaching a
# reviewable PR, one `warn:` line for each thing worth knowing or fixing first, and
# a final `ready: yes|no`. Every blocker and warning names its fix after `->`.
# Nothing is written, fetched, staged or fixed: the caller acts on what it reads.
#
# Usage: preflight.sh [ROOT]
#   ROOT   project to inspect (default: the current directory)
# Exit: 0 ready, 1 at least one blocker, 2 usage error.
#
# Lines (in this order; `…` marks a key that repeats):
#   root                  absolute path inspected
#   git                   present | absent
#   head                  short sha | none (no commits yet)
#   identity              `Name <email>` | missing
#   update-refs           yes | no   (git >= 2.38, needed by `git rebase --update-refs`)
#   main-branch           the branch reviewed PRs merge into
#   main-checkout         path of the main checkout (the human's)
#   main-checkout-branch  branch checked out there | detached
#   main-checkout-dirty   count of uncommitted paths there
#   cwd                   main-checkout | worktree
#   worktree …            `<path> <branch>`: a linked worktree that already exists
#   worktrees-ignored     yes | no   (.claude/worktrees/ is gitignored)
#   opt-in                yes | no   (AGENTS.md or CLAUDE.md carries the opt-in line)
#   pr-template           path | absent
#   glossary              glossary.md | absent
#   tracker               as blitz's preflight.sh reports it | unknown
#   verify-gate           as blitz's preflight.sh reports it | unknown
#   remote …              `<name> <github|gitea|other|local> <url>` | none
#   remote-push …         the same, for a push URL that differs from the fetch URL
#   host-cli …            `gh ready|not-logged-in|absent`, `gitea ready|no-token|absent`
#   assets-branch         local | remote | absent   (the orphan review-assets branch)
#   blocker …, warn …     see above
#   ready                 yes | no
#
# Test hooks: TFR_GH and TFR_GITEA name the gh binary and the gitea helper to probe;
# TFR_GITEA_HOST names the Gitea server's hostname.
set -u

# Read-only means the index too: without this, `git status` refreshes cached stat
# data and rewrites .git/index. It also covers the scripts this one calls.
export GIT_OPTIONAL_LOCKS=0

ROOT=""
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
    -*) printf 'preflight: unknown option %s\n' "$1" >&2; exit 2 ;;
    *) [ -z "$ROOT" ] || { echo "preflight: only one ROOT may be given" >&2; exit 2; }
       ROOT="$1"; shift ;;
  esac
done
[ -n "$ROOT" ] || ROOT="."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"
if ! cd "$ROOT" 2>/dev/null; then
  printf 'preflight: cannot enter %s\n' "$ROOT" >&2
  exit 2
fi
ROOT="$(pwd -P)"

ASSETS_BRANCH="review-assets"
BLOCKERS=""
WARNS=""
blocker() { BLOCKERS="${BLOCKERS}blocker: $1"$'\n'; }
warn() { WARNS="${WARNS}warn: $1"$'\n'; }
finish() {
  printf '%s%s' "$BLOCKERS" "$WARNS"
  if [ -n "$BLOCKERS" ]; then echo "ready: no"; exit 1; fi
  echo "ready: yes"; exit 0
}

echo "root: $ROOT"

# --- repository ---------------------------------------------------------------
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "git: absent"
  blocker "not a git repository -> run seed.sh to create and seed it"
  finish
fi
echo "git: present"
# Everything below is asked of the checkout as a whole, so stand at its top: an
# ignore rule or a file is looked up from there, not from a subfolder.
TOP="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -n "$TOP" ] && ! cd "$TOP" 2>/dev/null; then
  printf 'preflight: cannot enter %s\n' "$TOP" >&2
  exit 2
fi

HEAD_SHA="$(git rev-parse --short HEAD 2>/dev/null || true)"
if [ -z "$HEAD_SHA" ]; then
  echo "head: none"
  blocker "the repository has no commits, so there is nothing to branch from -> run seed.sh"
else
  echo "head: $HEAD_SHA"
fi

ID_NAME="$(git config user.name 2>/dev/null || true)"
ID_EMAIL="$(git config user.email 2>/dev/null || true)"
if [ -n "$ID_NAME" ] && [ -n "$ID_EMAIL" ]; then
  echo "identity: $ID_NAME <$ID_EMAIL>"
else
  echo "identity: missing"
  blocker "git user.name or user.email is not set, so commits would fail -> ask the user to set their git identity"
fi

GIT_VER="$(git version | sed 's/^git version //')"
GIT_MAJOR="${GIT_VER%%.*}"
GIT_REST="${GIT_VER#*.}"
GIT_MINOR="${GIT_REST%%.*}"
case "$GIT_MAJOR$GIT_MINOR" in *[!0-9]*|'') GIT_MAJOR=0; GIT_MINOR=0 ;; esac
if [ "$GIT_MAJOR" -gt 2 ] || { [ "$GIT_MAJOR" -eq 2 ] && [ "$GIT_MINOR" -ge 38 ]; }; then
  echo "update-refs: yes"
else
  echo "update-refs: no"
  warn "git $GIT_VER has no 'rebase --update-refs' -> restack each branch of a stack by hand, or update git"
fi

# --- main branch and main checkout ---------------------------------------------
MAIN_CHECKOUT="$(git worktree list --porcelain 2>/dev/null | sed -n '1s/^worktree //p')"
MAIN_CHECKOUT_BRANCH="$(git -C "$MAIN_CHECKOUT" symbolic-ref -q --short HEAD 2>/dev/null || echo detached)"
MAIN_BRANCH="$(tfr_main_branch)"
[ -n "$MAIN_BRANCH" ] || MAIN_BRANCH="$MAIN_CHECKOUT_BRANCH"
MAIN_DIRTY="$(git -C "$MAIN_CHECKOUT" status --porcelain 2>/dev/null | grep -c . || true)"
echo "main-branch: $MAIN_BRANCH"
echo "main-checkout: $MAIN_CHECKOUT"
echo "main-checkout-branch: $MAIN_CHECKOUT_BRANCH"
echo "main-checkout-dirty: $MAIN_DIRTY"
if [ "$MAIN_CHECKOUT_BRANCH" != "$MAIN_BRANCH" ]; then
  warn "the main checkout is on '$MAIN_CHECKOUT_BRANCH', not '$MAIN_BRANCH' -> tell the user; do not switch it for them"
fi
if [ "$MAIN_DIRTY" -gt 0 ]; then
  warn "the main checkout has $MAIN_DIRTY uncommitted path(s); a new worktree starts from the last commit and will not contain them -> tell the user"
fi

GIT_DIR_ABS="$(git rev-parse --path-format=absolute --git-dir 2>/dev/null)"
GIT_COMMON_ABS="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"
if [ "$GIT_DIR_ABS" = "$GIT_COMMON_ABS" ]; then echo "cwd: main-checkout"; else echo "cwd: worktree"; fi

git worktree list --porcelain 2>/dev/null | awk '
  /^worktree / { path = substr($0, 10); n++; next }
  /^branch /   { if (n > 1) print "worktree: " path " " substr($0, 19); next }
  /^detached/  { if (n > 1) print "worktree: " path " detached" }'

# --- seeded scaffolding ---------------------------------------------------------
if git check-ignore -q .claude/worktrees/probe 2>/dev/null; then
  echo "worktrees-ignored: yes"
else
  echo "worktrees-ignored: no"
  warn ".claude/worktrees/ is not gitignored, so every worktree shows up as untracked files -> run seed.sh (it adds only what is missing)"
fi

# The whole sentence, so a line that only mentions the mode is not an opt-in.
if tfr_has_opt_in "$TOP/AGENTS.md" "$TOP/CLAUDE.md"; then
  echo "opt-in: yes"
else
  echo "opt-in: no"
fi

PR_TEMPLATE="absent"
for f in .github/pull_request_template.md .gitea/pull_request_template.md pull_request_template.md docs/pull_request_template.md; do
  if [ -f "$TOP/$f" ]; then PR_TEMPLATE="$f"; break; fi
done
echo "pr-template: $PR_TEMPLATE"
if [ -f "$TOP/glossary.md" ]; then echo "glossary: glossary.md"; else echo "glossary: absent"; fi

# Tracker and verify-gate facts have one home: blitz's preflight.sh.
BLITZ_PF="$SCRIPT_DIR/../../blitz/scripts/preflight.sh"
TRACKER="unknown"
GATE="unknown"
if [ -f "$BLITZ_PF" ]; then
  BLITZ_OUT="$(bash "$BLITZ_PF" "$TOP" 2>/dev/null || true)"
  TRACKER="$(printf '%s\n' "$BLITZ_OUT" | sed -n 's/^tracker: //p' | head -1)"
  GATE="$(printf '%s\n' "$BLITZ_OUT" | sed -n 's/^verify-gate: //p' | head -1)"
fi
echo "tracker: ${TRACKER:-unknown}"
echo "verify-gate: ${GATE:-unknown}"

# --- remotes and the CLI each host needs -----------------------------------------
NEED_GH=0
NEED_GITEA=0
REMOTES="$(git remote 2>/dev/null)"
if [ -z "$REMOTES" ]; then
  echo "remote: none"
else
  note_url() { # key name url -> print the line and record which CLI that host needs
    local shown kind
    shown="$(printf '%s' "$3" | sed 's#://[^/@]*@#://#')"   # never print embedded credentials
    kind="$(tfr_remote_kind "$3")"
    case "$kind" in
      github) NEED_GH=1 ;;
      gitea) NEED_GITEA=1 ;;
      other) warn "remote '$2' is on $(tfr_url_host "$3"), which has no known PR CLI -> push branches there and write each PR description to a file" ;;
    esac
    echo "$1: $2 $kind $shown"
  }
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    url="$(git remote get-url "$name" 2>/dev/null)"
    note_url remote "$name" "$url"
    # A remote may push somewhere other than where it fetches from; branches and
    # PRs go to the push side, so that host's CLI is needed as well.
    while IFS= read -r push_url; do
      if [ -n "$push_url" ] && [ "$push_url" != "$url" ]; then note_url remote-push "$name" "$push_url"; fi
    done <<< "$(git remote get-url --push --all "$name" 2>/dev/null)"
  done <<< "$REMOTES"
fi

if [ "$NEED_GH" -eq 1 ]; then
  GH_BIN="${TFR_GH:-gh}"
  if ! command -v "$GH_BIN" >/dev/null 2>&1; then
    echo "host-cli: gh absent"
    blocker "a remote is on GitHub but the gh CLI is not installed, so no PR can be opened -> ask the user to install gh and run: gh auth login"
  elif "$GH_BIN" auth token --hostname github.com >/dev/null 2>&1; then
    echo "host-cli: gh ready"
  else
    echo "host-cli: gh not-logged-in"
    blocker "a remote is on GitHub but gh is not logged in, so no PR can be opened -> ask the user to run: gh auth login"
  fi
fi
if [ "$NEED_GITEA" -eq 1 ]; then
  if ! tfr_have_gitea_bin; then
    echo "host-cli: gitea absent"
    blocker "a remote is on Gitea but the gitea helper is not installed, so no PR can be opened -> install the gitea skill"
  elif [ -n "${GITEA_TOKEN:-}" ] || [ -s "$HOME/.config/gitea/token" ]; then
    echo "host-cli: gitea ready"
  else
    echo "host-cli: gitea no-token"
    blocker "a remote is on Gitea but no API token is saved, so no PR can be opened -> run 'gitea doctor' and relay its token steps to the user"
  fi
fi

# --- evidence branch -------------------------------------------------------------
if git show-ref --verify -q "refs/heads/$ASSETS_BRANCH"; then
  echo "assets-branch: local"
elif git for-each-ref --format='%(refname)' "refs/remotes/*/$ASSETS_BRANCH" | grep -q .; then
  echo "assets-branch: remote"
else
  echo "assets-branch: absent"
fi

finish
