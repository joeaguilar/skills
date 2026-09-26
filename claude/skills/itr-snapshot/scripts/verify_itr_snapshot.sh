#!/usr/bin/env bash
# verify_itr_snapshot.sh — prove the snapshot tooling works in a repo.
#
# Usage: verify_itr_snapshot.sh <repo-root> [path/to/itr_snapshot_check.py]
#
# Runs the battery against scratch databases only; the repo's live database and
# tracked snapshot are never modified (the snapshot's hash is asserted unchanged).
# Exit 0 when every test passes, 1 otherwise. Run it under gatr for evidence:
#   gatr run --tag itr-snapshot-verify -- verify_itr_snapshot.sh .
set -u
ROOT=$(cd "${1:?repo root}" && pwd)
SCRIPT=${2:-$ROOT/scripts/itr_snapshot_check.py}
SNAP=$ROOT/.itr/issues.jsonl
[ -f "$SCRIPT" ] || { echo "FAIL: $SCRIPT missing"; exit 1; }
[ -f "$SNAP" ]   || { echo "FAIL: $SNAP missing (run --write first)"; exit 1; }
S=$(mktemp -d "${TMPDIR:-/tmp}/itr-snapshot-verify.XXXXXX")
trap 'rm -rf "$S"' EXIT
fails=0
t() { # t <name> <expected-exit> <cmd...>
  local name=$1 want=$2; shift 2
  local out; out=$("$@" 2>&1); local got=$?
  if [ "$got" = "$want" ]; then echo "PASS  $name (exit $got)"; else echo "FAIL  $name: exit $got, expected $want"; echo "$out" | sed 's/^/      /' | tail -6; fails=$((fails+1)); fi
  LAST_OUT=$out
}
expect_out() { # expect_out <name> <grep-pattern>
  if echo "$LAST_OUT" | grep -q -E "$2"; then echo "PASS  $1"; else echo "FAIL  $1: output lacks /$2/"; echo "$LAST_OUT" | sed 's/^/      /' | tail -6; fails=$((fails+1)); fi
}
H0=$(shasum "$SNAP" | cut -c1-16)

echo "--- live database ---"
t "T0 live check passes"            0 python3 "$SCRIPT" --root "$ROOT"

echo "--- fresh clone: snapshot present, no database anywhere below the root ---"
mkdir -p "$S/fresh/.itr" && cp "$SNAP" "$S/fresh/.itr/issues.jsonl"
# ITR_DB_PATH pins the database so itr's walk-up can never escape the scratch dir.
export ITR_DB_PATH="$S/fresh/.itr.db"
t "T1 --restore creates + fills db"  0 python3 "$SCRIPT" --root "$S/fresh" --restore
expect_out "T1 import reported"      "IMPORT: [0-9]+ imported"
t "T2 restored clone passes check (surrogate ids renumbered)" 0 python3 "$SCRIPT" --root "$S/fresh"
FIRST_ID=$(head -1 "$SNAP" | python3 -c 'import sys,json;print(json.loads(sys.stdin.read())["issue"]["id"])')
itr note "$FIRST_ID" "verify battery drift probe" >/dev/null 2>&1
t "T3 note on clone → DRIFT"         1 python3 "$SCRIPT" --root "$S/fresh"
expect_out "T3 names changed id"     "changed \(1\): \[$FIRST_ID\]"
t "T4 --restore over the edited clone replaces the edit (pull) → PASS" 0 python3 "$SCRIPT" --root "$S/fresh" --restore
itr add "verify battery drift issue" -q >/dev/null 2>&1
t "T5 new issue on clone → DRIFT"    1 python3 "$SCRIPT" --root "$S/fresh"
expect_out "T5 names added id"       "added in db, missing from snapshot \(1\)"
t "T5b --restore keeps the local-only issue and says so (exit 1)" 1 python3 "$SCRIPT" --root "$S/fresh" --restore
expect_out "T5b explains local-only survivors" "NOTE: --restore replaces issues"
unset ITR_DB_PATH

echo "--- failure paths never touch the tracked snapshot ---"
ITR_DB_PATH=/nonexistent/dir t "T6 --write with broken db → exit 2" 2 python3 "$SCRIPT" --root "$ROOT" --write
H1=$(shasum "$SNAP" | cut -c1-16)
if [ "$H0" = "$H1" ]; then echo "PASS  T6 snapshot untouched ($H0)"; else echo "FAIL  T6 snapshot CHANGED $H0 → $H1"; fails=$((fails+1)); fi
ITR_DB_PATH=/nonexistent/dir t "T7 SKIP exits 0"           0 python3 "$SCRIPT" --root "$ROOT"
ITR_DB_PATH=/nonexistent/dir t "T7 SKIP --strict exits 1"  1 python3 "$SCRIPT" --root "$ROOT" --strict
t "T8 unknown flag → usage exit 2"  2 python3 "$SCRIPT" --bogus

echo "--- live database still matches (battery is read-only for the repo) ---"
t "T9 live check still passes"      0 python3 "$SCRIPT" --root "$ROOT"

echo
if [ "$fails" = 0 ]; then echo "ALL PASS"; exit 0; else echo "FAILED: $fails"; exit 1; fi
