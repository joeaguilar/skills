#!/usr/bin/env bash
# Self-test for claude/skills/task-for-review/scripts: preflight.sh, seed.sh,
# changelog.sh and assets.sh. Builds throwaway repos in a temp directory, runs each
# script against them and checks what it prints and what it leaves on disk. Uses its
# own git config and stub gh / gitea / itr binaries, so it never reads the machine's
# identity, hooks, logins or network.
#
# Usage: claude/scripts/test-task-for-review.sh [path/to/task-for-review/scripts]
set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
S="${1:-$REPO_DIR/claude/skills/task-for-review/scripts}"
[ -f "$S/preflight.sh" ] || { echo "test-task-for-review: no scripts at $S" >&2; exit 2; }
S="$(cd "$S" && pwd -P)"

# Git variables inherited from a hook or a wrapper (GIT_DIR, GIT_INDEX_FILE,
# GIT_WORK_TREE, injected config …) outrank `git -C` and would point the throwaway
# repos below at a real one. Drop them before the first git command.
# shellcheck disable=SC2046
unset $(git rev-parse --local-env-vars 2>/dev/null) 2>/dev/null || true
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES \
  GIT_COMMON_DIR GIT_NAMESPACE GIT_PREFIX GIT_CONFIG GIT_CONFIG_PARAMETERS GIT_CONFIG_COUNT 2>/dev/null || true

# The cleanup below is `rm -rf "$WORK"`, so WORK must be the directory mktemp just
# made and nothing else: an empty WORK once resolved to the caller's directory.
WORK="$(mktemp -d "${TMPDIR:-/tmp}/tfr-test.XXXXXX")" || { echo "test-task-for-review: cannot create a temp directory" >&2; exit 2; }
[ -n "$WORK" ] && [ -d "$WORK" ] || { echo "test-task-for-review: mktemp returned no directory" >&2; exit 2; }
WORK="$(cd "$WORK" && pwd -P)" || exit 2
case "$WORK" in
  */tfr-test.*) ;;
  *) echo "test-task-for-review: refusing to use $WORK as a scratch directory" >&2; exit 2 ;;
esac
trap 'rm -rf "$WORK"' EXIT
pass=0
fail=0

# A private git config: a fixed identity, no hooks, nothing from the machine.
printf '[user]\n\tname = Test Person\n\temail = test@example.invalid\n[init]\n\tdefaultBranch = main\n[core]\n\tautocrlf = false\n' > "$WORK/gitconfig"
: > "$WORK/gitconfig-empty"
export GIT_CONFIG_GLOBAL="$WORK/gitconfig"
export GIT_CONFIG_NOSYSTEM=1
export HOME="$WORK/home"
mkdir -p "$HOME" "$WORK/bin"
unset GITEA_TOKEN

stub() { # name body... -> an executable script in $WORK/bin
  local name="$1"; shift
  { echo '#!/usr/bin/env bash'; printf '%s\n' "$@"; } > "$WORK/bin/$name"
  chmod +x "$WORK/bin/$name"
}
stub gh-ok 'exit 0'
stub gh-fail 'exit 1'
stub gitea-stub 'if [ "$1" = "url" ]; then echo "http://gitea.test:3000/blue/proj"; fi'
stub itr-stub 'while [ $# -gt 0 ]; do if [ "$1" = "--db" ]; then : > "$2"; fi; shift; done'
export TFR_GITEA="$WORK/bin/gitea-stub"
export TFR_GITEA_HOST="gitea.test"
export TFR_ITR="$WORK/bin/no-such-itr"

