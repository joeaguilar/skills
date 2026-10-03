#!/usr/bin/env bash
# preflight.sh — the facts a backlog or sprint orchestrator needs before it plans.
#
# One read-only pass over a repo. It prints `key: value` lines; a key that can hold
# several values repeats, one value per line. Nothing is written, staged, stashed,
# initialised or fixed: the caller decides what to do with what it reads.
#
# The orchestrator skills read these lines instead of re-deriving them from prose
# tables. The tables were copied between skills and drifted: one copy gained
# `--all-targets` on the clippy gate after a lint in a test file shipped, and four
# others kept the bare form.
#
# Usage: preflight.sh [--gate] [--since DAYS] [ROOT]
#   --gate        print only the verify-gate command; exit 1 when none is detected
#   --since DAYS  how far back the stale-ticket sweep reads git history (default 30)
#   ROOT          repo to inspect (default: the current directory)
#
# Lines (in this order; `…` marks a key that repeats):
#   root                      absolute path inspected
#   git                       present | absent
#   branch                    branch name | detached | none
#   head                      short sha | none (no commits yet)
#   dirty                     count of uncommitted paths
#   dirty-path …              one uncommitted path, as `git status --porcelain` spells it
#   tracker                   itr (a database resolves) | itr-no-db | none
#   tracker-open              open issue count | unknown
#   kgr, gatr                 present | absent
#   verify-gate               the gate command | missing
#   verify-gate-source        the file that decided it | none
#   story-style               STORY_STYLE.md | absent
#   roadmap                   docs/ROADMAP.md | ROADMAP.md | absent
#   sprint-next               sprint-N, the next free sprint number
#   sprint-current            folder named by sprint/CURRENT | absent
#   sprint-current-valid      yes | no   (the folder exists)
#   sprint-current-reviewed   yes | no   (plan.md's Outcomes holds real content)
#   unfinished-wave-log …     a blitz wave log with no `Blitz complete` line
#   stale-ticket …            `#id sha subject`: a commit says it closed the ticket, itr says open
set -u

GATE_ONLY=0
SINCE_DAYS=30
ROOT="."
while [ $# -gt 0 ]; do
  case "$1" in
    --gate) GATE_ONLY=1; shift ;;
    --since) SINCE_DAYS="${2:?--since needs a number of days}"; shift 2 ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
    -*) printf 'preflight: unknown option %s\n' "$1" >&2; exit 2 ;;
    *) ROOT="$1"; shift ;;
  esac
done
case "$SINCE_DAYS" in
  ''|*[!0-9]*) printf 'preflight: --since takes a whole number of days\n' >&2; exit 2 ;;
esac

if ! cd "$ROOT" 2>/dev/null; then
  printf 'preflight: cannot enter %s\n' "$ROOT" >&2
  exit 2
fi
ROOT="$(pwd -P)"

have() { command -v "$1" >/dev/null 2>&1; }

# --- verify gate -------------------------------------------------------------
# First match wins, in this order. This is the only copy of the table.
GATE=""
GATE_SOURCE="none"
detect_verify_gate() {
  if [ -f Cargo.toml ]; then
    # --all-targets is not optional: bare `cargo clippy` lints only the default
    # targets, so a lint in a test file passes the gate and ships.
    GATE='cargo test && cargo clippy --all-targets -- -D warnings && cargo fmt --check'
    GATE_SOURCE="Cargo.toml"
    return 0
  fi

  if [ -f package.json ]; then
    npm_gate=""
    if have node; then
      npm_gate="$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync("package.json","utf8")); const s=p.scripts||{}; const cmds=[]; if(s.test)cmds.push("npm test"); if(s.lint)cmds.push("npm run lint"); if(s.typecheck)cmds.push("npm run typecheck"); if(s["format:check"])cmds.push("npm run format:check"); process.stdout.write(cmds.join(" && "));' 2>/dev/null)"
    elif grep -q '"test"[[:space:]]*:' package.json 2>/dev/null; then
      npm_gate='npm test'
    fi
    if [ -n "$npm_gate" ]; then
      GATE="$npm_gate"
      GATE_SOURCE="package.json"
      return 0
    fi
  fi

  if [ -f pyproject.toml ]; then
    GATE='pytest && ruff check . && ruff format --check .'
    GATE_SOURCE="pyproject.toml"
    return 0
  fi

  if [ -f go.mod ]; then
    GATE='go test ./... && go vet ./... && test -z "$(gofmt -l .)"'
    GATE_SOURCE="go.mod"
    return 0
  fi

  if [ -f Makefile ] && grep -Eq '^test:' Makefile 2>/dev/null; then
    GATE='make test'
    grep -Eq '^lint:' Makefile 2>/dev/null && GATE="$GATE && make lint"
    grep -Eq '^check:' Makefile 2>/dev/null && GATE="$GATE && make check"
    grep -Eq '^verify:' Makefile 2>/dev/null && GATE="$GATE && make verify"
    GATE_SOURCE="Makefile"
    return 0
  fi

  for jf in justfile Justfile; do
    [ -f "$jf" ] || continue
    if grep -Eq '^verify:' "$jf" 2>/dev/null; then GATE='just verify'
    elif grep -Eq '^check:' "$jf" 2>/dev/null; then GATE='just check'
    elif grep -Eq '^test:' "$jf" 2>/dev/null; then GATE='just test'
    else continue
    fi
    GATE_SOURCE="$jf"
    return 0
  done

  return 1
}

