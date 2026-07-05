#!/usr/bin/env bash
#
# rolling-campaign chain driver — run proof campaigns back-to-back, each in a
# FRESH context, until the handoff says stop.
#
# A skill cannot clear its own context. This loop does, by relaunching the
# orchestrator as a NEW `claude -p` process per leg. The per-leg handoff.json
# on disk is the only thread between two cleared contexts.
#
# Seed the chain first with one interactive, human-approved run:
#     claude          # then, inside: /rolling-campaign --seed
# then hand off to this driver:
#     scripts/chain.sh [repo-dir]
#
# The driver is RESUME-ONLY: it never runs the first (seed) leg, so the human
# approval gate stays meaningful. It relaunches only while continue == "yes".
#
# Env:
#   PROOF_CHAIN_MAX   hard cap on legs this invocation drives (default 8)
#   CLAUDE_BIN        claude executable (default: claude)
#   CLAUDE_ARGS       extra flags for every leg's claude invocation, word-split
#                     deliberately, e.g. CLAUDE_ARGS="--permission-mode acceptEdits".
#                     A headless (-p) leg cannot answer permission prompts, so it
#                     needs a mode that lets it edit files and run the verify gate
#                     unattended — without this, resumed legs get their tool calls
#                     denied and can't do real work.
#
# The driver also honors the handoff's own chain.max_campaigns: PROOF_CHAIN_MAX
# caps THIS invocation (resets every rerun), chain.max_campaigns caps the chain
# overall (survives reruns; raise it via --max-campaigns at seed time).
#
# Exit codes: 0 clean stop (handoff said stop / cap reached) · 1 leg failed ·
#             2 no seed handoff found.
set -euo pipefail

REPO_DIR="${1:-$PWD}"
MAX_LEGS="${PROOF_CHAIN_MAX:-8}"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
CLAUDE_ARGS="${CLAUDE_ARGS:-}"

cd "$REPO_DIR"

# Resolve chain/CURRENT to the active leg's handoff.json each iteration, tolerant
# of CURRENT being either a symlink/dir OR a plain file naming the leg folder.
resolve_handoff() {
  if [ -e chain/CURRENT ] && { [ -d chain/CURRENT ] || [ -L chain/CURRENT ]; }; then
    printf 'chain/CURRENT/handoff.json\n'
  elif [ -f chain/CURRENT ]; then
    local name; name="$(tr -d '[:space:]' < chain/CURRENT)"
    printf 'chain/%s/handoff.json\n' "$name"
  else
    printf ''
  fi
}

# field <handoff-path> <dotted.key> — print a (possibly nested) string field, or ""
field() {
  python3 - "$1" "$2" <<'PY'
import json, sys, pathlib
p = pathlib.Path(sys.argv[1])
if not p.exists():
    print(""); raise SystemExit
try:
    d = json.loads(p.read_text())
    for k in sys.argv[2].split("."):
        d = d.get(k) if isinstance(d, dict) else None
    print("" if d is None or d == {} else d)
except Exception:
    print("")
PY
}

handoff="$(resolve_handoff)"
if [ -z "$handoff" ] || [ ! -f "$handoff" ]; then
  echo "chain: no seed handoff found (looked for chain/CURRENT -> handoff.json)."
  echo "chain: seed the chain first with one interactive, approved run:"
  echo "         $CLAUDE_BIN     # then inside: /rolling-campaign --seed"
  exit 2
fi

# A leg's identity signature. If it is unchanged after a relaunch, the leg made
# no progress (crashed before writing a fresh handoff, or refused to advance) —
# relaunching again would loop forever, so we halt instead. This is the driver's
# own never-stuck guard, independent of the skill's in-leg 3-attempt cap.
signature() { printf '%s|%s|%s' "$(field "$1" from_leg)" "$(field "$1" ended_at)" "$(field "$1" chain.index)"; }

leg=0
while :; do
  handoff="$(resolve_handoff)"
  cont="$(field "$handoff" continue)"

  if [ "$cont" != "yes" ]; then
    reason="$(field "$handoff" halt_reason)"
    stop="$(field "$handoff" stop_condition)"
    echo "chain: STOP (continue=${cont:-<none>}, stop_condition=${stop:-?})."
    [ -n "$reason" ] && echo "chain: halt_reason: $reason"
    break
  fi

  if [ "$leg" -ge "$MAX_LEGS" ]; then
    echo "chain: reached PROOF_CHAIN_MAX=$MAX_LEGS legs this run. Rerun scripts/chain.sh to extend."
    break
  fi

  # Chain-wide cap from the handoff itself: chain.index is the 0-based index of
  # the leg that just ran, so index+1 legs have run in total. Unlike the
  # per-invocation counter above, this cap survives driver reruns.
  chain_max="$(field "$handoff" chain.max_campaigns)"
  chain_idx="$(field "$handoff" chain.index)"
  if [ -n "$chain_max" ] && [ -n "$chain_idx" ] && [ "$((chain_idx + 1))" -ge "$chain_max" ]; then
    echo "chain: chain-wide max_campaigns=$chain_max reached ($((chain_idx + 1)) legs run) — stopping."
    echo "chain: re-seed with a higher --max-campaigns to extend the chain."
    break
  fi

  leg=$((leg + 1))
  next_goal="$(field "$handoff" next_campaign.goal)"
  next_dir="$(field "$handoff" next_campaign.dir)"
  sig_before="$(signature "$handoff")"
  echo "=== chain leg $leg/$MAX_LEGS — resuming into ${next_dir:-next campaign} ==="
  [ -n "$next_goal" ] && echo "    goal: $next_goal"

  # CLAUDE_ARGS is unquoted on purpose: it carries whole flags to word-split.
  # shellcheck disable=SC2086
  if ! "$CLAUDE_BIN" $CLAUDE_ARGS -p "/rolling-campaign --resume"; then
    echo "chain: '$CLAUDE_BIN -p' exited nonzero on leg $leg — halting for operator."
    exit 1
  fi

  # Crash-loop guard: the leg must have advanced the handoff. If not, do not relaunch.
  handoff_after="$(resolve_handoff)"
  if [ "$(signature "$handoff_after")" = "$sig_before" ]; then
    echo "chain: leg $leg produced no new handoff (crash or no-progress) — halting to avoid a relaunch loop."
    echo "chain: inspect chain/CURRENT and the leg's notes.md, then rerun scripts/chain.sh to retry."
    exit 1
  fi
done

echo "chain: done after $leg leg(s) this run. Latest state: chain/CURRENT"
