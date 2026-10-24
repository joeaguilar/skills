#!/usr/bin/env bash
set -uo pipefail
#
# codex-seat.sh — launch one GPT/Codex seat with the flags every past failure taught us.
#
#   codex-seat.sh run   -d SEAT -m MODEL -e EFFORT -s SANDBOX [opts]   block until Codex exits
#   codex-seat.sh start -d SEAT -m MODEL -e EFFORT -s SANDBOX [opts]   detach, return at once
#   codex-seat.sh wait  -d SEAT [--max SECS] [--stall SECS]            poll a started seat
#
# SEAT is a directory that already holds brief.md (the whole prompt). The script writes:
#   SEAT/out.md   Codex's final message (-o)           SEAT/log    stdout+stderr
#   SEAT/done     "exit=N" once Codex has exited        SEAT/cmd    the exact command run
#
# run/start opts:
#   -C DIR          Codex working root (default: current directory)
#   -i FILE         attach an image (repeatable)
#   --add-dir DIR   extra writable dir (repeatable)
#   --schema FILE   --output-schema for a validated JSON final message
#   --allow-ultra   permit effort max/ultra (only when the user asked AND the seat runs solo)
#
# Exit codes — run: Codex's own exit code (2 = usage error here).
#              wait: 0 done+ok, 1 done+failed, 3 still running (call wait again),
#                    4 stalled (log silent for --stall secs; Codex may be hung), 2 usage.
#
# Why each pinned flag exists (all observed on this machine, 2026-09):
#   -m / effort   a bare `codex exec` inherits ~/.codex/config.toml (gpt-6-astra at ultra);
#                 gpt-5.5 hard-fails on ultra/max.
#   stdin = file  the brief is fed on stdin (`-`), so stdin always hits EOF; an open stdin
#                 left a backgrounded run on "Reading additional input from stdin..." for 6.5 h.
#   done file     completion must be checkable with `cat`, never inferred from silence.
#   nohup start   a run_in_background Bash call dies with the subagent that launched it.

usage() { sed -n '4,21p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2; }

mode="${1:-}"; [ -n "$mode" ] || usage; shift
seat="" model="" effort="" sandbox="" cdir="$PWD" schema="" allow_ultra=0
max=540 stall=900
extra=()
while [ $# -gt 0 ]; do
  case "$1" in
    -d) seat="$2"; shift 2 ;;
    -m) model="$2"; shift 2 ;;
    -e) effort="$2"; shift 2 ;;
    -s) sandbox="$2"; shift 2 ;;
    -C) cdir="$2"; shift 2 ;;
    -i) extra+=(-i "$2"); shift 2 ;;
    --add-dir) extra+=(--add-dir "$2"); shift 2 ;;
    --schema) schema="$2"; shift 2 ;;
    --allow-ultra) allow_ultra=1; shift ;;
    --max) max="$2"; shift 2 ;;
    --stall) stall="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "codex-seat: unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -n "$seat" ] || { echo "codex-seat: -d SEAT is required" >&2; exit 2; }

if [ "$mode" = wait ]; then
  [ -f "$seat/pid" ] || [ -f "$seat/done" ] || { echo "codex-seat: $seat was never started" >&2; exit 2; }
  waited=0 last_size=-1 quiet=0
  while :; do
    if [ -f "$seat/done" ]; then
      cat "$seat/done"
      grep -q '^exit=0$' "$seat/done" && exit 0 || exit 1
    fi
    size=$(wc -c < "$seat/log" 2>/dev/null || echo 0)
    if [ "$size" = "$last_size" ]; then quiet=$((quiet + 15)); else quiet=0; last_size=$size; fi
    if [ "$quiet" -ge "$stall" ]; then
      echo "stalled: log unchanged for ${quiet}s (pid $(cat "$seat/pid" 2>/dev/null)); tail:"; tail -5 "$seat/log"
      exit 4
    fi
    if [ "$waited" -ge "$max" ]; then echo "running: ${waited}s this call, log ${size} bytes"; exit 3; fi
    sleep 15; waited=$((waited + 15))
  done
fi

[ "$mode" = run ] || [ "$mode" = start ] || usage
[ -n "$model" ]   || { echo "codex-seat: -m MODEL is required (never inherit config.toml)" >&2; exit 2; }
[ -n "$effort" ]  || { echo "codex-seat: -e EFFORT is required (never inherit config.toml)" >&2; exit 2; }
case "$sandbox" in
  read-only|workspace-write) ;;
  danger-full-access) echo "codex-seat: danger-full-access is not a seat mode (auto mode denies it; computer use has its own skill)" >&2; exit 2 ;;
  *) echo "codex-seat: -s must be read-only or workspace-write" >&2; exit 2 ;;
esac
case "$effort" in
  max|ultra)
    [ "$allow_ultra" = 1 ] || { echo "codex-seat: effort $effort needs --allow-ultra (user asked, solo seat only)" >&2; exit 2; }
    [ "$model" = gpt-5.5 ] && { echo "codex-seat: gpt-5.5 rejects effort $effort" >&2; exit 2; } ;;
esac
[ -f "$seat/brief.md" ] || { echo "codex-seat: $seat/brief.md not found — write the whole prompt there first" >&2; exit 2; }
command -v codex >/dev/null || { echo "codex-seat: codex CLI not on PATH (/codex:setup)" >&2; exit 2; }
if [ -f "$seat/pid" ] && [ ! -f "$seat/done" ]; then
  echo "codex-seat: $seat already has a run in flight (pid $(cat "$seat/pid")); use a new seat dir" >&2; exit 2
fi
rm -f "$seat/done" "$seat/out.md" "$seat/pid"

args=(exec -C "$cdir" -m "$model" -c "model_reasoning_effort=\"$effort\"" -s "$sandbox" -o "$seat/out.md")
[ "$sandbox" = workspace-write ] && args+=(-c 'approval_policy="never"')
git -C "$cdir" rev-parse --git-dir >/dev/null 2>&1 || args+=(--skip-git-repo-check)
[ -n "$schema" ] && args+=(--output-schema "$schema")
args+=(${extra[@]+"${extra[@]}"} -)   # '-' = read the prompt from stdin (the brief file)

printf '%q ' codex "${args[@]}" > "$seat/cmd"; printf '< %q\n' "$seat/brief.md" >> "$seat/cmd"

if [ "$mode" = run ]; then
  codex "${args[@]}" < "$seat/brief.md" > "$seat/log" 2>&1
  rc=$?
  echo "exit=$rc" > "$seat/done"
  echo "exit=$rc  out: $seat/out.md  log: $seat/log"
  exit "$rc"
fi

# start: detach from the calling shell so the run outlives a subagent's turn.
nohup bash -c 'codex "$@" < "$0/brief.md" > "$0/log" 2>&1; echo "exit=$?" > "$0/done"' \
  "$seat" "${args[@]}" > /dev/null 2>&1 &
echo $! > "$seat/pid"
sleep 20
if [ -f "$seat/done" ]; then
  echo "finished early: $(cat "$seat/done")"; tail -5 "$seat/log"
elif [ ! -s "$seat/log" ]; then
  echo "started (pid $(cat "$seat/pid")) but the log is still empty after 20s — check with wait"
else
  echo "started (pid $(cat "$seat/pid")); log is growing — poll with: $0 wait -d $seat"
fi
