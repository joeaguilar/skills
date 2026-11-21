#!/usr/bin/env bash
# assets.sh — put a PR's evidence on the orphan review-assets branch and print links.
#
# Screenshots, recordings and (for a project with no PR host) the description file
# itself are committed to a branch that shares no history with the code, so they
# never appear in a diff and never reach main. Each FILE lands at KEY/<file name>;
# a file already there is replaced. The commit is built with git plumbing: the
# working tree, the index and the checked-out branch are not touched.
#
# It refuses, changing nothing, when the assets branch is checked out in a worktree,
# when it shares history with the main branch (a code branch was named by mistake),
# or when two FILEs have the same name. Evidence already on the remote and evidence
# only in this clone are both kept when the two have drifted apart.
#
# Prints one markdown line per FILE, ready to paste into the description: an image
# link for a picture, a plain link otherwise. Links carry the commit hash, so they
# keep working after later evidence is added.
#
# Usage: assets.sh [--remote NAME] [--branch NAME] [--no-push] KEY FILE...
#   KEY            folder on the assets branch, normally the PR's branch name
#   --remote NAME  remote to push to and link against (default: origin, else the first)
#   --branch NAME  assets branch name (default: review-assets)
#   --no-push      commit locally only
# Exit: 0 done, 1 failed (reason on stderr), 2 usage error.
#
# A recording renders inline only as a GIF: hosts do not play a video file linked
# from a repository.
#
# Test hook: TFR_GITEA names the gitea helper used to find a Gitea repo's web URL.
set -u

REMOTE=""
BRANCH="review-assets"
PUSH=1
ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --remote) REMOTE="${2:?--remote needs a name}"; shift 2 ;;
    --branch) BRANCH="${2:?--branch needs a name}"; shift 2 ;;
    --no-push) PUSH=0; shift ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
    --) shift; while [ $# -gt 0 ]; do ARGS+=("$1"); shift; done ;;
    -*) printf 'assets: unknown option %s\n' "$1" >&2; exit 2 ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
[ "${#ARGS[@]}" -ge 2 ] || { echo "usage: assets.sh [--remote NAME] [--branch NAME] [--no-push] KEY FILE..." >&2; exit 2; }
KEY="${ARGS[0]}"
KEY="${KEY#/}"; KEY="${KEY%/}"
case "$KEY" in ''|*..*) echo "assets: KEY must be a plain folder path" >&2; exit 2 ;; esac
FILES=("${ARGS[@]:1}")
SEEN_NAMES=$'\n'
for f in "${FILES[@]}"; do
  [ -f "$f" ] || { echo "assets: no such file $f" >&2; exit 1; }
  name="$(basename "$f")"
  case "$SEEN_NAMES" in
    *$'\n'"$name"$'\n'*) echo "assets: two files are named $name and would land on the same path; rename one" >&2; exit 2 ;;
  esac
  SEEN_NAMES="$SEEN_NAMES$name"$'\n'
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "assets: not a git repository" >&2; exit 1; }

if [ -z "$REMOTE" ]; then
  REMOTE="$(tfr_default_remote)"
elif ! git remote | grep -qxF -- "$REMOTE"; then
  echo "assets: no remote named $REMOTE" >&2; exit 1
fi

# --- the destination must be a free-standing assets branch nobody has checked out ------
if git worktree list --porcelain | grep -qxF "branch refs/heads/$BRANCH"; then
  echo "assets: $BRANCH is checked out in a worktree, and moving it would leave that checkout stale. Remove that worktree, or check the branch out with --detach, and run again." >&2
  exit 1
fi
MAIN_NAME="$(tfr_main_branch)"
if [ -n "$MAIN_NAME" ] && [ "$BRANCH" = "$MAIN_NAME" ]; then
  echo "assets: $BRANCH is the main branch, not an assets branch. No branch was moved." >&2
  exit 1
fi
if [ -n "$REMOTE" ] && [ "$PUSH" -eq 1 ]; then
  # Reconcile with the repository the push goes to. When a remote pushes somewhere
  # other than where it fetches from, that is the push URL, not the remote's name.
  FETCH_FROM="$REMOTE"
  PUSH_URL="$(git remote get-url --push "$REMOTE" 2>/dev/null | head -1)"
  [ -n "$PUSH_URL" ] && [ "$PUSH_URL" != "$(git remote get-url "$REMOTE" 2>/dev/null)" ] && FETCH_FROM="$PUSH_URL"
  git fetch -q "$FETCH_FROM" "+refs/heads/$BRANCH:refs/remotes/$REMOTE/$BRANCH" 2>/dev/null || true
