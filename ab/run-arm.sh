#!/usr/bin/env bash
# Run one A/B arm: pin a candidate SKILL.md as the installed /scrum, run the fixed
# brief headless in a fresh sandbox, keep the full stream log + run metadata.
#
#   ab/run-arm.sh <arm-label> <candidate-SKILL.md> [wall-seconds] [model]
#
# Heavy run dirs live OUTSIDE the skills repo (sandbox must not see this repo's
# .itr.db or git history via walk-up): ~/AI_Projects/ab-scrum/runs/<arm-label>/
set -euo pipefail

ARM="${1:?arm label}"; SKILL_SRC="${2:?candidate SKILL.md}"
WALL="${3:-1800}"; MODEL="${4:-claude-sonnet-5}"; BRIEF_FILE="${5:-brief.md}"
AB_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNS_ROOT="$HOME/AI_Projects/ab-scrum/runs"
RUN="$RUNS_ROOT/$ARM"
INSTALLED="$HOME/.claude/skills/scrum/SKILL.md"

[ -f "$SKILL_SRC" ] || { echo "no such candidate: $SKILL_SRC" >&2; exit 2; }
if [ -e "$RUN" ]; then   # never destroy an outcome — archive it, user-judgeable
  mkdir -p "$RUNS_ROOT/_archive"
  mv "$RUN" "$RUNS_ROOT/_archive/$ARM-$(date +%Y%m%d-%H%M%S)"
fi
mkdir -p "$RUN/app"

cp "$SKILL_SRC" "$RUN/SKILL.used.md"
# Pin the candidate snapshot as the installed /scrum. rm first: the installed file may
# be hard-linked to the repo source, and a live link would let mid-run edits leak in.
rm -f "$INSTALLED"
cp "$RUN/SKILL.used.md" "$INSTALLED"

cd "$RUN/app"
git init -q
git commit -q --allow-empty -m "chore: sandbox baseline"

# Force real skill execution: bare "/scrum <multiline brief>" text does NOT reliably
# invoke the skill headless (measured: the 'bare-control' arm ignored it and free-styled).
BRIEF="$(printf 'Use the Skill tool to invoke the "scrum" skill NOW, before doing anything else, and then follow that skill'"'"'s instructions end to end for this brief:\n\n%s' "$(cat "$AB_DIR/$BRIEF_FILE")")"
cp "$AB_DIR/$BRIEF_FILE" "$RUN/brief.used.md"
START="$(date +%s)"
set +e
# Scoped allowlist, not a permissions bypass: arms may edit files and run the
# build/test/git toolchain inside their own sandbox, nothing broader.
ALLOWED='Edit,Write,Read,Glob,Grep,Agent,TodoWrite,Bash(git *),Bash(npm *),Bash(npx *),Bash(node *),Bash(itr *),Bash(mkdir *),Bash(ls *),Bash(cat *),Bash(touch *),Bash(mv *),Bash(cp *),Bash(wc *),Bash(find *),Bash(grep *),Bash(sed *),Bash(echo *),Bash(tail *),Bash(head *),Bash(timeout *),Bash(shasum *)'
timeout --signal=INT --kill-after=60 "$WALL" \
  claude -p "$BRIEF" \
    --model "$MODEL" \
    --max-turns 300 \
    --allowedTools "$ALLOWED" \
    --output-format stream-json --verbose \
    > "$RUN/stream.jsonl" 2> "$RUN/stderr.log"
EXIT=$?
set -e
END="$(date +%s)"

printf '{"arm":"%s","exit":%s,"wall_s":%s,"wall_cap":%s,"model":"%s","skill_sha":"%s"}\n' \
  "$ARM" "$EXIT" "$((END-START))" "$WALL" "$MODEL" \
  "$(shasum -a 256 "$RUN/SKILL.used.md" | cut -c1-12)" > "$RUN/run.json"
echo "arm $ARM done: exit=$EXIT wall=$((END-START))s -> $RUN"
