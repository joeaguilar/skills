#!/usr/bin/env bash
set -u

ROOT="${1:-.}"
if ! cd "$ROOT" 2>/dev/null; then
  printf 'fastlane scan error: cannot enter %s\n' "$ROOT" >&2
  exit 2
fi
ROOT="$(pwd -P)"

have() {
  command -v "$1" >/dev/null 2>&1
}

count_lines() {
  sed '/^[[:space:]]*$/d' | wc -l | tr -d ' '
}

score_blitz=0
score_dual=0
score_overdrive=0
score_proof=0
score_rivers=0
reason_blitz=""
reason_dual=""
reason_overdrive=""
reason_proof=""
reason_rivers=""

add_score() {
  candidate="$1"
  delta="$2"
  note="$3"
  case "$candidate" in
    blitz)
      score_blitz=$((score_blitz + delta))
      reason_blitz="${reason_blitz}${reason_blitz:+; }${note}"
      ;;
    dual-blitz)
      score_dual=$((score_dual + delta))
      reason_dual="${reason_dual}${reason_dual:+; }${note}"
      ;;
    overdrive)
      score_overdrive=$((score_overdrive + delta))
      reason_overdrive="${reason_overdrive}${reason_overdrive:+; }${note}"
      ;;
    proof-campaign)
      score_proof=$((score_proof + delta))
      reason_proof="${reason_proof}${reason_proof:+; }${note}"
      ;;
    run-the-rivers-dry)
      score_rivers=$((score_rivers + delta))
      reason_rivers="${reason_rivers}${reason_rivers:+; }${note}"
      ;;
  esac
}

skill_path() {
  skill="$1"
  home_dir="${HOME:-}"
  codex_home="${CODEX_HOME:-}"
  [ -z "$codex_home" ] && [ -n "$home_dir" ] && codex_home="$home_dir/.codex"
  for base in \
    "$ROOT/codex/skills" \
    "$ROOT/.codex/skills" \
    "${codex_home:+$codex_home/skills}" \
    "${home_dir:+$home_dir/.agents/skills}" \
    "$ROOT/.agents/skills"; do
    [ -z "$base" ] && continue
    if [ -f "$base/$skill/SKILL.md" ]; then
      printf '%s\n' "$base/$skill"
      return 0
    fi
  done
  return 1
}

availability() {
  skill="$1"
  if path="$(skill_path "$skill")"; then
    printf 'available (%s)' "$path"
  else
    printf 'not found'
  fi
}

penalize_missing_skill() {
  skill="$1"
  if ! skill_path "$skill" >/dev/null 2>&1; then
    add_score "$skill" -100 "skill not found"
  fi
}

detect_verify_gate() {
  if [ -f Cargo.toml ]; then
    printf 'cargo test && cargo clippy -- -D warnings && cargo fmt --check'
    return 0
  fi

  if [ -f package.json ]; then
    if have node; then
      gate="$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync("package.json","utf8")); const s=p.scripts||{}; const cmds=[]; if(s.test)cmds.push("npm test"); if(s.lint)cmds.push("npm run lint"); if(s.typecheck)cmds.push("npm run typecheck"); if(s["format:check"])cmds.push("npm run format:check"); process.stdout.write(cmds.join(" && "));' 2>/dev/null)"
      if [ -n "$gate" ]; then
        printf '%s' "$gate"
        return 0
      fi
    fi
    if grep -q '"test"[[:space:]]*:' package.json 2>/dev/null; then
      printf 'npm test'
      return 0
    fi
  fi

  if [ -f pyproject.toml ]; then
    printf 'pytest && ruff check . && ruff format --check .'
    return 0
  fi

  if [ -f go.mod ]; then
    printf 'go test ./... && go vet ./... && test -z "$(gofmt -l .)"'
    return 0
  fi

  if [ -f Makefile ] && grep -Eq '^test:' Makefile 2>/dev/null; then
    gate='make test'
    grep -Eq '^lint:' Makefile 2>/dev/null && gate="$gate && make lint"
    grep -Eq '^check:' Makefile 2>/dev/null && gate="$gate && make check"
    grep -Eq '^verify:' Makefile 2>/dev/null && gate="$gate && make verify"
    printf '%s' "$gate"
    return 0
  fi

  if [ -f justfile ] || [ -f Justfile ]; then
    jf="justfile"
    [ -f Justfile ] && jf="Justfile"
    if grep -Eq '^(verify|check|test):' "$jf" 2>/dev/null; then
      if grep -Eq '^verify:' "$jf" 2>/dev/null; then
        printf 'just verify'
      elif grep -Eq '^check:' "$jf" 2>/dev/null; then
        printf 'just check'
      else
        printf 'just test'
      fi
      return 0
    fi
  fi

  return 1
}

