#!/usr/bin/env bash
# Boot an arm's app (its own dev script) and capture screenshot.png — the user-judgeable
# "what does a player actually see" artifact.  ab/screenshot.sh <arm-label>
set -uo pipefail
ARM="${1:?arm label}"
RUN="$HOME/AI_Projects/ab-scrum/runs/$ARM"; APP="$RUN/app"
cd "$APP" || exit 2
[ -f package.json ] || { echo "no package.json — nothing to boot"; exit 0; }
[ -d node_modules ] || npm install --no-audit --no-fund -s || { echo "npm install failed"; exit 1; }

npm run dev > "$RUN/dev.log" 2>&1 &
DEV=$!
URL=""
for _ in $(seq 1 40); do
  URL=$(grep -oE 'http://(localhost|127\.0\.0\.1):[0-9]+/?' "$RUN/dev.log" | head -1 || true)
  [ -n "$URL" ] && curl -sf "$URL" >/dev/null 2>&1 && break
  sleep 1
done
if [ -n "$URL" ]; then
  echo "dev server: $URL"
  npx playwright screenshot --wait-for-timeout=4000 "$URL" "$RUN/screenshot.png" \
    && echo "screenshot -> $RUN/screenshot.png" || echo "screenshot capture failed"
else
  echo "dev server never came up (dev.log tail):"; tail -5 "$RUN/dev.log"
fi
kill "$DEV" 2>/dev/null; pkill -P "$DEV" 2>/dev/null; exit 0
