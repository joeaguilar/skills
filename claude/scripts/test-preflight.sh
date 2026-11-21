#!/usr/bin/env bash
# Self-test for claude/skills/blitz/scripts/preflight.sh. Builds throwaway repos,
# runs the script against each and checks the lines it prints. Touches nothing
# outside a temp directory. The itr-backed cases are skipped when itr is absent.
#
# Usage: claude/scripts/test-preflight.sh [path/to/preflight.sh]
set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
PF="${1:-$REPO_DIR/claude/skills/blitz/scripts/preflight.sh}"
[ -f "$PF" ] || { echo "test-preflight: no script at $PF" >&2; exit 2; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/preflight-test.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
pass=0
fail=0

# expect LABEL OUTPUT LINE — the output must hold LINE exactly.
expect() {
  if printf '%s\n' "$2" | grep -qxF -- "$3"; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    printf 'FAIL %s\n  wanted line: %s\n  got:\n%s\n' "$1" "$3" "$(printf '%s\n' "$2" | sed 's/^/    /')"
  fi
}
# refuse LABEL OUTPUT PREFIX — no line of the output may start with PREFIX.
refuse() {
  if printf '%s\n' "$2" | grep -q -- "^$3"; then
    fail=$((fail+1))
    printf 'FAIL %s\n  unwanted line starting: %s\n' "$1" "$3"
  else
    pass=$((pass+1))
  fi
}
repo() { # name -> a fresh repo with one commit, cwd left unchanged
  mkdir -p "$WORK/$1"
  git -C "$WORK/$1" init -q
  git -C "$WORK/$1" -c core.hooksPath=/dev/null -c user.name=t -c user.email=t@t commit -q --allow-empty -m "chore: base"
}
commit() { # dir message
  git -C "$1" -c core.hooksPath=/dev/null -c user.name=t -c user.email=t@t commit -q --allow-empty -m "$2"
}

# --- verify gate, one repo per row of the table ------------------------------
repo cargo; : > "$WORK/cargo/Cargo.toml"
out="$(bash "$PF" "$WORK/cargo")"
expect "cargo gate keeps --all-targets" "$out" 'verify-gate: cargo test && cargo clippy --all-targets -- -D warnings && cargo fmt --check'
expect "cargo source" "$out" 'verify-gate-source: Cargo.toml'
expect "--gate prints the command alone" "$(bash "$PF" --gate "$WORK/cargo")" 'cargo test && cargo clippy --all-targets -- -D warnings && cargo fmt --check'

if command -v node >/dev/null 2>&1; then
  repo npm; printf '{"scripts":{"test":"x","lint":"x","typecheck":"x","format:check":"x","build":"x"}}\n' > "$WORK/npm/package.json"
  out="$(bash "$PF" "$WORK/npm")"
  expect "npm union of the four scripts" "$out" 'verify-gate: npm test && npm run lint && npm run typecheck && npm run format:check'
  repo npm1; printf '{"scripts":{"test":"x"}}\n' > "$WORK/npm1/package.json"
  expect "npm test alone" "$(bash "$PF" "$WORK/npm1")" 'verify-gate: npm test'
  repo npm0; printf '{"name":"x"}\n' > "$WORK/npm0/package.json"
  expect "package.json without scripts is no gate" "$(bash "$PF" "$WORK/npm0")" 'verify-gate: missing'
fi

repo py; : > "$WORK/py/pyproject.toml"
expect "pyproject gate" "$(bash "$PF" "$WORK/py")" 'verify-gate: pytest && ruff check . && ruff format --check .'

repo go; : > "$WORK/go/go.mod"
expect "go gate" "$(bash "$PF" "$WORK/go")" 'verify-gate: go test ./... && go vet ./... && test -z "$(gofmt -l .)"'

repo mk; printf 'test:\n\ttrue\nlint:\n\ttrue\nverify:\n\ttrue\n' > "$WORK/mk/Makefile"
expect "make gate with the targets that exist" "$(bash "$PF" "$WORK/mk")" 'verify-gate: make test && make lint && make verify'

repo jf; printf 'check:\n    true\ntest:\n    true\n' > "$WORK/jf/justfile"
out="$(bash "$PF" "$WORK/jf")"
expect "just prefers check over test" "$out" 'verify-gate: just check'
expect "just source" "$out" 'verify-gate-source: justfile'

repo none
out="$(bash "$PF" "$WORK/none")"
expect "no gate" "$out" 'verify-gate: missing'
expect "no gate source" "$out" 'verify-gate-source: none'
bash "$PF" --gate "$WORK/none" >/dev/null 2>&1
if [ $? -eq 1 ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL --gate must exit 1 with no gate"; fi

repo both; : > "$WORK/both/Cargo.toml"; : > "$WORK/both/pyproject.toml"
expect "first match wins" "$(bash "$PF" "$WORK/both")" 'verify-gate-source: Cargo.toml'

# --- git ---------------------------------------------------------------------
out="$(bash "$PF" "$WORK/none")"
expect "clean tree" "$out" 'dirty: 0'
expect "git present" "$out" 'git: present'
refuse "clean tree lists no path" "$out" 'dirty-path:'

repo dirty; : > "$WORK/dirty/a file.txt"; : > "$WORK/dirty/b.rs"
out="$(bash "$PF" "$WORK/dirty")"
expect "dirty count" "$out" 'dirty: 2'
expect "dirty path" "$out" 'dirty-path: b.rs'
expect "dirty path with a space, as git quotes it" "$out" 'dirty-path: "a file.txt"'

mkdir -p "$WORK/plain"
out="$(bash "$PF" "$WORK/plain")"
expect "not a repo" "$out" 'git: absent'
expect "no head outside a repo" "$out" 'head: none'

mkdir -p "$WORK/unborn"; git -C "$WORK/unborn" init -q
expect "no commits yet" "$(bash "$PF" "$WORK/unborn")" 'head: none'

repo det; git -C "$WORK/det" checkout -q --detach
expect "detached head" "$(bash "$PF" "$WORK/det")" 'branch: detached'

# --- sprint state ------------------------------------------------------------
repo sp
mkdir -p "$WORK/sp/sprint/sprint-2-2026-01-01-a" "$WORK/sp/sprint/sprint-11-2026-02-01-b/blitz" "$WORK/sp/sprint/_unscoped"
printf 'sprint-11-2026-02-01-b\r\n' > "$WORK/sp/sprint/CURRENT"
printf '# Sprint-11\n\n## Outcomes\n<!-- Populated by /sprint-review after /blitz runs. -->\n\n## Demo\n' > "$WORK/sp/sprint/sprint-11-2026-02-01-b/plan.md"
printf '## Outcomes\n- W1 done\n' > "$WORK/sp/sprint/sprint-11-2026-02-01-b/blitz/wave-1.md"
printf '## Outcomes\n**Blitz complete (2026-02-02) - 4 tasks terminal.**\n' > "$WORK/sp/sprint/sprint-11-2026-02-01-b/blitz/wave-2.md"
printf '## Outcomes\n' > "$WORK/sp/sprint/_unscoped/blitz-2026-02-03T10-00.md"
out="$(bash "$PF" "$WORK/sp")"
expect "next sprint counts numerically, not as text" "$out" 'sprint-next: sprint-12'
expect "CURRENT read, CR stripped" "$out" 'sprint-current: sprint-11-2026-02-01-b'
expect "CURRENT folder exists" "$out" 'sprint-current-valid: yes'
expect "placeholder Outcomes is not reviewed" "$out" 'sprint-current-reviewed: no'
expect "marker-less wave log" "$out" 'unfinished-wave-log: sprint/sprint-11-2026-02-01-b/blitz/wave-1.md'
expect "marker-less unscoped log" "$out" 'unfinished-wave-log: sprint/_unscoped/blitz-2026-02-03T10-00.md'
refuse "finished wave log is not flagged" "$out" 'unfinished-wave-log: sprint/sprint-11-2026-02-01-b/blitz/wave-2.md'

printf '# Sprint-11\n\n## Outcomes\n| itr#4 | closed |\n\n## Demo\n' > "$WORK/sp/sprint/sprint-11-2026-02-01-b/plan.md"
expect "real Outcomes content is reviewed" "$(bash "$PF" "$WORK/sp")" 'sprint-current-reviewed: yes'

rm "$WORK/sp/sprint/sprint-11-2026-02-01-b/plan.md"
expect "no plan.md is not reviewed" "$(bash "$PF" "$WORK/sp")" 'sprint-current-reviewed: no'

printf 'sprint-99-gone\n' > "$WORK/sp/sprint/CURRENT"
expect "CURRENT naming a missing folder" "$(bash "$PF" "$WORK/sp")" 'sprint-current-valid: no'

repo sp2
mkdir -p "$WORK/sp2/sprint/sprint-1-x/blitz"
printf 'sprint-1-x\n' > "$WORK/sp2/sprint/CURRENT"
printf '## Outcomes\n' > "$WORK/sp2/sprint/sprint-1-x/blitz/wave-1.md"
git -C "$WORK/sp2" add -A
commit "$WORK/sp2" "chore: sprint files"
rm "$WORK/sp2/sprint/CURRENT"
out="$(bash "$PF" "$WORK/sp2")"
expect "deleted CURRENT reads as absent" "$out" 'sprint-current: absent'
expect "deleted CURRENT falls back to HEAD for the wave-log scan" "$out" 'unfinished-wave-log: sprint/sprint-1-x/blitz/wave-1.md'

expect "no sprint folders" "$(bash "$PF" "$WORK/none")" 'sprint-next: sprint-1'

# --- conventions -------------------------------------------------------------
repo conv; : > "$WORK/conv/STORY_STYLE.md"; mkdir -p "$WORK/conv/docs"; : > "$WORK/conv/docs/ROADMAP.md"; : > "$WORK/conv/ROADMAP.md"
out="$(bash "$PF" "$WORK/conv")"
expect "story style found" "$out" 'story-style: STORY_STYLE.md'
expect "docs/ROADMAP.md wins over ./ROADMAP.md" "$out" 'roadmap: docs/ROADMAP.md'

# --- tracker -----------------------------------------------------------------
if command -v itr >/dev/null 2>&1; then
  expect "itr on PATH, no database" "$(bash "$PF" "$WORK/none")" 'tracker: itr-no-db'

  repo tr
  ( cd "$WORK/tr" && itr init >/dev/null 2>&1 \
    && ITR_AGENT=test itr add "Shipped already" -p medium -k task --tags "sprint-7" >/dev/null 2>&1 \
    && ITR_AGENT=test itr add "Really closed" -p medium -k task >/dev/null 2>&1 \
    && ITR_AGENT=test itr add "Never mentioned" -p low -k task >/dev/null 2>&1 \
    && ITR_AGENT=test itr close 2 "done" >/dev/null 2>&1 )
  commit "$WORK/tr" "feat: ship the thing" ; commit "$WORK/tr" "fix: upload race

Closes #1 and fixes #2."
  commit "$WORK/tr" "fix: again (resolves #1)"
  out="$(bash "$PF" "$WORK/tr")"
  expect "itr with a database" "$out" 'tracker: itr'
  expect "open count from itr stats" "$out" 'tracker-open: 2'
  expect "next sprint from tracker tags when no sprint/ folder" "$out" 'sprint-next: sprint-8'
  if printf '%s\n' "$out" | grep -q '^stale-ticket: #1 '; then pass=$((pass+1)); else fail=$((fail+1)); printf 'FAIL stale ticket #1 not listed\n%s\n' "$out"; fi
  if [ "$(printf '%s\n' "$out" | grep -c '^stale-ticket: #1 ')" = "1" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL stale ticket #1 listed more than once"; fi
  refuse "a closed ticket is not stale" "$out" 'stale-ticket: #2 '
  refuse "an unmentioned ticket is not stale" "$out" 'stale-ticket: #3 '
  refuse "--since 0 reads no history" "$(bash "$PF" --since 0 "$WORK/tr")" 'stale-ticket:'
else
  echo "SKIP: itr not on PATH; tracker cases not run"
  expect "no tracker" "$(bash "$PF" "$WORK/none")" 'tracker: none'
fi

# --- waves -------------------------------------------------------------------
# same LABEL GOT WANT — the whole output must equal WANT.
same() {
  if [ "$2" = "$3" ]; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    printf 'FAIL %s\n  wanted:\n%s\n  got:\n%s\n' "$1" "$(printf '%s\n' "$3" | sed 's/^/    /')" "$(printf '%s\n' "$2" | sed 's/^/    /')"
  fi
}
lines() { printf '%s\n' "$@"; }
wr() { WR="$WORK/$1"; repo "$1"; ( cd "$WR" && itr init >/dev/null 2>&1 ); }   # fresh repo + tracker, sets WR
wi() { ( cd "$WR" && ITR_AGENT=test itr "$@" >/dev/null 2>&1 ); }              # run itr in WR
mk() { local p; for p in "$@"; do mkdir -p "$(dirname "$WR/$p")"; : > "$WR/$p"; done; git -C "$WR" add -- "$@" >/dev/null 2>&1; }
wv() { bash "$PF" --waves "$@" "$WR"; }
head5() { lines 'wave-concurrency: 5' "wave-count: $1" "wave-placed: $2"; }

if command -v itr >/dev/null 2>&1; then
  wr w-share; mk src/x.rs src/z.rs
  wi add one -k task --files src/x.rs; wi add two -k task --files src/x.rs; wi add three -k task --files src/z.rs
  out="$(wv)"
  same "a shared file splits two tasks" "$out" "$(head5 2 3; lines 'wave: 1 #1 #3' 'wave: 2 #2' 'wave-conflict: src/x.rs #1 #2')"
  refuse "--waves prints only its own lines" "$out" 'root:'
  same "two runs are byte-identical" "$(wv)" "$out"

  wr w-dir; mk src/old.rs lib/a.rs
  wi add one -k task --files src; wi add two -k task --files src/new.rs; wi add three -k task --files lib/a.rs; wi add four -k task --files src/old.rs
  same "a directory claim covers files beneath it, existing or not" "$(wv)" \
    "$(head5 2 4; lines 'wave: 1 #1 #3' 'wave: 2 #2 #4' 'wave-conflict: src/ #1 #2 #4' 'wave-path-absent: #2 src/new.rs')"

  wr w-cap; mk f1.rs f2.rs f3.rs f4.rs f5.rs f6.rs f7.rs
  for n in 1 2 3 4 5 6 7; do wi add "t$n" -k task --files "f$n.rs"; done
  same "concurrency 3 packs 3/3/1" "$(wv --concurrency 3)" \
    "$(lines 'wave-concurrency: 3' 'wave-count: 3' 'wave-placed: 7' 'wave: 1 #1 #2 #3' 'wave: 2 #4 #5 #6' 'wave: 3 #7')"
  same "default concurrency is 5" "$(wv | sed -n '1,3p')" "$(head5 2 7)"

  wr w-chain; mk d1.rs d2.rs d3.rs d4.rs
  for n in 1 2 3 4; do wi add "t$n" -k task --files "d$n.rs"; done
  wi depend 2 --on 1; wi depend 3 --on 2
  same "a three-task chain takes three waves" "$(wv)" \
    "$(head5 3 4; lines 'wave: 1 #1 #4' 'wave: 2 #2' 'wave: 3 #3' 'wave-order: #2 after #1' 'wave-order: #3 after #2')"

  wr w-closed; mk d1.rs d2.rs
  wi add one -k task --files d1.rs; wi add two -k task --files d2.rs; wi depend 2 --on 1; wi close 1 done
  same "a closed blocker is no constraint" "$(wv)" "$(head5 1 1; lines 'wave: 1 #2')"

  wr w-prio; mk f.rs
  wi add lowone -k task -p low --files f.rs; wi add critone -k task -p critical --files f.rs
  same "priority decides who gets wave 1" "$(wv)" "$(head5 2 2; lines 'wave: 1 #2' 'wave: 2 #1' 'wave-conflict: f.rs #1 #2')"

  wr w-acct; mk a.rs b.rs c.rs v.rs
  wi add epic -k epic; wi add vis -k task --tags visual-gate-only --files v.rs; wi add nofiles -k task
  wi add free -k task --files a.rs; wi add waits -k task --files b.rs; wi add waitsvis -k task --files c.rs
  wi depend 5 --on 3; wi depend 6 --on 2
  out="$(wv)"
  same "deferred, unowned and held groups" "$out" \
    "$(head5 1 1; lines 'wave: 1 #4' 'wave-deferred: #2 visual-gate-only' 'wave-unowned: #3' 'wave-held: #5 waits on #3 (unowned)' 'wave-held: #6 waits on #2 (deferred)')"
  for n in 2 3 4 5 6; do
    c="$(printf '%s\n' "$out" | grep -cE "^(wave: .*|wave-(deferred|unowned|held): )#$n( |\$)")"
    same "task #$n sits in exactly one group" "$c" 1
  done
  same "the epic is in no group" "$(printf '%s\n' "$out" | grep -cE '#1( |$)')" 0

  wr w-own; mk src/a.rs src/b.rs src/c.rs
  wi add one -k task; wi add two -k task --files src/b.rs; wi add three -k task --files src/c.rs
  same "no --own leaves the file-less task unowned" "$(wv | sed -n '4,$p')" "$(lines 'wave: 1 #2 #3' 'wave-unowned: #1' | sed -n '1,2p')"
  same "--own gives files to an unowned task and replaces declared ones" "$(wv --own 1=src/b.rs --own 2=src/c.rs)" \
    "$(head5 2 3; lines 'wave: 1 #1 #2' 'wave: 2 #3' 'wave-conflict: src/c.rs #2 #3')"
  same "--also adds a claim and keeps the declared ones" "$(wv --own 1=src/c.rs --also 3=src/b.rs)" \
    "$(head5 2 3; lines 'wave: 1 #1 #2' 'wave: 2 #3' 'wave-conflict: src/b.rs #2 #3' 'wave-conflict: src/c.rs #1 #3')"
  same "--also alone gives an unowned task its files" "$(wv --also 1=src/a.rs)" "$(head5 1 3; lines 'wave: 1 #1 #2 #3')"
  same "--also adds to what --own set, and repeats add up" "$(wv --own 1=src/a.rs --also 1=src/b.rs --also 1=src/c.rs)" \
    "$(head5 2 3; lines 'wave: 1 #1' 'wave: 2 #2 #3' 'wave-conflict: src/b.rs #1 #2' 'wave-conflict: src/c.rs #1 #3')"

  wr w-trans; mk a.rs b.rs c.rs
  wi add one -k task; wi add two -k task --files a.rs; wi add three -k task --files b.rs; wi add four -k task --files c.rs
  wi depend 2 --on 1; wi depend 3 --on 2
  same "holding is transitive" "$(wv)" "$(head5 1 1; lines 'wave: 1 #4' 'wave-unowned: #1' 'wave-held: #2 waits on #1 (unowned)' 'wave-held: #3 waits on #2 (held)')"
  same "--own releases the hold" "$(wv --own 1=d.rs)" \
    "$(head5 3 4; lines 'wave: 1 #1 #4' 'wave: 2 #2' 'wave: 3 #3' 'wave-order: #2 after #1' 'wave-order: #3 after #2' 'wave-path-absent: #1 d.rs')"

  wr w-tag; mk f1.rs f2.rs
  wi add inscope -k task --tags a --files f1.rs; wi add outscope -k task --tags b --files f2.rs; wi depend 1 --on 2
  same "--tag scopes the backlog; an open blocker outside it holds" "$(wv --tag a)" "$(head5 0 0; lines 'wave-held: #1 waits on #2 (out of scope)')"
  same "without the tag both are placed in order" "$(wv)" "$(head5 2 2; lines 'wave: 1 #2' 'wave: 2 #1' 'wave-order: #1 after #2')"

  wr w-epic; mk a.rs b.rs c.rs d.rs
  wi add epic -k epic; wi add kid -k task --parent 1 --files a.rs; wi add kid2 -k task --parent 1 --files b.rs
  wi add outside -k task --files c.rs; wi add onepic -k task --files d.rs; wi depend 3 --on 4; wi depend 5 --on 1
  same "an epic parent is no blocker; --parent scopes" "$(wv --parent 1)" \
    "$(head5 1 1; lines 'wave: 1 #2' 'wave-held: #3 waits on #4 (out of scope)')"
  same "an epic is skipped silently and holds its dependants" "$(wv)" \
    "$(head5 2 3; lines 'wave: 1 #2 #4' 'wave: 2 #3' 'wave-order: #3 after #4' 'wave-held: #5 waits on #1 (epic)')"

  wr w-parent; mk a.rs b.rs
  wi add par -k task --files a.rs; wi add kid -k task --parent 1 --files b.rs
  same "a non-epic parent is a dependency" "$(wv)" "$(head5 2 2; lines 'wave: 1 #1' 'wave: 2 #2' 'wave-order: #2 after #1')"

  wr w-cycle; mk a.rs b.rs c.rs
  wi add one -k task --files a.rs; wi add two -k task --parent 1 --files b.rs; wi add three -k task --files c.rs
  wi depend 1 --on 2
  same "a parent/blocker cycle is held, and the run ends" "$(wv)" \
    "$(head5 1 1; lines 'wave: 1 #3' 'wave-held: #1 waits on #2 (cycle)' 'wave-held: #2 waits on #1 (cycle)')"

  wr w-cyc2; mk a.rs b.rs
  wi add one -k task --files a.rs; wi add two -k task --parent 1 --files b.rs; wi add three -k task
  wi depend 1 --on 2; wi depend 1 --on 3
  same "a cycle keeps its reason beside another hold" "$(wv)" \
    "$(head5 0 0; lines 'wave-unowned: #3' 'wave-held: #1 waits on #2 (cycle)' 'wave-held: #1 waits on #3 (unowned)' 'wave-held: #2 waits on #1 (cycle)')"

  wr w-closedpar; mk a.rs b.rs
  wi add par -k task --files a.rs; wi add kid -k task --parent 1 --files b.rs; wi close 1 done
  same "a closed parent still named on its child is no constraint" "$(wv)" "$(head5 1 1; lines 'wave: 1 #2')"

  wr w-num; mk 01 1
  wi add one -k task --files 01; wi add two -k task --files 1
  same "claims that look like equal numbers are different files" "$(wv)" "$(head5 1 2; lines 'wave: 1 #1 #2')"

  wr projx; mk src/a.rs src/b.rs lib/deep/u.rs x/amb.rs y/amb.rs
  wi add one -k task --files '.\src\a.rs'; wi add two -k task --files './src//a.rs'; wi add three -k task --files projx/src/b.rs
  wi add four -k task --files u.rs; wi add five -k task --files amb.rs; wi add six -k task --files lib/deep/u.rs
  out="$(wv)"
  same "normalisation: backslash, ./, //, repo-name prefix, unique suffix, ambiguous suffix" "$out" \
    "$(head5 2 6; lines 'wave: 1 #1 #3 #4 #5' 'wave: 2 #2 #6' 'wave-conflict: lib/deep/u.rs #4 #6' 'wave-conflict: src/a.rs #1 #2' 'wave-path-absent: #5 amb.rs')"
  same "normalised run is byte-identical" "$(wv)" "$out"

  wr w-space; mk 'a b/c.rs' src/y.rs
  wi add one -k task --files 'a b/c.rs,src/y.rs'; wi add two -k task --files 'a b/'
  same "paths with spaces" "$(wv)" "$(head5 2 2; lines 'wave: 1 #1' 'wave: 2 #2' 'wave-conflict: a b/ #1 #2')"

  wr w-ro; mk a.rs; wi add one -k task --files a.rs; wi add two -k task --files a.rs
  before="$( (cd "$WR" && git status --porcelain; find . -path ./.git -prune -o -type f -exec cksum {} + | sort) )"
  wv >/dev/null
  after="$( (cd "$WR" && git status --porcelain; find . -path ./.git -prune -o -type f -exec cksum {} + | sort) )"
  same "--waves writes nothing" "$after" "$before"
fi

bash "$PF" --waves "$WORK/none" >/dev/null 2>&1; [ $? -eq 1 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL --waves with no itr database must exit 1"; }
for bad in 0 x -1 1.5 ''; do
  bash "$PF" --waves --concurrency "$bad" "$WORK/none" >/dev/null 2>&1; [ $? -eq 2 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL --concurrency '$bad' must exit 2"; }
done
for bad in abc 1 x=a.rs 1= '=a.rs' '1=,' '1=a.rs,,b.rs' '1=,a.rs' '1=a.rs,'; do
  bash "$PF" --waves --own "$bad" "$WORK/none" >/dev/null 2>&1; [ $? -eq 2 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL --own '$bad' must exit 2"; }
done
for bad in abc 1 x=a.rs 1= '=a.rs' '1=,' '1=a.rs,,b.rs' '1=,a.rs' '1=a.rs,'; do
  bash "$PF" --waves --also "$bad" "$WORK/none" >/dev/null 2>&1; [ $? -eq 2 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL --also '$bad' must exit 2"; }
done
for flag in "--concurrency 2" "--tag x" "--parent 1" "--own 1=a" "--also 1=a"; do
  bash "$PF" $flag "$WORK/none" >/dev/null 2>&1; [ $? -eq 2 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL '$flag' without --waves must exit 2"; }
done

# --- usage -------------------------------------------------------------------
bash "$PF" --nope >/dev/null 2>&1; [ $? -eq 2 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL unknown option must exit 2"; }
bash "$PF" "$WORK/does-not-exist" >/dev/null 2>&1; [ $? -eq 2 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL missing root must exit 2"; }
bash "$PF" --since x "$WORK/none" >/dev/null 2>&1; [ $? -eq 2 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL non-numeric --since must exit 2"; }
if bash "$PF" --help | grep -q '^Usage: preflight.sh'; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL --help must print the usage"; fi

echo "preflight self-test: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
