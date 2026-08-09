# Multi-line statusline for Claude Code — native PowerShell port of statusline.sh.
# No jq / awk / sed / tput / date dependencies; uses built-in cmdlets only.
# Layout:
#   L1: identity   — [model ctx] [thinking] [effort] [agent] [wt] [vim] [style] ▓░ ctx%
#   L2: rate limit — 5h bar  pct  time  | 7d bar  pct  time
#   L3: itr        — ⣿⣀ pct% done · open N · in-prog N · done N · blocked N
#   L4: chrome     — ~/path [branch|wt:X] | session | version
# Rows hide entirely when their data isn't applicable (no rate_limits, no itr, no git).

$ErrorActionPreference = 'SilentlyContinue'

# Emit UTF-8 (box-drawing / braille glyphs) regardless of console codepage.
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch {}
try { $OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch {}

# ───── ANSI ─────
$e       = [char]27
$RESET   = "$e[0m"
$BOLD    = "$e[1m"
$DIM     = "$e[2m"
$ORANGE  = "$e[38;5;214m"
$PINK    = "$e[38;5;197m"
$BLUE    = "$e[38;5;39m"
$GREEN   = "$e[38;5;82m"
$YELLOW  = "$e[38;5;226m"
$RED     = "$e[38;5;196m"
$MAGENTA = "$e[38;5;207m"
$CYAN    = "$e[38;5;51m"
$GREY    = "$e[38;5;245m"

$ANSI_RE = [char]27 + '\[[0-9;]*m'

# ───── Glyphs (built from code points so the script body stays pure ASCII;
# PowerShell 5.1 reads a BOM-less .ps1 as the ANSI codepage, which would
# otherwise corrupt these multibyte characters). ─────
$GLYPH_CTX_FULL  = [char]0x2593  # light-shade block  ▓
$GLYPH_CTX_EMPTY = [char]0x2591  # dark-shade block   ░
$GLYPH_RL_FULL   = [char]0x2501  # heavy horizontal   ━
$GLYPH_RL_EMPTY  = [char]0x2500  # light horizontal   ─
$GLYPH_ITR_FULL  = [char]0x28FF  # full braille       ⣿
$GLYPH_ITR_EMPTY = [char]0x2840  # low braille        ⣀
$GLYPH_SEP       = [char]0x00B7  # middle dot         ·

# ───── Helpers ─────

# Safe nested JSON accessor: G $obj 'a.b.c' $default
function G($obj, [string]$path, $default) {
  $cur = $obj
  foreach ($p in $path.Split('.')) {
    if ($null -eq $cur) { return $default }
    $prop = $cur.PSObject.Properties[$p]
    if ($null -eq $prop) { return $default }
    $cur = $prop.Value
  }
  if ($null -eq $cur) { return $default }
  return $cur
}

# Trim to N visible chars with ellipsis when over.
function Truncate-Str([string]$s, [int]$n) {
  if ($s.Length -gt $n) { return $s.Substring(0, $n - 1) + [char]0x2026 }
  return $s
}

# Strip ANSI for width measurement.
function Strip-Ansi([string]$s) { return [regex]::Replace($s, $ANSI_RE, '') }

# Compact duration: "2d14", "3h12", "45m", "<1m", "now".
function Fmt-Duration([long]$s) {
  if ($s -le 0) { return 'now' }
  $d = [int][math]::Floor($s / 86400)
  $h = [int][math]::Floor(($s % 86400) / 3600)
  $m = [int][math]::Floor(($s % 3600) / 60)
  if     ($d -gt 0) { return ('{0}d{1:D2}' -f $d, $h) }
  elseif ($h -gt 0) { return ('{0}h{1:D2}' -f $h, $m) }
  elseif ($m -gt 0) { return ('{0}m' -f $m) }
  else              { return '<1m' }
}

# Render a progress bar at given percent and width.
function Render-Bar($pct, [int]$width, [string]$fillChar, [string]$emptyChar, [string]$color) {
  $v = [math]::Floor([double]$pct * $width / 100 + 0.5)
  if ($v -gt $width) { $v = $width }
  if ($v -lt 0)      { $v = 0 }
  $nFull = [int]$v
  $bar = ($fillChar * $nFull) + ($emptyChar * ($width - $nFull))
  return "$color$bar$RESET"
}

# Traffic-light color name for rate-limit bars.
function Traffic-Color($p) {
  $p = [double]$p
  if ($p -lt 60) { 'green' } elseif ($p -lt 85) { 'yellow' } else { 'red' }
}

# Blue→cyan ramp for itr completion bar (256-color codes).
function Itr-Ramp-Code($p) {
  $p = [double]$p
  if ($p -lt 33) { '39' } elseif ($p -lt 66) { '51' } else { '87' }
}

# ───── Parse input ─────
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }
$data = $raw | ConvertFrom-Json

