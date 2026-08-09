#!/usr/bin/env bash
# Extract product-vs-ceremony metrics from a finished arm.
#   ab/metrics.sh <arm-label>   -> writes runs/<arm>/metrics.md (and prints it)
set -euo pipefail
ARM="${1:?arm label}"
RUN="$HOME/AI_Projects/ab-scrum/runs/$ARM"
APP="$RUN/app"
[ -d "$APP" ] || { echo "no run dir: $RUN" >&2; exit 2; }

loc() { [ -z "$1" ] && echo 0 && return; echo "$1" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}'; }

CODE_FILES=$(cd "$APP" && find . -path ./node_modules -prune -o -path ./.git -prune -o \
  -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.html' -o -name '*.css' \) -print | grep -v '^\./dist' || true)
DOC_FILES=$(cd "$APP" && find . -path ./node_modules -prune -o -path ./.git -prune -o \
  -type f \( -name '*.md' -o -name '*.jsonl' \) -print || true)
CODE_LOC=$(cd "$APP" && loc "$CODE_FILES")
DOC_LOC=$(cd "$APP" && loc "$DOC_FILES")

COMMITS=$(git -C "$APP" log --oneline 2>/dev/null | wc -l | tr -d ' ')
FEAT=$(git -C "$APP" log --oneline --grep='^feat' -E 2>/dev/null | wc -l | tr -d ' ')
PROCESS=$(git -C "$APP" log --oneline -E --grep='^(docs|chore)' 2>/dev/null | wc -l | tr -d ' ')

BUILD="n/a"
if [ -f "$APP/package.json" ] && grep -q '"build"' "$APP/package.json"; then
  if (cd "$APP" && [ -d node_modules ] || npm install --no-audit --no-fund -s) \
     && (cd "$APP" && timeout 240 npm run build -s > "$RUN/build.log" 2>&1); then
    BUILD=green; else BUILD=red; fi
fi

TURNS=$(grep -c '"type":"assistant"' "$RUN/stream.jsonl" 2>/dev/null || echo 0)
TOK=$(python3 - "$RUN/stream.jsonl" <<'EOF'
import json,sys
inp=out=0
for line in open(sys.argv[1],errors='replace'):
    try: e=json.loads(line)
    except Exception: continue
    u=(e.get('message') or {}).get('usage') or e.get('usage') or {}
    if e.get('type') in ('assistant','result'):
        inp+=u.get('input_tokens',0)+u.get('cache_creation_input_tokens',0)
        out+=u.get('output_tokens',0)
print(f"{inp} {out}")
EOF
)
WALL=$(python3 -c "import json;print(json.load(open('$RUN/run.json'))['wall_s'])" 2>/dev/null || echo '?')

{
echo "# metrics — arm $ARM"
echo "- wall: ${WALL}s (cap in run.json) · turns(assistant msgs): $TURNS · tokens in/out: $TOK"
echo "- code LOC (ts/js/html/css, no dist): $CODE_LOC · process/doc LOC (md/jsonl): $DOC_LOC"
echo "- commits: $COMMITS total · feat: $FEAT · docs/chore: $PROCESS"
echo "- npm run build: $BUILD"
echo "- top-level tree:"; (cd "$APP" && find . -maxdepth 2 -not -path './node_modules*' -not -path './.git*' -not -path './dist*' | sort | sed 's/^/    /')
} > "$RUN/metrics.md"
cat "$RUN/metrics.md"