git_state="absent"
git_branch="n/a"
git_dirty=0
git_risky_dirty=0
git_top_dirs=0
git_has_commits="no"
git_status_text=""

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_state="present"
  git_branch="$(git branch --show-current 2>/dev/null)"
  [ -z "$git_branch" ] && git_branch="$(git rev-parse --short HEAD 2>/dev/null || printf detached)"
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    git_has_commits="yes"
  fi
  git_status_text="$(git status --porcelain 2>/dev/null || true)"
  git_dirty="$(printf '%s\n' "$git_status_text" | count_lines)"
  git_risky_dirty="$(printf '%s\n' "$git_status_text" \
    | awk '{print substr($0,4)}' \
    | grep -E '(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|go\.sum|pyproject\.toml|package\.json|Cargo\.toml|go\.mod|migrations?/|schema|openapi|routes?|\.env|Dockerfile|docker-compose|\.github/workflows|generated)' \
    | count_lines)"
  git_top_dirs="$(git ls-files 2>/dev/null | awk -F/ 'NF>1 {print $1}' | sort -u | wc -l | tr -d ' ')"
fi

tracker="none"
tracker_detail="no itr database detected"
open_count="unknown"
itr_stats=""
if have itr; then
  if [ -f .itr.db ] || { [ "$git_state" = "present" ] && [ -f "$(git rev-parse --show-toplevel 2>/dev/null)/.itr.db" ]; }; then
    tracker="itr"
    itr_stats="$(itr stats 2>/dev/null | sed -n '1,40p' || true)"
    parsed_open="$(printf '%s\n' "$itr_stats" | awk 'BEGIN{IGNORECASE=1} /open/ {for (i=1;i<=NF;i++) if ($i ~ /^[0-9]+$/) {print $i; exit}}')"
    [ -n "$parsed_open" ] && open_count="$parsed_open"
    tracker_detail="itr database present"
  else
    tracker="itr-available"
    tracker_detail="itr command exists but no .itr.db found"
  fi
fi

roadmap="absent"
[ -f docs/ROADMAP.md ] && roadmap="docs/ROADMAP.md"
[ "$roadmap" = "absent" ] && [ -f ROADMAP.md ] && roadmap="ROADMAP.md"
[ "$roadmap" = "absent" ] && [ -d roadmap ] && roadmap="roadmap/"

sprint_current="absent"
sprint_valid="no"
if [ -f sprint/CURRENT ]; then
  sprint_current="$(sed -n '1p' sprint/CURRENT 2>/dev/null | tr -d '\r')"
  [ -n "$sprint_current" ] && [ -d "sprint/$sprint_current" ] && sprint_valid="yes"
fi

campaign_current="absent"
campaign_valid="no"
if [ -f campaign/CURRENT ]; then
  campaign_current="$(sed -n '1p' campaign/CURRENT 2>/dev/null | tr -d '\r')"
  [ -n "$campaign_current" ] && [ -d "campaign/$campaign_current" ] && campaign_valid="yes"
fi

verify_gate="missing"
if gate="$(detect_verify_gate)"; then
  verify_gate="$gate"
fi

kgr_state="absent"
have kgr && kgr_state="present"

security_markers="$(find . -maxdepth 4 \
  \( -path './.git' -o -path './node_modules' -o -path './target' -o -path './dist' -o -path './build' \) -prune \
  -o \( -name '.env*' -o -iname '*auth*' -o -iname '*secret*' -o -iname '*security*' -o -iname '*payment*' \) -print 2>/dev/null \
  | count_lines)"

shared_artifacts="$(find . -maxdepth 4 \
  \( -path './.git' -o -path './node_modules' -o -path './target' -o -path './dist' -o -path './build' \) -prune \
  -o \( -name 'package-lock.json' -o -name 'pnpm-lock.yaml' -o -name 'yarn.lock' -o -name 'Cargo.lock' -o -name 'go.sum' -o -name 'poetry.lock' -o -name 'Pipfile.lock' -o -path './*migrations*' -o -iname '*schema*' -o -iname '*generated*' \) -print 2>/dev/null \
  | count_lines)"

penalize_missing_skill "blitz"
penalize_missing_skill "dual-blitz"
penalize_missing_skill "overdrive"
penalize_missing_skill "proof-campaign"
penalize_missing_skill "run-the-rivers-dry"

if [ "$git_state" = "present" ]; then
  add_score blitz 5 "git repo"
  add_score dual-blitz 5 "git repo"
  add_score overdrive 10 "git repo"
  add_score proof-campaign 4 "git repo"
  add_score run-the-rivers-dry 4 "git repo"