fi
REMOTE_TIP=""
LOCAL_TIP=""
if [ -n "$REMOTE" ] && git show-ref --verify -q "refs/remotes/$REMOTE/$BRANCH"; then
  REMOTE_TIP="$(git rev-parse "refs/remotes/$REMOTE/$BRANCH")"
fi
if git show-ref --verify -q "refs/heads/$BRANCH"; then
  LOCAL_TIP="$(git rev-parse "refs/heads/$BRANCH")"
fi
# Code history is whatever the main branch (here or on a remote) or the current
# branch can reach. An assets tip that shares a commit with any of them is a code
# branch named by mistake; a comparison that cannot be made is refused too.
CODE_REFS=()
if [ -n "$MAIN_NAME" ]; then
  CODE_REFS+=("refs/heads/$MAIN_NAME" "refs/remotes/origin/$MAIN_NAME")
  [ -n "$REMOTE" ] && CODE_REFS+=("refs/remotes/$REMOTE/$MAIN_NAME")
fi
CODE_REFS+=("HEAD")
# A shallow clone hides ancestry, so "no shared commit" proves nothing there. Fall
# back on the mark this script leaves: every commit it makes has this subject.
if [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = "true" ]; then
  for tip in "$REMOTE_TIP" "$LOCAL_TIP"; do
    [ -z "$tip" ] && continue
    case "$(git log -1 --format=%s "$tip" 2>/dev/null)" in
      'chore(review-assets):'*) ;;
      *) echo "assets: this clone is shallow, so $BRANCH cannot be shown to be free of code history, and its newest commit is not one this script made. No branch was moved." >&2
         exit 1 ;;
    esac
  done
fi
for tip in "$REMOTE_TIP" "$LOCAL_TIP"; do
  [ -z "$tip" ] && continue
  for ref in "${CODE_REFS[@]}"; do
    git rev-parse -q --verify "$ref^{commit}" >/dev/null 2>&1 || continue
    git merge-base "$tip" "$ref" >/dev/null 2>&1; rc=$?
    if [ "$rc" -eq 0 ]; then
      echo "assets: $BRANCH shares history with ${ref#refs/heads/}, so it is a code branch, not an assets branch. No branch was moved." >&2
      exit 1
    elif [ "$rc" -ne 1 ]; then
      echo "assets: cannot compare $BRANCH with ${ref#refs/heads/}, so it cannot be shown to be an assets branch. No branch was moved." >&2
      exit 1
    fi
  done
done

# --- the commit(s) the new one sits on -----------------------------------------------
# One parent normally. When this clone and the remote each hold evidence the other
# lacks, both become parents and the two are merged against what they share, so a
# change made on either side survives and the push stays a fast-forward.
PARENTS=()
DIVERGED=0
if [ -n "$REMOTE_TIP" ] && [ -n "$LOCAL_TIP" ]; then
  if git merge-base --is-ancestor "$REMOTE_TIP" "$LOCAL_TIP" 2>/dev/null; then PARENTS=("$LOCAL_TIP")
  elif git merge-base --is-ancestor "$LOCAL_TIP" "$REMOTE_TIP" 2>/dev/null; then PARENTS=("$REMOTE_TIP")
  else PARENTS=("$REMOTE_TIP" "$LOCAL_TIP"); DIVERGED=1
  fi
elif [ -n "$REMOTE_TIP" ]; then PARENTS=("$REMOTE_TIP")
elif [ -n "$LOCAL_TIP" ]; then PARENTS=("$LOCAL_TIP")
fi

# --- build the tree in a private index ------------------------------------------------
TMP_INDEX="$(git rev-parse --path-format=absolute --git-dir)/tfr-assets-index.$$"
trap 'rm -f "$TMP_INDEX" "$TMP_INDEX.lock"' EXIT
export GIT_INDEX_FILE="$TMP_INDEX"
if [ "$DIVERGED" -eq 1 ]; then
  # A three-way merge of the two trees against their common ancestor (an empty
  # tree when they share none). -i: this index has nothing to do with the worktree.
  BASE="$(git merge-base "$REMOTE_TIP" "$LOCAL_TIP" 2>/dev/null || true)"
  if [ -n "$BASE" ]; then BASE_TREE="$BASE^{tree}"; else BASE_TREE="$(git mktree < /dev/null)"; fi
  git read-tree -i -m --aggressive "$BASE_TREE" "$REMOTE_TIP^{tree}" "$LOCAL_TIP^{tree}" \
    || { echo "assets: cannot merge the local and remote $BRANCH" >&2; exit 1; }
