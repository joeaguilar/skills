#!/usr/bin/env bash
# Multi-line statusline for Claude Code.
# Layout:
#   L1: identity   — session [model ctx] [thinking] [effort] [agent] [wt] [vim] [style] ▓░ ctx%
#   L2: rate limit — 5h bar  pct  time  | 7d bar  pct  time
#   L3: itr        — ⣿⣀ pct% done · open N · in-prog N · done N · blocked N
#   L4: chrome     — ~/path [branch|wt:X] | version
# Rows hide entirely when their data isn't applicable (no rate_limits, no .itr.db, no git).

input=$(cat)

# ───── ANSI ─────
ESC=$'\033'
RESET="${ESC}[0m"
BOLD="${ESC}[1m"
DIM="${ESC}[2m"
ORANGE="${ESC}[38;5;214m"
PINK="${ESC}[38;5;197m"
BLUE="${ESC}[38;5;39m"
GREEN="${ESC}[38;5;82m"
YELLOW="${ESC}[38;5;226m"
RED="${ESC}[38;5;196m"
MAGENTA="${ESC}[38;5;207m"
CYAN="${ESC}[38;5;51m"
GREY="${ESC}[38;5;245m"

# ───── Helpers ─────

# Trim a string to N visible chars with ellipsis when over.
truncate_str() {
  local s="$1" n="$2"
  if [ "${#s}" -gt "$n" ]; then
    printf '%s…' "${s:0:$((n-1))}"
  else
    printf '%s' "$s"
  fi
}

# Strip ANSI for width measurement.
strip_ansi() {
  printf '%s' "$1" | sed $'s/\033\\[[0-9;]*m//g'
}

# Compact duration: "2d14", "3h12", "45m", "<1m", "now"
fmt_duration() {
  local s=$1
  if ! [[ "$s" =~ ^-?[0-9]+$ ]]; then printf '?'; return; fi
  if [ "$s" -le 0 ]; then printf 'now'; return; fi
  local d=$((s/86400))
  local h=$(( (s%86400)/3600 ))
  local m=$(( (s%3600)/60 ))
  if   [ "$d" -gt 0 ]; then printf '%dd%02d' "$d" "$h"
  elif [ "$h" -gt 0 ]; then printf '%dh%02d' "$h" "$m"
  elif [ "$m" -gt 0 ]; then printf '%dm' "$m"
  else                      printf '<1m'
  fi
}

# Render a progress bar at given percent and width.
render_bar() {
  local pct="$1" width="$2" fill_char="$3" empty_char="$4" color="$5"
  local n_full
  n_full=$(awk -v p="$pct" -v w="$width" 'BEGIN {
    v = int(p*w/100 + 0.5); if (v>w) v=w; if (v<0) v=0; printf "%d", v
  }')
  local n_empty=$((width - n_full)) bar="" i
  for ((i=0; i<n_full; i++));  do bar+="$fill_char";  done
  for ((i=0; i<n_empty; i++)); do bar+="$empty_char"; done
  printf '%s%s%s' "$color" "$bar" "$RESET"
}

# Traffic-light color for rate-limit bars.
traffic_color() {
  awk -v p="$1" 'BEGIN {
    if (p < 60)      print "green"
    else if (p < 85) print "yellow"
    else             print "red"
  }'
}

# Blue→cyan ramp for itr completion bar (256-color codes).
itr_ramp_code() {
  awk -v p="$1" 'BEGIN {
    if (p < 33)      print "39"   # blue
    else if (p < 66) print "51"   # cyan
    else             print "87"   # bright cyan
  }'
}