if [ "$GATE_ONLY" -eq 1 ]; then
  detect_verify_gate || exit 1
  printf '%s\n' "$GATE"
  exit 0
fi

printf 'root: %s\n' "$ROOT"

# --- git ---------------------------------------------------------------------
git_state="absent"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_state="present"
fi
printf 'git: %s\n' "$git_state"

head_sha="none"
if [ "$git_state" = "present" ]; then
  branch="$(git branch --show-current 2>/dev/null)"
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    head_sha="$(git rev-parse --short HEAD 2>/dev/null)"
    [ -z "$branch" ] && branch="detached"
  fi
  [ -z "$branch" ] && branch="none"
  printf 'branch: %s\n' "$branch"
  printf 'head: %s\n' "$head_sha"
  status_text="$(git status --porcelain 2>/dev/null || true)"
  if [ -z "$status_text" ]; then
    printf 'dirty: 0\n'
  else
    printf 'dirty: %s\n' "$(printf '%s\n' "$status_text" | wc -l | tr -d ' ')"
    printf '%s\n' "$status_text" | while IFS= read -r line; do
      printf 'dirty-path: %s\n' "${line:3}"
    done
  fi
else
  printf 'branch: none\nhead: none\ndirty: 0\n'
fi

# --- tracker and tools -------------------------------------------------------
tracker="none"
tracker_open="unknown"
if have itr; then
  # `itr stats` walks up to the database the way every other itr command does.
  if itr_stats="$(itr stats 2>/dev/null)"; then
    tracker="itr"
    parsed="$(printf '%s\n' "$itr_stats" | sed -n 's/^BY_STATUS:.*[[:space:]]open=\([0-9][0-9]*\).*/\1/p' | head -1)"
    [ -n "$parsed" ] && tracker_open="$parsed"
  else
    tracker="itr-no-db"
  fi
fi
printf 'tracker: %s\n' "$tracker"
printf 'tracker-open: %s\n' "$tracker_open"

if have kgr; then printf 'kgr: present\n'; else printf 'kgr: absent\n'; fi
if have gatr; then printf 'gatr: present\n'; else printf 'gatr: absent\n'; fi

if detect_verify_gate; then
  printf 'verify-gate: %s\n' "$GATE"
else
  printf 'verify-gate: missing\n'
fi
printf 'verify-gate-source: %s\n' "$GATE_SOURCE"

# --- project conventions -----------------------------------------------------
if [ -f STORY_STYLE.md ]; then printf 'story-style: STORY_STYLE.md\n'; else printf 'story-style: absent\n'; fi
if [ -f docs/ROADMAP.md ]; then printf 'roadmap: docs/ROADMAP.md\n'
elif [ -f ROADMAP.md ]; then printf 'roadmap: ROADMAP.md\n'
else printf 'roadmap: absent\n'
fi