else
  add_score overdrive -40 "overdrive needs git rollback"
  add_score blitz -8 "no git safety baseline"
  add_score dual-blitz -12 "no git safety baseline"
fi

if [ "$git_dirty" -eq 0 ]; then
  add_score blitz 5 "clean tree"
  add_score dual-blitz 8 "clean tree"
  add_score overdrive 12 "clean tree"
  add_score proof-campaign 5 "clean tree"
else
  add_score blitz -8 "dirty tree"
  add_score dual-blitz -15 "dirty tree"
  add_score overdrive -25 "dirty tree makes commits/stash riskier"
  add_score proof-campaign -8 "dirty tree"
  add_score run-the-rivers-dry -10 "dirty tree"
fi

if [ "$git_risky_dirty" -gt 0 ]; then
  add_score dual-blitz -20 "dirty shared-risk files"
  add_score overdrive -10 "dirty shared-risk files"
  add_score blitz -5 "dirty shared-risk files"
fi

if [ "$tracker" = "itr" ]; then
  add_score blitz 18 "tracker backlog"
  add_score dual-blitz 16 "tracker backlog"
  add_score overdrive 18 "tracker backlog"
  add_score proof-campaign 12 "tracker backlog"
  add_score run-the-rivers-dry 6 "tracker backlog"
else
  add_score blitz -25 "no tracker backlog"
  add_score dual-blitz -25 "no tracker backlog"
  add_score overdrive -20 "no tracker backlog"
  add_score proof-campaign -10 "no tracker backlog"
  add_score run-the-rivers-dry 10 "can operate from a broad brief"
fi

case "$open_count" in
  ''|unknown) ;;
  *)
    if [ "$open_count" -ge 12 ] 2>/dev/null; then
      add_score proof-campaign 15 "large backlog"
      add_score overdrive 18 "large backlog"
      add_score dual-blitz 16 "large backlog"
      add_score blitz 8 "large backlog"
      add_score run-the-rivers-dry 5 "large backlog"
    elif [ "$open_count" -ge 6 ] 2>/dev/null; then
      add_score blitz 16 "medium backlog"
      add_score dual-blitz 12 "medium backlog"
      add_score overdrive 12 "medium backlog"
      add_score proof-campaign 8 "medium backlog"
    elif [ "$open_count" -ge 2 ] 2>/dev/null; then
      add_score blitz 18 "small bounded backlog"
      add_score overdrive 6 "small bounded backlog"
      add_score proof-campaign -4 "campaign may be too heavy"
      add_score dual-blitz -8 "too little work for two lanes"
    elif [ "$open_count" -eq 1 ] 2>/dev/null; then
      add_score run-the-rivers-dry 8 "single hard item"
      add_score blitz 5 "single backlog item"
      add_score overdrive -8 "too little work for overdrive"
      add_score proof-campaign -15 "too little work for campaign"
      add_score dual-blitz -20 "too little work for two lanes"
    fi
    ;;
esac

if [ "$roadmap" != "absent" ]; then
  add_score proof-campaign 22 "roadmap available"
  add_score overdrive 6 "roadmap available"
  add_score run-the-rivers-dry 2 "roadmap available"
fi

if [ "$sprint_valid" = "yes" ]; then
  add_score blitz 16 "active sprint"
  add_score dual-blitz 10 "active sprint"
  add_score overdrive 5 "active sprint"
elif [ "$sprint_current" != "absent" ]; then
  add_score blitz -5 "invalid sprint/CURRENT"
  add_score dual-blitz -5 "invalid sprint/CURRENT"
  add_score proof-campaign 5 "drift-control useful"
fi

if [ "$campaign_valid" = "yes" ]; then
  add_score proof-campaign 12 "active campaign"
fi

if [ "$verify_gate" != "missing" ]; then
  add_score blitz 12 "verify gate detected"
  add_score dual-blitz 12 "verify gate detected"
  add_score overdrive 15 "verify gate detected"
  add_score proof-campaign 10 "verify gate detected"
  add_score run-the-rivers-dry 8 "verify gate detected"
else
  add_score blitz -20 "missing verify gate"
  add_score dual-blitz -20 "missing verify gate"
  add_score overdrive -30 "missing verify gate"
  add_score proof-campaign -10 "missing verify gate"
  add_score run-the-rivers-dry -5 "missing verify gate"
fi

if [ "$kgr_state" = "present" ]; then
  add_score blitz 5 "kgr present"
  add_score dual-blitz 5 "kgr present"
  add_score overdrive 5 "kgr present"
  add_score proof-campaign 4 "kgr present"
  add_score run-the-rivers-dry 4 "kgr present"
else
  add_score dual-blitz -4 "kgr absent"
fi