$session_name   = [string](G $data 'session_name' '')
$session_id     = [string](G $data 'session_id' '')
$cwd            = [string](G $data 'cwd' '')
if (-not $cwd)  { $cwd = [string](G $data 'workspace.current_dir' '') }
$version        = [string](G $data 'version' '')
$model_name     = [string](G $data 'model.display_name' '') -replace '^Claude ', ''
if (-not $model_name) { $model_name = 'Claude' }
$model_id       = [string](G $data 'model.id' '')
$ctx_size       = [string](G $data 'context_window.context_window_size' '')
$ctx_used_pct   = G $data 'context_window.used_percentage' 0
$thinking_on    = G $data 'thinking.enabled' $false
$effort_level   = [string](G $data 'effort.level' '')
$agent_name     = [string](G $data 'agent.name' '')
$output_style   = [string](G $data 'output_style.name' '')
$vim_mode       = [string](G $data 'vim.mode' '')
$claude_wt_name = [string](G $data 'workspace.git_worktree' '')
if (-not $claude_wt_name) { $claude_wt_name = [string](G $data 'worktree.name' '') }
$rl_5h_pct      = [string](G $data 'rate_limits.five_hour.used_percentage' '')
$rl_5h_at       = [string](G $data 'rate_limits.five_hour.resets_at' '')
$rl_7d_pct      = [string](G $data 'rate_limits.seven_day.used_percentage' '')
$rl_7d_at       = [string](G $data 'rate_limits.seven_day.resets_at' '')

$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

# Width detection — prefer COLUMNS env, else console width, else 200.
$COLS = 200
if ($env:COLUMNS -match '^\d+$' -and [int]$env:COLUMNS -gt 0) {
  $COLS = [int]$env:COLUMNS
} else {
  $w = 0
  try { $w = $Host.UI.RawUI.WindowSize.Width } catch { $w = 0 }
  if ($w -gt 80) { $COLS = $w } else { $COLS = 200 }
}

# ───── Line 1: identity ─────
$ctx_str = '200k'
if ($ctx_size -match '^\d+$' -and [int64]$ctx_size -ge 1000000) { $ctx_str = '1M' }
elseif ($model_id -like '*1m*')                                  { $ctx_str = '1M' }

$display_name = if ($session_name) { $session_name }
               elseif ($session_id) { $session_id.Substring(0, [math]::Min(8, $session_id.Length)) }
               else { '' }
if (-not $display_name) { $display_name = 'claude' }

$badge_thinking = if ($thinking_on) { "$MAGENTA[thinking]$RESET" } else { '' }
$badge_effort   = if ($effort_level) { "$YELLOW[$(Truncate-Str $effort_level 24)]$RESET" } else { '' }
$badge_agent    = if ($agent_name) { "$CYAN[agent:$(Truncate-Str $agent_name 24)]$RESET" } else { '' }
$badge_wt       = if ($claude_wt_name) { "$BLUE[wt:$(Truncate-Str $claude_wt_name 24)]$RESET" } else { '' }
$badge_vim      = if ($vim_mode -and $vim_mode -ne 'NORMAL') { "$GREY[$vim_mode]$RESET" } else { '' }
$badge_style    = if ($output_style -and $output_style -ne 'default') { "$GREY[style:$(Truncate-Str $output_style 24)]$RESET" } else { '' }

$ctx_bar     = Render-Bar $ctx_used_pct 10 $GLYPH_CTX_FULL $GLYPH_CTX_EMPTY $GREEN
$ctx_pct_int = [int][math]::Floor([double]$ctx_used_pct + 0.5)

function Build-Line1($ia, $iwt, $ivim, $isty) {
  $s = "$ORANGE[$model_name $ctx_str]$RESET"
  if ($badge_thinking)              { $s += " $badge_thinking" }
  if ($badge_effort)                { $s += " $badge_effort" }
  if ($badge_agent -and $ia -eq 1)  { $s += " $badge_agent" }
  if ($badge_wt    -and $iwt -eq 1) { $s += " $badge_wt" }
  if ($badge_vim   -and $ivim -eq 1){ $s += " $badge_vim" }
  if ($badge_style -and $isty -eq 1){ $s += " $badge_style" }
  $s += " $ctx_bar $ctx_pct_int%"
  return $s
}

# Drop right-to-left when overflowing: style → vim → wt → agent.
$line1 = ''
foreach ($combo in @('1 1 1 1', '1 1 1 0', '1 1 0 0', '1 0 0 0', '0 0 0 0')) {
  $c = $combo.Split(' ')
  $candidate = Build-Line1 $c[0] $c[1] $c[2] $c[3]
  $line1 = $candidate
  if ((Strip-Ansi $candidate).Length -le $COLS) { break }
}