# ───── Parse input (single jq call) ─────
fields=()
while IFS= read -r __line; do fields+=("$__line"); done < <(jq -r '
  .session_name // "",
  .session_id // "",
  .cwd // .workspace.current_dir // "",
  .version // "",
  (.model.display_name // "" | sub("^Claude "; "")),
  .model.id // "",
  (.context_window.context_window_size // "" | tostring),
  (.context_window.used_percentage // 0 | tostring),
  (.thinking.enabled // false | tostring),
  .effort.level // "",
  .agent.name // "",
  .output_style.name // "",
  .vim.mode // "",
  .workspace.git_worktree // .worktree.name // "",
  (.rate_limits.five_hour.used_percentage // "" | tostring),
  (.rate_limits.five_hour.resets_at // "" | tostring),
  (.rate_limits.seven_day.used_percentage // "" | tostring),
  (.rate_limits.seven_day.resets_at // "" | tostring)
' <<<"$input" 2>/dev/null)

session_name="${fields[0]}"
session_id="${fields[1]}"
cwd="${fields[2]}"
version="${fields[3]}"
model_name="${fields[4]:-Claude}"
model_id="${fields[5]}"
ctx_size="${fields[6]}"
ctx_used_pct="${fields[7]:-0}"
thinking_on="${fields[8]}"
effort_level="${fields[9]}"
agent_name="${fields[10]}"
output_style="${fields[11]}"
vim_mode="${fields[12]}"
claude_wt_name="${fields[13]}"
rl_5h_pct="${fields[14]}"
rl_5h_at="${fields[15]}"
rl_7d_pct="${fields[16]}"
rl_7d_at="${fields[17]}"

now=$(date +%s)

# Width detection — prefer COLUMNS env (Claude typically sets it). Only fall back
# to tput when COLUMNS is absent, and treat tput's 80-default-in-pipe as "no signal".
COLS=""
if [[ "$COLUMNS" =~ ^[0-9]+$ ]] && [ "$COLUMNS" -gt 0 ]; then
  COLS="$COLUMNS"
else
  COLS=$(tput cols 2>/dev/null)
  if ! [[ "$COLS" =~ ^[0-9]+$ ]] || [ "$COLS" -le 80 ]; then
    COLS=200
  fi
fi

# ───── Line 1: identity ─────

# Context size label
ctx_str="200k"
if [[ "$ctx_size" =~ ^[0-9]+$ ]] && [ "$ctx_size" -ge 1000000 ]; then
  ctx_str="1M"
elif [[ "$model_id" == *"1m"* ]]; then
  ctx_str="1M"
fi

display_name="${session_name:-${session_id:0:8}}"
[ -z "$display_name" ] && display_name="claude"

# Conditional badges
badge_thinking=""; [ "$thinking_on" = "true" ] && badge_thinking="${MAGENTA}[thinking]${RESET}"
badge_effort="";   [ -n "$effort_level" ] && badge_effort="${YELLOW}[$(truncate_str "$effort_level" 24)]${RESET}"
badge_agent="";    [ -n "$agent_name" ]  && badge_agent="${CYAN}[agent:$(truncate_str "$agent_name" 24)]${RESET}"
badge_wt="";       [ -n "$claude_wt_name" ] && badge_wt="${BLUE}[wt:$(truncate_str "$claude_wt_name" 24)]${RESET}"
badge_vim="";      if [ -n "$vim_mode" ] && [ "$vim_mode" != "NORMAL" ]; then badge_vim="${GREY}[$vim_mode]${RESET}"; fi
badge_style="";    if [ -n "$output_style" ] && [ "$output_style" != "default" ]; then badge_style="${GREY}[style:$(truncate_str "$output_style" 24)]${RESET}"; fi

# Context bar
ctx_bar=$(render_bar "$ctx_used_pct" 10 "▓" "░" "$GREEN")
ctx_pct_int=$(awk -v p="$ctx_used_pct" 'BEGIN { printf "%d", p+0.5 }')

build_line1() {
  local ia=$1 iwt=$2 ivim=$3 isty=$4
  local s="${ORANGE}[${model_name} ${ctx_str}]${RESET}"
  [ -n "$badge_thinking" ] && s+=" $badge_thinking"
  [ -n "$badge_effort" ]   && s+=" $badge_effort"
  [ -n "$badge_agent" ] && [ "$ia" = 1 ]   && s+=" $badge_agent"
  [ -n "$badge_wt" ]    && [ "$iwt" = 1 ]  && s+=" $badge_wt"
  [ -n "$badge_vim" ]   && [ "$ivim" = 1 ] && s+=" $badge_vim"
  [ -n "$badge_style" ] && [ "$isty" = 1 ] && s+=" $badge_style"
  s+=" ${ctx_bar} ${ctx_pct_int}%"
  printf '%s' "$s"
}

# Drop right-to-left when overflowing: style → vim → wt → agent.
line1=""
for combo in "1 1 1 1" "1 1 1 0" "1 1 0 0" "1 0 0 0" "0 0 0 0"; do
  read -r ia iwt ivim isty <<< "$combo"
  candidate=$(build_line1 "$ia" "$iwt" "$ivim" "$isty")
  line1="$candidate"
  visible=$(strip_ansi "$candidate")
  [ "${#visible}" -le "$COLS" ] && break
done

# ───── Line 2: rate limits ─────

render_rl() {
  local pct="$1" at="$2" label="$3"
  [ -z "$pct" ] && return 1
  [[ "$pct" =~ ^[0-9.]+$ ]] || return 1
  local color
  case "$(traffic_color "$pct")" in
    green)  color="$GREEN"  ;;
    yellow) color="$YELLOW" ;;
    red)    color="$RED"    ;;
  esac
  local bar pct_fmt time_str=""
  bar=$(render_bar "$pct" 10 "━" "─" "$color")
  pct_fmt=$(awk -v p="$pct" 'BEGIN { printf "%.1f%%", p }')
  if [[ "$at" =~ ^[0-9]+$ ]]; then
    time_str=" ${DIM}$(fmt_duration $((at - now)))${RESET}"
  fi
  printf '%s %s %s%s' "$bar" "$pct_fmt" "$label" "$time_str"
}

line2=""
rl_parts=()
part=$(render_rl "$rl_5h_pct" "$rl_5h_at" "5h") && [ -n "$part" ] && rl_parts+=("$part")
part=$(render_rl "$rl_7d_pct" "$rl_7d_at" "7d") && [ -n "$part" ] && rl_parts+=("$part")
if [ "${#rl_parts[@]}" -eq 1 ]; then
  line2="${rl_parts[0]}"
elif [ "${#rl_parts[@]}" -ge 2 ]; then
  line2="${rl_parts[0]} ${DIM}|${RESET} ${rl_parts[1]}"
fi

# ───── Line 3: itr ─────

line3=""
if command -v itr >/dev/null 2>&1 && [ -n "$cwd" ]; then
  itr_json=$(cd "$cwd" 2>/dev/null && itr stats -f json 2>/dev/null)
  if [ -n "$itr_json" ]; then
    total=$(jq -r '.total // 0' <<<"$itr_json" 2>/dev/null)
    if [[ "$total" =~ ^[0-9]+$ ]] && [ "$total" -gt 0 ]; then
      open=$(jq -r '.by_status.open // 0' <<<"$itr_json")
      inprog=$(jq -r '.by_status."in-progress" // 0' <<<"$itr_json")
      done_n=$(jq -r '.by_status.done // 0' <<<"$itr_json")
      blocked=$(jq -r '.blocked // 0' <<<"$itr_json")

      pct=$(awk -v d="$done_n" -v t="$total" 'BEGIN { printf "%.0f", d*100/t }')
      ramp_code=$(itr_ramp_code "$pct")
      bar=$(render_bar "$pct" 10 "⣿" "⣀" "${ESC}[38;5;${ramp_code}m")
      sep="${DIM}·${RESET}"
      line3="$bar ${pct}% ${DIM}done${RESET} $sep ${DIM}open${RESET} $open $sep ${DIM}in-prog${RESET} $inprog $sep ${DIM}done${RESET} $done_n"
      if [[ "$blocked" =~ ^[0-9]+$ ]] && [ "$blocked" -gt 0 ]; then
        line3+=" $sep ${RED}blocked $blocked${RESET}"
      fi
    fi
  fi
fi

# ───── Line 4: chrome ─────

display_dir="$cwd"
if [ -n "$cwd" ] && [ -n "$HOME" ] && [[ "$cwd" == "$HOME"* ]]; then
  display_dir="~${cwd#$HOME}"
fi

branch_or_wt=""
if [ -n "$claude_wt_name" ]; then
  branch_or_wt="${BLUE}[wt:$(truncate_str "$claude_wt_name" 24)]${RESET}"
elif [ -n "$cwd" ]; then
  br=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null)
  [ -n "$br" ] && branch_or_wt="${BLUE}[$(truncate_str "$br" 24)]${RESET}"
fi

line4="${PINK}${display_dir}${RESET}"
[ -n "$branch_or_wt" ]  && line4="$line4 $branch_or_wt"
[ -n "$display_name" ] && line4="$line4 ${DIM}|${RESET} ${BOLD}${display_name}${RESET}"
[ -n "$version" ]      && line4="$line4 ${DIM}|${RESET} ${GREY}${version}${RESET}"

# ───── Output ─────
printf '%s\n' "$line1"
[ -n "$line2" ] && printf '%s\n' "$line2"
[ -n "$line3" ] && printf '%s\n' "$line3"
printf '%s' "$line4"