ok() { pass=$((pass+1)); }
bad() { fail=$((fail+1)); printf 'FAIL %s\n' "$1"; shift; [ $# -gt 0 ] && printf '  %s\n' "$@"; }
# expect LABEL OUTPUT LINE — the output must hold LINE exactly.
expect() {
  if printf '%s\n' "$2" | grep -qxF -- "$3"; then ok
  else bad "$1" "wanted line: $3" "got:" "$(printf '%s\n' "$2" | sed 's/^/    /')"; fi
}
# expect_has LABEL OUTPUT TEXT — some line of the output must contain TEXT.
expect_has() {
  if printf '%s\n' "$2" | grep -qF -- "$3"; then ok
  else bad "$1" "wanted text: $3" "got:" "$(printf '%s\n' "$2" | sed 's/^/    /')"; fi
}
# refuse LABEL OUTPUT TEXT — no line of the output may contain TEXT.
refuse() {
  if printf '%s\n' "$2" | grep -qF -- "$3"; then bad "$1" "unwanted text: $3" "got:" "$(printf '%s\n' "$2" | sed 's/^/    /')"
  else ok; fi
}
# same LABEL GOT WANT
same() {
  if [ "$2" = "$3" ]; then ok; else bad "$1" "wanted: $3" "got:    $2"; fi
}
repo() { # name -> a fresh repo on main with one commit
  mkdir -p "$WORK/$1"
  git -C "$WORK/$1" init -q -b main
  git -C "$WORK/$1" commit -q --allow-empty -m "chore(base): start"
}
put() { # dir path content -> write a file and commit it
  mkdir -p "$(dirname "$1/$2")"
  printf '%s\n' "$3" > "$1/$2"
  git -C "$1" add -- "$2"
  git -C "$1" commit -q -m "${4:-chore(test): add $2}"
}

# =============================================================================
# preflight.sh
# =============================================================================
PF="$S/preflight.sh"

# --- not a repository ----------------------------------------------------------
mkdir -p "$WORK/plain"
out="$(bash "$PF" "$WORK/plain")"; code=$?
expect "plain: git absent" "$out" "git: absent"
expect_has "plain: blocker names the seed" "$out" "blocker: not a git repository -> run seed.sh"
expect "plain: not ready" "$out" "ready: no"
same "plain: exit 1" "$code" "1"

# --- a repository with no commits ------------------------------------------------
mkdir -p "$WORK/empty"; git -C "$WORK/empty" init -q -b main
out="$(bash "$PF" "$WORK/empty")"; code=$?
expect "empty: head none" "$out" "head: none"
expect_has "empty: blocker" "$out" "blocker: the repository has no commits"
same "empty: exit 1" "$code" "1"

# --- a bare-bones repository: ready, with the missing ignore entry as a warning --
repo bare1
out="$(bash "$PF" "$WORK/bare1")"; code=$?
expect "bare1: git present" "$out" "git: present"
expect "bare1: identity" "$out" "identity: Test Person <test@example.invalid>"
expect "bare1: main branch" "$out" "main-branch: main"
expect "bare1: main checkout branch" "$out" "main-checkout-branch: main"
expect "bare1: clean" "$out" "main-checkout-dirty: 0"
expect "bare1: cwd" "$out" "cwd: main-checkout"
expect "bare1: worktrees not ignored" "$out" "worktrees-ignored: no"
expect_has "bare1: warn points at seed" "$out" "warn: .claude/worktrees/ is not gitignored"
expect "bare1: no opt-in" "$out" "opt-in: no"
expect "bare1: no template" "$out" "pr-template: absent"
expect "bare1: no glossary" "$out" "glossary: absent"
expect "bare1: no remote" "$out" "remote: none"
expect "bare1: no assets branch" "$out" "assets-branch: absent"
refuse "bare1: no blocker" "$out" "blocker:"
refuse "bare1: no host-cli line without a remote" "$out" "host-cli:"
expect "bare1: ready" "$out" "ready: yes"
same "bare1: exit 0" "$code" "0"

# --- identity missing ----------------------------------------------------------
out="$(GIT_CONFIG_GLOBAL="$WORK/gitconfig-empty" bash "$PF" "$WORK/bare1")"; code=$?
expect "no identity: fact" "$out" "identity: missing"
expect_has "no identity: blocker" "$out" "blocker: git user.name or user.email is not set"
same "no identity: exit 1" "$code" "1"

# --- dirty main checkout, on the wrong branch ---------------------------------------
repo dirty
printf 'x\n' > "$WORK/dirty/loose.txt"
git -C "$WORK/dirty" switch -q -c side
out="$(bash "$PF" "$WORK/dirty")"
expect "dirty: count" "$out" "main-checkout-dirty: 1"
expect_has "dirty: warn" "$out" "warn: the main checkout has 1 uncommitted path(s)"
expect "dirty: branch fact" "$out" "main-checkout-branch: side"
expect_has "dirty: wrong-branch warn" "$out" "warn: the main checkout is on 'side', not 'main'"
expect "dirty: still ready" "$out" "ready: yes"

# --- linked worktrees are listed; cwd is told apart -----------------------------------
repo wt
printf '.claude/worktrees/\n' > "$WORK/wt/.gitignore"
git -C "$WORK/wt" add .gitignore; git -C "$WORK/wt" commit -q -m "chore(test): ignore worktrees"
git -C "$WORK/wt" worktree add -q "$WORK/wt/.claude/worktrees/alpha" -b feat/alpha
out="$(bash "$PF" "$WORK/wt")"
expect "wt: ignored" "$out" "worktrees-ignored: yes"
expect_has "wt: lists the worktree" "$out" ".claude/worktrees/alpha feat/alpha"
expect "wt: main checkout stays clean" "$out" "main-checkout-dirty: 0"
expect "wt: cwd main" "$out" "cwd: main-checkout"
out="$(bash "$PF" "$WORK/wt/.claude/worktrees/alpha")"
expect "wt: cwd worktree" "$out" "cwd: worktree"
expect "wt: main checkout branch seen from the worktree" "$out" "main-checkout-branch: main"

# --- GitHub remote: gh logged in, logged out, absent; credentials never printed ------
repo gh1
git -C "$WORK/gh1" remote add origin "https://someone:s3cr3t-token@github.com/acme/widget.git"
out="$(TFR_GH="$WORK/bin/gh-ok" bash "$PF" "$WORK/gh1")"; code=$?
expect "gh ok: remote line" "$out" "remote: origin github https://github.com/acme/widget.git"
refuse "gh ok: token hidden" "$out" "s3cr3t-token"
expect "gh ok: ready cli" "$out" "host-cli: gh ready"
same "gh ok: exit 0" "$code" "0"
out="$(TFR_GH="$WORK/bin/gh-fail" bash "$PF" "$WORK/gh1")"; code=$?
expect "gh out: fact" "$out" "host-cli: gh not-logged-in"
expect_has "gh out: blocker with the fix" "$out" "-> ask the user to run: gh auth login"
expect "gh out: not ready" "$out" "ready: no"
same "gh out: exit 1" "$code" "1"
out="$(TFR_GH="$WORK/bin/no-such-gh" bash "$PF" "$WORK/gh1")"; code=$?
expect "gh absent: fact" "$out" "host-cli: gh absent"
same "gh absent: exit 1" "$code" "1"

# --- Gitea remote: by alias and by hostname; token present or not ---------------------
repo gt1
git -C "$WORK/gt1" remote add gitea "gitea:blue/proj.git"
out="$(bash "$PF" "$WORK/gt1")"; code=$?
expect "gitea alias: kind" "$out" "remote: gitea gitea gitea:blue/proj.git"
expect "gitea alias: no token" "$out" "host-cli: gitea no-token"
same "gitea alias: exit 1" "$code" "1"
out="$(GITEA_TOKEN=abc bash "$PF" "$WORK/gt1")"; code=$?
expect "gitea token env: ready" "$out" "host-cli: gitea ready"
same "gitea token env: exit 0" "$code" "0"
mkdir -p "$HOME/.config/gitea"; printf 'abc\n' > "$HOME/.config/gitea/token"
out="$(bash "$PF" "$WORK/gt1")"
expect "gitea token file: ready" "$out" "host-cli: gitea ready"
rm -rf "$HOME/.config"
git -C "$WORK/gt1" remote set-url gitea "ssh://git@gitea.test:2222/blue/proj.git"
out="$(bash "$PF" "$WORK/gt1")"
expect "gitea host: kind" "$out" "remote: gitea gitea ssh://gitea.test:2222/blue/proj.git"
out="$(TFR_GITEA="$WORK/bin/no-such-gitea" bash "$PF" "$WORK/gt1")"
expect "gitea helper absent" "$out" "host-cli: gitea absent"

# --- an unknown host warns; a local-path remote is local ------------------------------
repo oth
git -C "$WORK/oth" remote add origin "git@gitlab.example:acme/widget.git"
git init -q --bare "$WORK/oth-bare.git"
git -C "$WORK/oth" remote add disk "$WORK/oth-bare.git"
out="$(bash "$PF" "$WORK/oth")"; code=$?
expect "other: kind" "$out" "remote: origin other git@gitlab.example:acme/widget.git"
expect_has "other: warn" "$out" "warn: remote 'origin' is on gitlab.example"
expect_has "local: kind" "$out" "remote: disk local "
same "other: exit 0" "$code" "0"

# =============================================================================
# seed.sh
# =============================================================================
SEED="$S/seed.sh"

# --- a brand-new folder -----------------------------------------------------------
mkdir -p "$WORK/newproj"
printf 'mine\n' > "$WORK/newproj/notes.txt"          # the user's own file: not the seed's to commit
out="$(bash "$SEED" --name "Widget Works" "$WORK/newproj")"; code=$?
same "seed new: exit 0" "$code" "0"
expect "seed new: mode" "$out" "mode: new"
expect "seed new: created AGENTS" "$out" "created: AGENTS.md"
expect "seed new: tracker" "$out" "tracker: none (itr is not installed)"
expect_has "seed new: committed" "$out" "chore(seed): add task-for-review scaffolding"
expect_has "seed new: next remotes" "$out" "next: create the remote(s) and push main"
same "seed new: branch" "$(git -C "$WORK/newproj" symbolic-ref --short HEAD)" "main"
same "seed new: one commit" "$(git -C "$WORK/newproj" rev-list --count HEAD)" "1"
same "seed new: subject" "$(git -C "$WORK/newproj" log -1 --format=%s)" "chore(seed): add task-for-review scaffolding"
same "seed new: no body" "$(git -C "$WORK/newproj" log -1 --format=%b)" ""
same "seed new: tracked files" "$(git -C "$WORK/newproj" ls-files | sort | tr '\n' ' ')" \
  ".github/pull_request_template.md .gitignore AGENTS.md CLAUDE.md glossary.md "
expect "seed new: ignore entry" "$(cat "$WORK/newproj/.gitignore")" ".claude/worktrees/"
expect "seed new: name filled in" "$(cat "$WORK/newproj/AGENTS.md")" "# Widget Works"
expect "seed new: opt-in line" "$(cat "$WORK/newproj/AGENTS.md")" \
  "This project works in task-for-review mode: load the task-for-review skill before changing any tracked file."
expect "seed new: CLAUDE imports AGENTS" "$(cat "$WORK/newproj/CLAUDE.md")" "@AGENTS.md"
refuse "seed new: no placeholder left" "$(cat "$WORK/newproj/AGENTS.md" "$WORK/newproj/CLAUDE.md" "$WORK/newproj/glossary.md")" "{{name}}"
expect "seed new: template sections" "$(cat "$WORK/newproj/.github/pull_request_template.md")" "## Breadcrumbs"
same "seed new: user file left untracked" "$(git -C "$WORK/newproj" status --porcelain)" "?? notes.txt"

# The seeded project satisfies the preflight.
out="$(bash "$PF" "$WORK/newproj")"; code=$?
expect "seeded: opt-in" "$out" "opt-in: yes"
expect "seeded: ignored" "$out" "worktrees-ignored: yes"
expect "seeded: template" "$out" "pr-template: .github/pull_request_template.md"
expect "seeded: glossary" "$out" "glossary: glossary.md"
refuse "seeded: no ignore warning" "$out" "is not gitignored"
same "seeded: exit 0" "$code" "0"

# --- running it again changes nothing -------------------------------------------------
before="$(git -C "$WORK/newproj" rev-parse HEAD)"
out="$(bash "$SEED" "$WORK/newproj")"; code=$?
same "seed again: exit 0" "$code" "0"
expect "seed again: kept" "$out" "kept: AGENTS.md"
expect_has "seed again: nothing to add" "$out" "next: nothing to add"
refuse "seed again: creates nothing" "$out" "created:"
same "seed again: no new commit" "$(git -C "$WORK/newproj" rev-parse HEAD)" "$before"

# --- a new project with itr installed ---------------------------------------------------
mkdir -p "$WORK/newitr"
out="$(TFR_ITR="$WORK/bin/itr-stub" bash "$SEED" "$WORK/newitr")"
expect "seed itr: tracker" "$out" "tracker: itr (initialised, .itr.db gitignored)"
expect_has "seed itr: next snapshot" "$out" "next: set up the tracker snapshot so issues travel with the repo"
expect "seed itr: db ignored" "$(cat "$WORK/newitr/.gitignore")" ".itr.db"
expect "seed itr: sidecars ignored" "$(cat "$WORK/newitr/.gitignore")" ".itr.db-*"
refuse "seed itr: db not committed" "$(git -C "$WORK/newitr" ls-files)" ".itr.db"
same "seed itr: tree clean" "$(git -C "$WORK/newitr" status --porcelain)" ""

# --- dry run writes nothing --------------------------------------------------------------
mkdir -p "$WORK/dry"
out="$(bash "$SEED" --dry-run "$WORK/dry")"; code=$?
same "seed dry: exit 0" "$code" "0"
expect "seed dry: would create" "$out" "would-create: AGENTS.md"
same "seed dry: folder still empty" "$(ls -A "$WORK/dry")" ""

# --- no identity: refuses before writing ---------------------------------------------------
mkdir -p "$WORK/noid"
out="$(GIT_CONFIG_GLOBAL="$WORK/gitconfig-empty" bash "$SEED" "$WORK/noid" 2>&1)"; code=$?
same "seed no identity: exit 1" "$code" "1"
expect_has "seed no identity: says why" "$out" "git user.name or user.email is not set"
same "seed no identity: nothing written" "$(ls -A "$WORK/noid")" ""

# --- an existing project, from its main checkout: refuses ------------------------------------
repo old
put "$WORK/old" AGENTS.md "# Old project facts"
put "$WORK/old" glossary.md "our own glossary"
before="$(git -C "$WORK/old" rev-parse HEAD)"
out="$(bash "$SEED" "$WORK/old" 2>&1)"; code=$?
same "seed adopt main: exit 1" "$code" "1"
expect_has "seed adopt main: says why" "$out" "this is its main checkout"
expect_has "seed adopt main: lists a missing piece" "$out" "append AGENTS.md"
same "seed adopt main: no commit" "$(git -C "$WORK/old" rev-parse HEAD)" "$before"
same "seed adopt main: tree untouched" "$(git -C "$WORK/old" status --porcelain)" ""

# --- the same project, from a worktree: adds only what is missing ----------------------------
git -C "$WORK/old" worktree add -q "$WORK/old/.claude/worktrees/seed" -b chore/seed
out="$(TFR_ITR="$WORK/bin/itr-stub" bash "$SEED" "$WORK/old/.claude/worktrees/seed")"; code=$?
W="$WORK/old/.claude/worktrees/seed"
same "seed adopt: exit 0" "$code" "0"
expect "seed adopt: mode" "$out" "mode: adopt"
expect "seed adopt: appended opt-in" "$out" "appended: AGENTS.md (opt-in line)"
expect "seed adopt: kept glossary" "$out" "kept: glossary.md"
expect "seed adopt: created CLAUDE" "$out" "created: CLAUDE.md"
expect_has "seed adopt: next PR" "$out" "next: open a PR for this branch"
refuse "seed adopt: no tracker init in a worktree" "$out" "tracker:"
same "seed adopt: no db in the worktree" "$([ -e "$W/.itr.db" ] && echo present || echo absent)" "absent"
same "seed adopt: old AGENTS content kept first" "$(head -1 "$W/AGENTS.md")" "# Old project facts"
expect "seed adopt: opt-in appended" "$(cat "$W/AGENTS.md")" \
  "This project works in task-for-review mode: load the task-for-review skill before changing any tracked file."
same "seed adopt: glossary untouched" "$(cat "$W/glossary.md")" "our own glossary"
same "seed adopt: commit is on the branch" "$(git -C "$W" log -1 --format='%D %s' | sed 's/HEAD -> //')" \
  "chore/seed chore(seed): add task-for-review scaffolding"
same "seed adopt: main did not move" "$(git -C "$WORK/old" rev-parse main)" "$before"
same "seed adopt: worktree clean" "$(git -C "$W" status --porcelain)" ""

# --- an existing CLAUDE.md that does not import AGENTS.md gets the line itself -------------------
repo oldc
put "$WORK/oldc" CLAUDE.md "# Claude notes"
git -C "$WORK/oldc" worktree add -q "$WORK/oldc/.claude/worktrees/seed" -b chore/seed
out="$(bash "$SEED" "$WORK/oldc/.claude/worktrees/seed")"
expect "seed adopt claude: appended" "$out" "appended: CLAUDE.md (opt-in line)"
same "seed adopt claude: first line kept" "$(head -1 "$WORK/oldc/.claude/worktrees/seed/CLAUDE.md")" "# Claude notes"

# =============================================================================
# changelog.sh
# =============================================================================
CL="$S/changelog.sh"
repo cl
put "$WORK/cl" src/a.txt "one" "chore(base): add a"
git -C "$WORK/cl" switch -q -c feat/x
put "$WORK/cl" src/b.txt "two" "feat(x): add b | with a pipe"
git -C "$WORK/cl" mv src/a.txt src/renamed.txt
git -C "$WORK/cl" commit -q -m "refactor(x): rename a"
git -C "$WORK/cl" rm -q src/b.txt
git -C "$WORK/cl" commit -q -m "fix(x): drop b"
sha1="$(git -C "$WORK/cl" rev-parse HEAD~2)"
sha3="$(git -C "$WORK/cl" rev-parse HEAD)"

out="$(cd "$WORK/cl" && bash "$CL")"; code=$?
same "changelog: exit 0" "$code" "0"
same "changelog: header + rule + one row per commit" "$(printf '%s\n' "$out" | grep -c .)" "5"
expect "changelog: header" "$out" "| Commit | Change | Files |"
same "changelog: oldest first" "$(printf '%s\n' "$out" | sed -n 3p)" \
  "| \`${sha1:0:7}\` | feat(x): add b \\| with a pipe | \`A\` \`src/b.txt\`: WHY? |"
expect "changelog: rename row" "$out" \
  "| \`$(git -C "$WORK/cl" rev-parse --short=7 HEAD~1)\` | refactor(x): rename a | \`R\` \`src/a.txt -> src/renamed.txt\`: WHY? |"
expect "changelog: delete row" "$out" "| \`${sha3:0:7}\` | fix(x): drop b | \`D\` \`src/b.txt\`: WHY? |"
refuse "changelog: base commits excluded" "$out" "chore(base): add a"

# An explicit BASE and HEAD narrow the range.
out="$(cd "$WORK/cl" && bash "$CL" HEAD~1 HEAD)"
same "changelog: explicit range has one row" "$(printf '%s\n' "$out" | grep -c 'WHY?')" "1"

# Links follow the remote's host.
git -C "$WORK/cl" remote add origin "git@github.com:acme/widget.git"
out="$(cd "$WORK/cl" && bash "$CL")"
expect_has "changelog: github link" "$out" "[\`${sha3:0:7}\`](https://github.com/acme/widget/commit/$sha3)"
git -C "$WORK/cl" remote set-url origin "ssh://git@gitea.test:2222/blue/proj.git"
out="$(cd "$WORK/cl" && bash "$CL")"
expect_has "changelog: gitea link" "$out" "(http://gitea.test:3000/blue/proj/commit/$sha3)"
git -C "$WORK/cl" remote set-url origin "git@gitlab.example:acme/widget.git"
out="$(cd "$WORK/cl" && bash "$CL")"
refuse "changelog: unknown host gets no link" "$out" "]("

out="$(cd "$WORK/cl" && bash "$CL" --fold)"
expect "changelog: fold summary" "$out" "<summary>Changelog (3 commits)</summary>"
expect "changelog: fold close" "$out" "</details>"

out="$(cd "$WORK/cl" && bash "$CL" HEAD HEAD 2>&1)"; code=$?
same "changelog: empty range exits 1" "$code" "1"

# =============================================================================
# assets.sh
# =============================================================================
AS="$S/assets.sh"
repo as
git init -q --bare "$WORK/as-remote.git"
git -C "$WORK/as" remote add origin "$WORK/as-remote.git"
git -C "$WORK/as" switch -q -c feat/x
put "$WORK/as" code.txt "code"
printf 'PNGDATA\r\n\001\002' > "$WORK/shot.png"
printf 'second' > "$WORK/after shot.png"
printf '# PR\n' > "$WORK/PR.md"
head_before="$(git -C "$WORK/as" rev-parse HEAD)"

out="$(cd "$WORK/as" && bash "$AS" feat/x "$WORK/shot.png")"; code=$?
same "assets: exit 0" "$code" "0"
same "assets: prints a relative image link without a PR host" "$out" "![shot.png](./shot.png)"
same "assets: file is on the branch" "$(git -C "$WORK/as" ls-tree -r --name-only review-assets)" "feat/x/shot.png"
same "assets: bytes are intact" "$(git -C "$WORK/as" cat-file blob review-assets:feat/x/shot.png | git hash-object --stdin)" \
  "$(git hash-object --no-filters "$WORK/shot.png")"
same "assets: branch is an orphan" "$(git -C "$WORK/as" merge-base review-assets feat/x || echo none)" "none"
same "assets: pushed" "$(git -C "$WORK/as-remote.git" rev-parse review-assets)" "$(git -C "$WORK/as" rev-parse review-assets)"
same "assets: checked-out branch unchanged" "$(git -C "$WORK/as" symbolic-ref --short HEAD)" "feat/x"
same "assets: HEAD unchanged" "$(git -C "$WORK/as" rev-parse HEAD)" "$head_before"
same "assets: working tree and index clean" "$(git -C "$WORK/as" status --porcelain)" ""
same "assets: one-line commit" "$(git -C "$WORK/as" log -1 --format='%s|%b' review-assets)" "chore(review-assets): add evidence for feat/x|"

# A second run adds to the first and keeps it.
first="$(git -C "$WORK/as" rev-parse review-assets)"
out="$(cd "$WORK/as" && bash "$AS" feat/y "$WORK/after shot.png" "$WORK/PR.md")"
same "assets: second commit sits on the first" "$(git -C "$WORK/as" rev-parse review-assets^)" "$first"
same "assets: both keys present" "$(git -C "$WORK/as" ls-tree -r --name-only review-assets | sort | tr '\n' ',')" \
  "feat/x/shot.png,feat/y/PR.md,feat/y/after shot.png,"
expect "assets: space is encoded" "$out" "![after shot.png](./after%20shot.png)"
expect "assets: a non-image is a plain link" "$out" "[PR.md](./PR.md)"

# The same bytes again make no new commit.
second="$(git -C "$WORK/as" rev-parse review-assets)"
(cd "$WORK/as" && bash "$AS" feat/x "$WORK/shot.png" >/dev/null)
same "assets: identical evidence adds no commit" "$(git -C "$WORK/as" rev-parse review-assets)" "$second"

# Host links carry the commit hash.
git -C "$WORK/as" remote add hub "https://github.com/acme/widget.git"
out="$(cd "$WORK/as" && bash "$AS" --remote hub --no-push feat/x "$WORK/shot.png")"
same "assets: github link" "$out" "![shot.png](https://github.com/acme/widget/blob/$second/feat/x/shot.png?raw=true)"
git -C "$WORK/as" remote add tea "gitea:blue/proj.git"
out="$(cd "$WORK/as" && bash "$AS" --remote tea --no-push feat/x "$WORK/shot.png")"
same "assets: gitea link" "$out" "![shot.png](http://gitea.test:3000/blue/proj/raw/commit/$second/feat/x/shot.png)"

# A missing file or a bad key fails before anything is committed.
out="$(cd "$WORK/as" && bash "$AS" feat/x "$WORK/nope.png" 2>&1)"; code=$?
same "assets: missing file exits 1" "$code" "1"
out="$(cd "$WORK/as" && bash "$AS" ../escape "$WORK/shot.png" 2>&1)"; code=$?
same "assets: bad key exits 2" "$code" "2"
same "assets: failures added no commit" "$(git -C "$WORK/as" rev-parse review-assets)" "$second"

# =============================================================================
# Cases found by adversarial review (2026-11-21). Each failed before its fix.
# =============================================================================

# --- preflight leaves the index alone, even when git would refresh it -----------------------
repo ro
put "$WORK/ro" file.txt "x"
touch -d '2001-01-01 00:00:00' "$WORK/ro/file.txt"       # same content, new stat data
before="$(git hash-object --no-filters "$WORK/ro/.git/index")"
bash "$PF" "$WORK/ro" >/dev/null
same "preflight: index not rewritten" "$(git hash-object --no-filters "$WORK/ro/.git/index")" "$before"

# --- preflight: host spelling and local paths ---------------------------------------------------
repo kinds
git -C "$WORK/kinds" remote add up "https://GITHUB.COM/acme/r.git"
git -C "$WORK/kinds" remote add fileurl "file://localhost/tmp/r.git"
git -C "$WORK/kinds" remote add relpath "./a:b"
git -C "$WORK/kinds" remote add sshport "ssh://git@github.com:22/acme/r.git"
out="$(TFR_GH="$WORK/bin/gh-fail" bash "$PF" "$WORK/kinds")"
expect "kinds: upper-case host is github" "$out" "remote: up github https://GITHUB.COM/acme/r.git"
expect "kinds: file url is local" "$out" "remote: fileurl local file://localhost/tmp/r.git"
expect "kinds: relative path with a colon is local" "$out" "remote: relpath local ./a:b"
expect "kinds: ssh with a port is github" "$out" "remote: sshport github ssh://github.com:22/acme/r.git"
expect "kinds: the gh blocker fires" "$out" "host-cli: gh not-logged-in"

# --- preflight: a line that merely mentions the mode is not an opt-in ---------------------------
repo nopt
put "$WORK/nopt" AGENTS.md "# Do not enable task-for-review mode for this project."
out="$(bash "$PF" "$WORK/nopt")"
expect "opt-in: a mention is not an opt-in" "$out" "opt-in: no"

# --- seed: the user's staged files stay out of the seed commit ----------------------------------
mkdir -p "$WORK/staged"; git -C "$WORK/staged" init -q -b main
printf 'secret\n' > "$WORK/staged/private.txt"; git -C "$WORK/staged" add private.txt
out="$(bash "$SEED" "$WORK/staged")"; code=$?
same "seed staged: exit 0" "$code" "0"
refuse "seed staged: private file not committed" "$(git -C "$WORK/staged" ls-tree -r --name-only HEAD)" "private.txt"
same "seed staged: private file still staged" "$(git -C "$WORK/staged" status --porcelain)" "A  private.txt"

repo stagedold
git -C "$WORK/stagedold" worktree add -q "$WORK/stagedold/.claude/worktrees/seed" -b chore/seed
printf 'wip\n' > "$WORK/stagedold/.claude/worktrees/seed/wip.txt"
git -C "$WORK/stagedold/.claude/worktrees/seed" add wip.txt
bash "$SEED" "$WORK/stagedold/.claude/worktrees/seed" >/dev/null
refuse "seed staged adopt: unrelated staged file not committed" \
  "$(git -C "$WORK/stagedold/.claude/worktrees/seed" ls-tree -r --name-only HEAD)" "wip.txt"

# --- seed: an existing project is never committed to on main, or on no branch ---------------------
repo onmain
git -C "$WORK/onmain" switch -q -c human
git -C "$WORK/onmain" worktree add -q "$WORK/onmain-wt" main
before="$(git -C "$WORK/onmain" rev-parse main)"
out="$(bash "$SEED" "$WORK/onmain-wt" 2>&1)"; code=$?
same "seed on main in a worktree: exit 1" "$code" "1"
same "seed on main in a worktree: main did not move" "$(git -C "$WORK/onmain" rev-parse main)" "$before"
same "seed on main in a worktree: nothing written" "$(git -C "$WORK/onmain-wt" status --porcelain)" ""
git -C "$WORK/onmain" worktree add -q --detach "$WORK/onmain-det"
out="$(bash "$SEED" "$WORK/onmain-det" 2>&1)"; code=$?
same "seed detached: exit 1" "$code" "1"
same "seed detached: nothing written" "$(git -C "$WORK/onmain-det" status --porcelain)" ""

# --- seed: a folder that already holds the scaffolding still gets its first commit ----------------
mkdir -p "$WORK/pre"; bash "$SEED" "$WORK/pre" >/dev/null; rm -rf "$WORK/pre/.git"
out="$(GIT_CONFIG_GLOBAL="$WORK/gitconfig-empty" bash "$SEED" "$WORK/pre" 2>&1)"; code=$?
same "seed prefilled, no identity: exit 1" "$code" "1"
same "seed prefilled, no identity: no repository made" "$([ -e "$WORK/pre/.git" ] && echo present || echo absent)" "absent"
out="$(bash "$SEED" "$WORK/pre")"; code=$?
same "seed prefilled: exit 0" "$code" "0"
same "seed prefilled: one commit" "$(git -C "$WORK/pre" rev-list --count HEAD 2>/dev/null)" "1"
same "seed prefilled: files still on disk" "$([ -f "$WORK/pre/AGENTS.md" ] && echo present || echo absent)" "present"

# --- seed: a mention of the mode is not the opt-in line ---------------------------------------------
repo mention
put "$WORK/mention" AGENTS.md "# Do not enable task-for-review mode for this project."
git -C "$WORK/mention" worktree add -q "$WORK/mention/.claude/worktrees/seed" -b chore/seed
out="$(bash "$SEED" "$WORK/mention/.claude/worktrees/seed")"
expect "seed mention: opt-in appended" "$out" "appended: AGENTS.md (opt-in line)"

# --- seed: an existing tracker database gets its ignore entries ---------------------------------------
mkdir -p "$WORK/hasdb"; : > "$WORK/hasdb/.itr.db"
out="$(TFR_ITR="$WORK/bin/itr-stub" bash "$SEED" "$WORK/hasdb")"
expect "seed existing db: ignored" "$(cat "$WORK/hasdb/.gitignore")" ".itr.db"
same "seed existing db: tree clean" "$(git -C "$WORK/hasdb" status --porcelain)" ""

# --- seed: a CRLF .gitignore that already holds the entry is left alone --------------------------------
repo crlf
printf '.claude/worktrees/\r\nnode_modules/\r\n' > "$WORK/crlf/.gitignore"
git -C "$WORK/crlf" add .gitignore; git -C "$WORK/crlf" commit -q -m "chore(test): crlf ignore"
git -C "$WORK/crlf" worktree add -q "$WORK/crlf-wt" -b chore/seed
out="$(bash "$SEED" "$WORK/crlf-wt")"
expect "seed crlf: ignore kept" "$out" "kept: .gitignore"

# --- changelog: links survive an ssh port and a trailing slash ------------------------------------------
git -C "$WORK/cl" remote set-url origin "ssh://git@github.com:22/acme/widget.git"
out="$(cd "$WORK/cl" && bash "$CL")"
expect_has "changelog: ssh port dropped from the link" "$out" "(https://github.com/acme/widget/commit/$sha3)"
git -C "$WORK/cl" remote set-url origin "https://github.com/acme/widget.git/"
out="$(cd "$WORK/cl" && bash "$CL")"
expect_has "changelog: trailing slash dropped from the link" "$out" "(https://github.com/acme/widget/commit/$sha3)"
git -C "$WORK/cl" remote remove origin

# --- changelog: a backslash before a pipe, and a backtick in a path ---------------------------------------
printf 'w\n' > "$WORK/cl/we\`ird.txt"
git -C "$WORK/cl" add -A
git -C "$WORK/cl" commit -q -m 'fix(x): literal \| pipe'
out="$(cd "$WORK/cl" && bash "$CL" HEAD~1 HEAD)"
expect_has "changelog: backslash and pipe both escaped" "$out" '| fix(x): literal \\\| pipe |'
expect_has "changelog: backtick path uses a double-backtick span" "$out" '`` we`ird.txt ``: WHY?'

# --- assets: never the branch someone has checked out, never a code branch ---------------------------------
repo am
put "$WORK/am" code.txt "code"
before="$(git -C "$WORK/am" rev-parse main)"
out="$(cd "$WORK/am" && bash "$AS" --no-push --branch main evidence "$WORK/shot.png" 2>&1)"; code=$?
same "assets onto main: exit 1" "$code" "1"
same "assets onto main: main did not move" "$(git -C "$WORK/am" rev-parse main)" "$before"
git -C "$WORK/am" worktree add -q "$WORK/am-feat" -b feat/z
out="$(cd "$WORK/am-feat" && bash "$AS" --no-push --branch main evidence "$WORK/shot.png" 2>&1)"; code=$?
same "assets onto a code branch from another worktree: exit 1" "$code" "1"
same "assets onto a code branch: main did not move" "$(git -C "$WORK/am" rev-parse main)" "$before"
git -C "$WORK/am" branch feat/idle main                 # a code branch nobody has checked out
out="$(cd "$WORK/am" && bash "$AS" --no-push --branch feat/idle evidence "$WORK/shot.png" 2>&1)"; code=$?
same "assets onto an idle code branch: exit 1" "$code" "1"
same "assets onto an idle code branch: it did not move" "$(git -C "$WORK/am" rev-parse feat/idle)" "$before"
(cd "$WORK/am" && bash "$AS" --no-push k1 "$WORK/shot.png" >/dev/null)
tip="$(git -C "$WORK/am" rev-parse review-assets)"
git -C "$WORK/am" worktree add -q "$WORK/am-browse" review-assets
out="$(cd "$WORK/am" && bash "$AS" --no-push k2 "$WORK/shot.png" 2>&1)"; code=$?
same "assets while the branch is checked out: exit 1" "$code" "1"
same "assets while the branch is checked out: tip did not move" "$(git -C "$WORK/am" rev-parse review-assets)" "$tip"

# --- assets: two files with one name are refused -------------------------------------------------------------
mkdir -p "$WORK/before" "$WORK/after"
printf 'b' > "$WORK/before/pic.png"; printf 'a' > "$WORK/after/pic.png"
tip="$(git -C "$WORK/as" rev-parse review-assets)"
out="$(cd "$WORK/as" && bash "$AS" --no-push dup "$WORK/before/pic.png" "$WORK/after/pic.png" 2>&1)"; code=$?
same "assets duplicate names: exit 2" "$code" "2"
same "assets duplicate names: nothing committed" "$(git -C "$WORK/as" rev-parse review-assets)" "$tip"

# --- assets: a file name that needs encoding ------------------------------------------------------------------
printf 'h' > "$WORK/shot#1 (final).png"
out="$(cd "$WORK/as" && bash "$AS" --remote hub --no-push feat/x "$WORK/shot#1 (final).png")"
tip="$(git -C "$WORK/as" rev-parse review-assets)"
same "assets: link path is percent-encoded" "$out" \
  "![shot#1 (final).png](https://github.com/acme/widget/blob/$tip/feat/x/shot%231%20%28final%29.png?raw=true)"

# --- assets: evidence saved locally survives a remote that moved on ----------------------------------------------
repo dva
git init -q --bare "$WORK/dv-remote.git"
git -C "$WORK/dva" remote add origin "$WORK/dv-remote.git"
git -C "$WORK/dva" push -q origin main
git clone -q "$WORK/dv-remote.git" "$WORK/dvb"
printf 'A1' > "$WORK/a1.png"; printf 'B1' > "$WORK/b1.png"; printf 'A2' > "$WORK/a2.png"
(cd "$WORK/dva" && bash "$AS" --no-push ka "$WORK/a1.png" >/dev/null)
(cd "$WORK/dvb" && bash "$AS" kb "$WORK/b1.png" >/dev/null)
out="$(cd "$WORK/dva" && bash "$AS" ka "$WORK/a2.png" 2>&1)"; code=$?
same "assets diverged: exit 0" "$code" "0"
same "assets diverged: every file kept" "$(git -C "$WORK/dva" ls-tree -r --name-only review-assets | sort | tr '\n' ',')" \
  "ka/a1.png,ka/a2.png,kb/b1.png,"
same "assets diverged: remote matches" "$(git -C "$WORK/dv-remote.git" rev-parse review-assets)" "$(git -C "$WORK/dva" rev-parse review-assets)"

# =============================================================================
# Cases found by the second review round (2026-11-21). Each failed before its fix.
# =============================================================================

# --- usage: one ROOT only ------------------------------------------------------------------------
bash "$PF" "$WORK/bare1" "$WORK/wt" >/dev/null 2>&1; same "preflight: a second ROOT is a usage error" "$?" "2"
bash "$SEED" --dry-run "$WORK/dry" "$WORK/wt" >/dev/null 2>&1; same "seed: a second ROOT is a usage error" "$?" "2"

# --- preflight: run from a subfolder, with an anchored ignore entry -----------------------------------
repo anch
mkdir -p "$WORK/anch/src"
put "$WORK/anch" .gitignore "/.claude/worktrees/"
out="$(bash "$PF" "$WORK/anch/src")"
expect "preflight from a subfolder: ignore entry seen" "$out" "worktrees-ignored: yes"

# --- preflight: only the whole opt-in sentence counts ---------------------------------------------------
repo halfopt
put "$WORK/halfopt" AGENTS.md "This project works in task-for-review mode only when separately requested; it is currently disabled."
out="$(bash "$PF" "$WORK/halfopt")"
expect "opt-in: half the sentence is not an opt-in" "$out" "opt-in: no"

# --- preflight: a path with a slash before its colon is local ----------------------------------------------
git -C "$WORK/kinds" remote add slashcolon "backup/repo:old.git"
out="$(TFR_GH="$WORK/bin/gh-ok" bash "$PF" "$WORK/kinds")"
expect "kinds: slash before the colon is local" "$out" "remote: slashcolon local backup/repo:old.git"

# --- seed: files that were already there are not the seed's to commit -----------------------------------------
mkdir -p "$WORK/priv"; printf 'private notes\n' > "$WORK/priv/glossary.md"
out="$(bash "$SEED" "$WORK/priv")"; code=$?
same "seed kept file: exit 0" "$code" "0"
refuse "seed kept file: not committed" "$(git -C "$WORK/priv" ls-tree -r --name-only HEAD)" "glossary.md"
same "seed kept file: untouched" "$(cat "$WORK/priv/glossary.md")" "private notes"
expect_has "seed kept file: says it is left to the agent" "$out" "next: glossary.md was already here and is not committed"
same "seed prefilled: nothing of the user's committed" "$(git -C "$WORK/pre" ls-tree -r --name-only HEAD)" ""
same "seed prefilled: honest subject for an empty first commit" "$(git -C "$WORK/pre" log -1 --format=%s)" "chore(seed): start the repository"

# --- seed: a name with an ampersand, and scaffolding the project's ignore file would hide ------------------------
mkdir -p "$WORK/amp"
bash "$SEED" --name 'R&D' "$WORK/amp" >/dev/null
expect "seed: ampersand kept in the name" "$(cat "$WORK/amp/AGENTS.md")" "# R&D"
mkdir -p "$WORK/ign"; printf 'AGENTS.md\n' > "$WORK/ign/.gitignore"
out="$(bash "$SEED" "$WORK/ign" 2>&1)"; code=$?
same "seed ignored scaffolding: exit 0" "$code" "0"
expect_has "seed ignored scaffolding: AGENTS.md tracked" "$(git -C "$WORK/ign" ls-files)" "AGENTS.md"

# --- changelog: diff.relative, and a path holding a run of backticks ----------------------------------------------
git -C "$WORK/cl" config diff.relative true
out="$(cd "$WORK/cl/src" && bash "$CL" HEAD~1 HEAD)"
refuse "changelog: diff.relative does not hide files" "$out" "(no file changes)"
git -C "$WORK/cl" config --unset diff.relative
printf 'w\n' > "$WORK/cl/a\`\`b.txt"
git -C "$WORK/cl" add -A; git -C "$WORK/cl" commit -q -m "fix(x): two backticks"
out="$(cd "$WORK/cl" && bash "$CL" HEAD~1 HEAD)"
expect_has "changelog: delimiter longer than the longest backtick run" "$out" '``` a``b.txt ```: WHY?'

# --- assets: the main branch is refused even when this clone has no local copy of it ------------------------------
repo topicsrc
put "$WORK/topicsrc" code.txt "code"
git -C "$WORK/topicsrc" branch topic
git init -q --bare "$WORK/topic-remote.git"
git -C "$WORK/topicsrc" push -q "$WORK/topic-remote.git" main topic
git -C "$WORK/topic-remote.git" symbolic-ref HEAD refs/heads/main
git clone -q --branch topic "$WORK/topic-remote.git" "$WORK/topicclone"
git -C "$WORK/topicclone" branch -D main >/dev/null 2>&1 || true
before="$(git -C "$WORK/topic-remote.git" rev-parse main)"
out="$(cd "$WORK/topicclone" && bash "$AS" --branch main evidence "$WORK/shot.png" 2>&1)"; code=$?
same "assets onto a remote-only main: exit 1" "$code" "1"
same "assets onto a remote-only main: remote main did not move" "$(git -C "$WORK/topic-remote.git" rev-parse main)" "$before"

# --- assets: links follow where the evidence is pushed ----------------------------------------------------------------
repo pushurl
git -C "$WORK/pushurl" remote add origin "https://github.com/acme/widget.git"
git -C "$WORK/pushurl" remote set-url --push origin "gitea:blue/proj.git"
out="$(cd "$WORK/pushurl" && bash "$AS" --no-push k "$WORK/shot.png")"
expect_has "assets: link uses the push destination" "$out" "(http://gitea.test:3000/blue/proj/raw/commit/"

# --- assets: a stale local copy never undoes newer evidence on the remote -----------------------------------------------
repo sta
git init -q --bare "$WORK/st-remote.git"
git -C "$WORK/sta" remote add origin "$WORK/st-remote.git"
git -C "$WORK/sta" push -q origin main
mkdir -p "$WORK/old" "$WORK/new" "$WORK/mine"
printf 'OLD' > "$WORK/old/screenshot.png"; printf 'NEW' > "$WORK/new/screenshot.png"
printf 'A' > "$WORK/a-extra.png"; printf 'C' > "$WORK/c-extra.png"
(cd "$WORK/sta" && bash "$AS" ev "$WORK/old/screenshot.png" >/dev/null)             # A publishes OLD
git clone -q "$WORK/st-remote.git" "$WORK/stb"
(cd "$WORK/sta" && bash "$AS" --no-push ev "$WORK/a-extra.png" >/dev/null)          # A adds, unpushed
(cd "$WORK/stb" && bash "$AS" ev "$WORK/new/screenshot.png" >/dev/null)             # B publishes NEW
out="$(cd "$WORK/sta" && bash "$AS" ev "$WORK/c-extra.png" 2>&1)"; code=$?          # A adds again, pushes
same "assets stale: exit 0" "$code" "0"
same "assets stale: the newer remote file survives" "$(git -C "$WORK/sta" cat-file blob review-assets:ev/screenshot.png)" "NEW"
same "assets stale: every file present" "$(git -C "$WORK/sta" ls-tree -r --name-only review-assets | sort | tr '\n' ',')" \
  "ev/a-extra.png,ev/c-extra.png,ev/screenshot.png,"

# Both sides changed the same file differently: refuse, and move nothing.
printf 'MINE' > "$WORK/mine/screenshot.png"; printf 'THEIRS' > "$WORK/theirs.png"
(cd "$WORK/sta" && bash "$AS" --no-push ev "$WORK/mine/screenshot.png" >/dev/null)
cp "$WORK/theirs.png" "$WORK/new/screenshot.png"
(cd "$WORK/stb" && bash "$AS" ev "$WORK/new/screenshot.png" >/dev/null)
tip="$(git -C "$WORK/sta" rev-parse review-assets)"
out="$(cd "$WORK/sta" && bash "$AS" ev "$WORK/a-extra.png" 2>&1)"; code=$?
same "assets conflict: exit 1" "$code" "1"
expect_has "assets conflict: names the file" "$out" "ev/screenshot.png"
same "assets conflict: local branch did not move" "$(git -C "$WORK/sta" rev-parse review-assets)" "$tip"
# Supplying the file again settles it.
out="$(cd "$WORK/sta" && bash "$AS" ev "$WORK/mine/screenshot.png" 2>&1)"; code=$?
same "assets conflict settled: exit 0" "$code" "0"
same "assets conflict settled: the supplied file wins" "$(git -C "$WORK/st-remote.git" cat-file blob review-assets:ev/screenshot.png)" "MINE"

echo "task-for-review self-test: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