# ───── Line 2: rate limits ─────
function Render-Rl($pct, $at, [string]$label) {
  if (-not "$pct") { return $null }
  if ("$pct" -notmatch '^[0-9.]+$') { return $null }
  $color = switch (Traffic-Color $pct) {
    'green'  { $GREEN }
    'yellow' { $YELLOW }
    'red'    { $RED }
  }
  $bar = Render-Bar $pct 10 $GLYPH_RL_FULL $GLYPH_RL_EMPTY $color
  $pct_fmt = '{0:F1}%' -f [double]$pct
  $time_str = ''
  if ("$at" -match '^\d+$') {
    $time_str = " $DIM$(Fmt-Duration ([int64]$at - $now))$RESET"
  }
  return "$bar $pct_fmt $label$time_str"
}

$rl_parts = @()
$p = Render-Rl $rl_5h_pct $rl_5h_at '5h'; if ($p) { $rl_parts += $p }
$p = Render-Rl $rl_7d_pct $rl_7d_at '7d'; if ($p) { $rl_parts += $p }

# Any extra windows the harness starts emitting (e.g. a per-model weekly like
# seven_day_fable) render automatically with a label derived from the key.
$rl_obj = G $data 'rate_limits' $null
if ($rl_obj) {
  foreach ($prop in $rl_obj.PSObject.Properties) {
    if ($prop.Name -in @('five_hour', 'seven_day')) { continue }
    $label = $prop.Name -replace '^seven_day', '7d' -replace '^five_hour', '5h' -replace '_', '-'
    $p = Render-Rl ([string](G $prop.Value 'used_percentage' '')) ([string](G $prop.Value 'resets_at' '')) $label
    if ($p) { $rl_parts += $p }
  }
}

$line2 = ($rl_parts | Where-Object { $_ }) -join " $DIM|$RESET "

# ───── Line 3: itr ─────
$line3 = ''
if ((Get-Command itr -ErrorAction SilentlyContinue) -and $cwd) {
  $itr_json = ''
  try {
    Push-Location $cwd -ErrorAction Stop
    $itr_json = (& itr stats -f json 2>$null | Out-String)
  } catch {} finally { try { Pop-Location -ErrorAction SilentlyContinue } catch {} }

  if ($itr_json.Trim()) {
    $j = $null
    try { $j = $itr_json | ConvertFrom-Json } catch {}
    $total = [int](G $j 'total' 0)
    if ($total -gt 0) {
      $open    = [int](G $j 'by_status.open' 0)
      $inprog  = [int](G $j 'by_status.in-progress' 0)
      $done_n  = [int](G $j 'by_status.done' 0)
      $blocked = [int](G $j 'blocked' 0)

      $pct = [int][math]::Round($done_n * 100.0 / $total)
      $ramp_code = Itr-Ramp-Code $pct
      $bar = Render-Bar $pct 10 $GLYPH_ITR_FULL $GLYPH_ITR_EMPTY "$e[38;5;${ramp_code}m"
      $sep = "$DIM$GLYPH_SEP$RESET"
      $line3 = "$bar $pct% ${DIM}done$RESET $sep ${DIM}open$RESET $open $sep ${DIM}in-prog$RESET $inprog $sep ${DIM}done$RESET $done_n"
      if ($blocked -gt 0) { $line3 += " $sep ${RED}blocked $blocked$RESET" }
    }
  }
}

# ───── Line 4: chrome ─────
$display_dir = $cwd
if ($cwd -and $HOME -and $cwd.StartsWith($HOME)) {
  $display_dir = '~' + $cwd.Substring($HOME.Length)
}

$branch_or_wt = ''
if ($claude_wt_name) {
  $branch_or_wt = "$BLUE[wt:$(Truncate-Str $claude_wt_name 24)]$RESET"
} elseif ($cwd) {
  $br = (& git -C $cwd rev-parse --abbrev-ref HEAD 2>$null | Select-Object -First 1)
  if ($br) { $br = $br.Trim(); if ($br) { $branch_or_wt = "$BLUE[$(Truncate-Str $br 24)]$RESET" } }
}

$line4 = "$PINK$display_dir$RESET"
if ($branch_or_wt) { $line4 = "$line4 $branch_or_wt" }
if ($display_name) { $line4 = "$line4 $DIM|$RESET $BOLD$display_name$RESET" }
if ($version)      { $line4 = "$line4 $DIM|$RESET $GREY$version$RESET" }

# ───── Output ─────
$out = $line1 + "`n"
if ($line2) { $out += $line2 + "`n" }
if ($line3) { $out += $line3 + "`n" }
$out += $line4
[Console]::Out.Write($out)