# --- sprint state ------------------------------------------------------------
# Next number: the filesystem first (sprint/sprint-N-*), then the tracker's
# sprint-N tags, else sprint-1.
max_sprint=0
if [ -d sprint ]; then
  for d in sprint/sprint-*/; do
    [ -d "$d" ] || continue
    n="$(basename "$d" | sed -n 's/^sprint-\([0-9][0-9]*\).*/\1/p')"
    [ -n "$n" ] && [ "$n" -gt "$max_sprint" ] && max_sprint="$n"
  done
fi
if [ "$max_sprint" -eq 0 ] && [ "$tracker" = "itr" ]; then
  for n in $(itr search "sprint-" -f json --fields tags 2>/dev/null | grep -oE 'sprint-[0-9]+' | sed 's/^sprint-//' | sort -u); do
    [ "$n" -gt "$max_sprint" ] && max_sprint="$n"
  done
fi
printf 'sprint-next: sprint-%s\n' "$((max_sprint + 1))"

sprint_current=""
if [ -f sprint/CURRENT ]; then
  sprint_current="$(sed -n '1p' sprint/CURRENT 2>/dev/null | tr -d '\r')"
fi
if [ -n "$sprint_current" ]; then
  printf 'sprint-current: %s\n' "$sprint_current"
  if [ -d "sprint/$sprint_current" ]; then printf 'sprint-current-valid: yes\n'; else printf 'sprint-current-valid: no\n'; fi
  # Reviewed = the Outcomes section holds a line that is not the placeholder
  # /sprint writes. No plan.md is treated as not reviewed (still in flight).
  reviewed="no"
  plan="sprint/$sprint_current/plan.md"
  if [ -f "$plan" ]; then
    body="$(tr -d '\r' < "$plan" | awk '
      /^## Outcomes[[:space:]]*$/ { inside = 1; next }
      inside && /^## / { inside = 0 }
      inside && $0 !~ /^[[:space:]]*$/ && $0 != "<!-- Populated by /sprint-review after /blitz runs. -->" { print }
    ')"
    [ -n "$body" ] && reviewed="yes"
  fi
  printf 'sprint-current-reviewed: %s\n' "$reviewed"
else
  printf 'sprint-current: absent\nsprint-current-valid: no\nsprint-current-reviewed: no\n'
fi

# --- another blitz in this tree? ---------------------------------------------
# The signal is a wave log with no `Blitz complete` line. Outcomes fills wave by
# wave, so "Outcomes is empty" would miss almost every live run.
log_folder="$sprint_current"
if [ -z "$log_folder" ] && [ "$head_sha" != "none" ]; then
  # sprint/CURRENT deleted in the working tree: read the committed one.
  log_folder="$(git show HEAD:sprint/CURRENT 2>/dev/null | sed -n '1p' | tr -d '\r')"
fi
for f in ${log_folder:+"sprint/$log_folder/blitz"/wave-*.md} sprint/_unscoped/blitz-*.md; do
  [ -f "$f" ] || continue
  grep -q 'Blitz complete' "$f" 2>/dev/null || printf 'unfinished-wave-log: %s\n' "$f"
done

# --- stale tickets -----------------------------------------------------------
# A commit that says `closes #N` does not close N in itr. List every N a recent
# commit claims to have closed that the tracker still holds open.
if [ "$tracker" = "itr" ] && [ "$head_sha" != "none" ]; then
  seen=" "
  for sha in $(git log --since="$SINCE_DAYS days ago" --format='%h' -i -E \
      --grep='(closes?|fix(es)?|resolves?)[[:space:]]+#[0-9]+' 2>/dev/null); do
    subject="$(git log -1 --format='%s' "$sha" 2>/dev/null)"
    for id in $(git log -1 --format='%B' "$sha" 2>/dev/null \
        | grep -oiE '(closes?|fix(es)?|resolves?)[[:space:]]+#[0-9]+' | grep -oE '[0-9]+$'); do
      case "$seen" in *" $id "*) continue ;; esac
      seen="$seen$id "
      if itr get "$id" -f json --fields id,status 2>/dev/null | grep -Eq '"status"[[:space:]]*:[[:space:]]*"open"'; then
        printf 'stale-ticket: #%s %s %s\n' "$id" "$sha" "$subject"
      fi
    done
  done
fi

exit 0