if [ "$security_markers" -gt 0 ]; then
  add_score proof-campaign 6 "security markers favor evidence/reporting"
  add_score blitz 4 "security markers favor explicit gates"
  add_score dual-blitz -4 "security markers increase lane risk"
  add_score overdrive -8 "security markers reduce hands-off autonomy"
  add_score run-the-rivers-dry -12 "security markers reduce maximum autonomy"
fi

if [ "$shared_artifacts" -gt 0 ]; then
  add_score dual-blitz -5 "shared artifacts present"
fi

if [ "$git_top_dirs" -ge 4 ] 2>/dev/null; then
  case "$open_count" in
    ''|unknown) ;;
    *)
      if [ "$open_count" -ge 8 ] 2>/dev/null; then
        add_score dual-blitz 10 "many tracked areas and enough work"
      fi
      ;;
  esac
fi

best="blitz"
best_score="$score_blitz"
for candidate in dual-blitz overdrive proof-campaign run-the-rivers-dry; do
  case "$candidate" in
    dual-blitz) candidate_score="$score_dual" ;;
    overdrive) candidate_score="$score_overdrive" ;;
    proof-campaign) candidate_score="$score_proof" ;;
    run-the-rivers-dry) candidate_score="$score_rivers" ;;
  esac
  if [ "$candidate_score" -gt "$best_score" ]; then
    best="$candidate"
    best_score="$candidate_score"
  fi
done

case "$best" in
  blitz) best_command='⚡ $blitz' ;;
  dual-blitz) best_command='🛣️ $dual-blitz' ;;
  overdrive) best_command='🚀 $overdrive --backlog' ;;
  proof-campaign) best_command='🧾 $proof-campaign' ;;
  run-the-rivers-dry) best_command='🌊 $run-the-rivers-dry --mortal' ;;
esac

if [ "$best_score" -ge 45 ]; then
  confidence_icon="🟢"
  confidence_text="high"
elif [ "$best_score" -ge 20 ]; then
  confidence_icon="🟡"
  confidence_text="medium"
else
  confidence_icon="🔴"
  confidence_text="low"
fi

if [ "$verify_gate" = "missing" ]; then
  verify_icon="🔴"
else
  verify_icon="🟢"
fi

if [ "$security_markers" -gt 0 ] || [ "$shared_artifacts" -gt 0 ]; then
  risk_icon="🟡"
else
  risk_icon="🟢"
fi

printf '🏁🏎️🔥 fastlane scan\n'
printf '  ⚙️ root: %s\n' "$ROOT"
printf '  ⚙️ git: %s branch=%s dirty=%s risky_dirty=%s commits=%s top_dirs=%s\n' "$git_state" "$git_branch" "$git_dirty" "$git_risky_dirty" "$git_has_commits" "$git_top_dirs"
printf '  ⚙️ tracker: %s (%s) open=%s\n' "$tracker" "$tracker_detail" "$open_count"
printf '  🧭 roadmap: %s\n' "$roadmap"
printf '  🧭 sprint: CURRENT=%s valid=%s\n' "$sprint_current" "$sprint_valid"
printf '  🧭 campaign: CURRENT=%s valid=%s\n' "$campaign_current" "$campaign_valid"
printf '  🧠 graph: kgr=%s\n' "$kgr_state"
printf '  🧪 verify: %s %s\n' "$verify_icon" "$verify_gate"
printf '  🛡️ risk: %s security_markers=%s shared_artifacts=%s\n' "$risk_icon" "$security_markers" "$shared_artifacts"
printf '  🧰 skills:\n'
printf '    proof-campaign: %s\n' "$(availability proof-campaign)"
printf '    blitz: %s\n' "$(availability blitz)"
printf '    dual-blitz: %s\n' "$(availability dual-blitz)"
printf '    overdrive: %s\n' "$(availability overdrive)"
printf '    run-the-rivers-dry: %s\n' "$(availability run-the-rivers-dry)"
printf '  🏁 scores:\n'
printf '    proof-campaign: %s (%s)\n' "$score_proof" "${reason_proof:-no strong signal}"
printf '    blitz: %s (%s)\n' "$score_blitz" "${reason_blitz:-no strong signal}"
printf '    dual-blitz: %s (%s)\n' "$score_dual" "${reason_dual:-no strong signal}"
printf '    overdrive: %s (%s)\n' "$score_overdrive" "${reason_overdrive:-no strong signal}"
printf '    run-the-rivers-dry: %s (%s)\n' "$score_rivers" "${reason_rivers:-no strong signal}"
printf '  ⚡ recommendation:\n'
printf '    pick: %s\n' "$best_command"
printf '    confidence: %s %s\n' "$confidence_icon" "$confidence_text"
printf '    note: read the selected skill and apply human safety judgment before execution\n'