elif [ "${#PARENTS[@]}" -gt 0 ]; then
  git read-tree "${PARENTS[0]}" || { echo "assets: cannot read $BRANCH" >&2; exit 1; }
fi
PATHS=()
for f in "${FILES[@]}"; do
  blob="$(git hash-object -w --no-filters -- "$f")" || { echo "assets: cannot store $f" >&2; exit 1; }
  path="$KEY/$(basename "$f")"
  # A file given now settles any clash on its own path: this is the version to keep.
  git update-index --force-remove -- "$path" 2>/dev/null || true
  git update-index --add --cacheinfo "100644,$blob,$path" || { echo "assets: cannot stage $path" >&2; exit 1; }
  PATHS+=("$path")
done
CLASHES="$(git ls-files -u | cut -f2 | sort -u)"
if [ -n "$CLASHES" ]; then
  {
    echo "assets: this clone and $REMOTE each changed the same evidence in different ways:"
    printf '%s\n' "$CLASHES" | sed 's/^/assets:   /'
    echo "assets: no branch was moved. Run again with the version to keep as a FILE under its KEY."
  } >&2
  exit 1
fi
TREE="$(git write-tree)" || { echo "assets: cannot write the tree" >&2; exit 1; }
unset GIT_INDEX_FILE

if [ "${#PARENTS[@]}" -eq 1 ] && [ "$TREE" = "$(git rev-parse "${PARENTS[0]}^{tree}")" ]; then
  COMMIT="${PARENTS[0]}"   # every file is already there, byte for byte
else
  PARENT_ARGS=()
  for p in ${PARENTS[@]+"${PARENTS[@]}"}; do PARENT_ARGS+=(-p "$p"); done
  COMMIT="$(git commit-tree "$TREE" ${PARENT_ARGS[@]+"${PARENT_ARGS[@]}"} -m "chore(review-assets): add evidence for $KEY")"
  [ -n "$COMMIT" ] || { echo "assets: cannot create the commit (is the git identity set?)" >&2; exit 1; }
fi
git update-ref "refs/heads/$BRANCH" "$COMMIT" || { echo "assets: cannot update $BRANCH" >&2; exit 1; }

if [ -n "$REMOTE" ] && [ "$PUSH" -eq 1 ]; then
  if ! git push -q "$REMOTE" "refs/heads/$BRANCH:refs/heads/$BRANCH"; then
    echo "assets: push to $REMOTE failed; the evidence is committed locally on $BRANCH. Run again to retry." >&2
    exit 1
  fi
fi

# --- links ---------------------------------------------------------------------------
PREFIX=""
SUFFIX=""
if [ -n "$REMOTE" ]; then
  # The push URL: the links must point at the host the evidence was pushed to.
  url="$(git remote get-url --push "$REMOTE" 2>/dev/null | head -1)"
  web="$(tfr_web_base "$url")"
  case "$(tfr_remote_kind "$url")" in
    github) PREFIX="$web/blob/$COMMIT/"; SUFFIX="?raw=true" ;;
    gitea) [ -n "$web" ] && PREFIX="$web/raw/commit/$COMMIT/" ;;
  esac
fi
for path in "${PATHS[@]}"; do
  name="$(basename "$path")"
  if [ -n "$PREFIX" ]; then
    link="$PREFIX$(tfr_urlencode_path "$path")$SUFFIX"
  else
    link="./$(tfr_urlencode_path "$name")"   # no PR host: the description sits beside its evidence on the branch
  fi
  label="${name//\[/\\[}"; label="${label//\]/\\]}"
  case "$name" in
    *.png|*.PNG|*.jpg|*.JPG|*.jpeg|*.JPEG|*.gif|*.GIF|*.webp|*.WEBP|*.svg|*.SVG) printf '![%s](%s)\n' "$label" "$link" ;;
    *) printf '[%s](%s)\n' "$label" "$link" ;;
  esac
done
