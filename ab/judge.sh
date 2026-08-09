#!/usr/bin/env bash
# Blind cross-family gate: judge two finished arms, candidate vs incumbent.
#   ab/judge.sh <candidate-arm> <incumbent-arm>
# Anonymizes to ARM_X / ARM_Y (coin flip), has codex (gpt-5.6-terra) inspect both
# sandboxes read-only, prints verdict JSON translated back to candidate-vs-incumbent:
#   verdict ∈ better|worse|similar|unchanged (candidate relative to incumbent) + meaningful bool.
set -euo pipefail
CAND="${1:?candidate arm}"; INC="${2:?incumbent arm}"
AB_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNS="$HOME/AI_Projects/ab-scrum/runs"
WS="$HOME/AI_Projects/ab-scrum/judge/$CAND-vs-$INC"
if [ -e "$WS" ]; then    # never destroy an outcome — archive it, user-judgeable
  mkdir -p "$HOME/AI_Projects/ab-scrum/judge/_archive"
  mv "$WS" "$HOME/AI_Projects/ab-scrum/judge/_archive/$(basename "$WS")-$(date +%Y%m%d-%H%M%S)"
fi
mkdir -p "$WS"

if [ $((RANDOM % 2)) -eq 0 ]; then X="$CAND"; Y="$INC"; else X="$INC"; Y="$CAND"; fi
echo "{\"X\":\"$X\",\"Y\":\"$Y\"}" > "$WS/mapping.json"

for PAIR in "X:$X" "Y:$Y"; do
  L="${PAIR%%:*}"; A="${PAIR##*:}"
  mkdir -p "$WS/ARM_$L"
  rsync -a --exclude node_modules --exclude .git --exclude dist "$RUNS/$A/app/" "$WS/ARM_$L/app/"
  cp "$RUNS/$A/metrics.md" "$WS/ARM_$L/metrics.md" 2>/dev/null || true
  # scrub identifying labels from metrics
  sed -i '' "s/arm $A/arm ARM_$L/" "$WS/ARM_$L/metrics.md" 2>/dev/null || true
  [ -f "$RUNS/$A/screenshot.png" ] && cp "$RUNS/$A/screenshot.png" "$WS/ARM_$L/screenshot.png" || true
done
cp "$RUNS/$CAND/brief.used.md" "$WS/brief.md" 2>/dev/null || cp "$AB_DIR/brief.md" "$WS/brief.md"

cat > "$WS/JUDGE_PROMPT.md" <<'EOF'
You are a blind judge of two autonomous coding runs, ARM_X and ARM_Y. Both received
the identical brief (brief.md) and the identical wall-clock cap, in identical empty
repos. You do not know which process produced which arm. Judge ONLY the outcome a
user cares about:

1. Working product first: is there a playable game per the brief's definition of done?
   (screenshot.png, if present, is the running app; build status is in metrics.md)
2. Product over paperwork: code that serves the player vs process artifacts
   (contracts, ledgers, journals, premise docs) that serve nobody after the run.
3. Efficiency: what did each arm turn the same budget into?

Inspect ARM_X/ and ARM_Y/ (source, docs, metrics.md). Then output STRICT JSON only,
no prose around it:
{
  "verdict_X_vs_Y": "better|worse|similar|unchanged",
  "meaningful": true|false,
  "one_line": "<the margin in one sentence>",
  "evidence": ["<=5 concrete observations with file paths"]
}
"meaningful" = a user comparing the two end states would clearly prefer one; cosmetic
or marginal differences are not meaningful. "unchanged" = outputs essentially identical.
EOF

codex exec -C "$WS" -m gpt-5.6-terra -s read-only --skip-git-repo-check \
  "$(cat "$WS/JUDGE_PROMPT.md")" < /dev/null > "$WS/judge-raw.txt" 2> "$WS/judge-stderr.log" || true

python3 - "$WS" "$CAND" "$INC" <<'EOF'
import json,re,sys,os
ws,cand,inc=sys.argv[1],sys.argv[2],sys.argv[3]
raw=open(os.path.join(ws,'judge-raw.txt'),errors='replace').read()
m=re.findall(r'\{[^{}]*"verdict_X_vs_Y"[\s\S]*?\}',raw)
if not m: print(json.dumps({"error":"no verdict JSON in judge output"})); sys.exit(1)
v=json.loads(m[-1]); mp=json.load(open(os.path.join(ws,'mapping.json')))
flip={'better':'worse','worse':'better','similar':'similar','unchanged':'unchanged'}
vx=v['verdict_X_vs_Y']
out=dict(v); out['candidate']=cand; out['incumbent']=inc; out['blind_mapping']=mp
out['verdict_candidate_vs_incumbent']= vx if mp['X']==cand else flip[vx]
open(os.path.join(ws,'verdict.json'),'w').write(json.dumps(out,indent=2))
print(json.dumps(out,indent=2))
EOF
