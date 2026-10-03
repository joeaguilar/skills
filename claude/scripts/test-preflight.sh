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

# --- usage -------------------------------------------------------------------
bash "$PF" --nope >/dev/null 2>&1; [ $? -eq 2 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL unknown option must exit 2"; }
bash "$PF" "$WORK/does-not-exist" >/dev/null 2>&1; [ $? -eq 2 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL missing root must exit 2"; }
bash "$PF" --since x "$WORK/none" >/dev/null 2>&1; [ $? -eq 2 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL non-numeric --since must exit 2"; }
if bash "$PF" --help | grep -q '^Usage: preflight.sh'; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL --help must print the usage"; fi

echo "preflight self-test: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
