#!/usr/bin/env bash
#
# append-prompt.sh — install a lightweight, framework-free zsh prompt into ~/.zshrc.
#
# The prompt shows:  <path>  <git-branch + */+ dirty markers>  <%-or-#, green/red by exit status>
# It uses zsh's built-in vcs_info — no oh-my-zsh, powerlevel10k, or starship.
#
# Safe to re-run: detects an existing install (marker or vcs_info hook) and does nothing.
# Backs up ~/.zshrc before writing, and rolls back if the result fails `zsh -n`.

set -euo pipefail

ZSHRC="${ZDOTDIR:-$HOME}/.zshrc"
MARKER="# >>> shell-prompt skill >>>"

# --- idempotency -------------------------------------------------------------
if [ -f "$ZSHRC" ] && { grep -qF "$MARKER" "$ZSHRC" || grep -qF 'add-zsh-hook precmd vcs_info' "$ZSHRC"; }; then
  echo "✓ A vcs_info-based prompt is already present in $ZSHRC — nothing to do."
  exit 0
fi

# --- backup ------------------------------------------------------------------
if [ ! -f "$ZSHRC" ]; then
  echo "No $ZSHRC found; creating it."
  : > "$ZSHRC"
fi
backup="${ZSHRC}.bak.$(date +%Y%m%d%H%M%S)"
cp "$ZSHRC" "$backup"
echo "Backed up $ZSHRC → $backup"

# --- append ------------------------------------------------------------------
cat >> "$ZSHRC" <<'BLOCK'

# >>> shell-prompt skill >>>
# Lightweight prompt: path + git branch (with dirty markers) + status-colored prompt char.
setopt PROMPT_SUBST
autoload -Uz vcs_info add-zsh-hook

zstyle ':vcs_info:git:*' check-for-changes true
zstyle ':vcs_info:git:*' unstagedstr '*'                       # working-tree changes
zstyle ':vcs_info:git:*' stagedstr   '+'                       # staged changes
zstyle ':vcs_info:git:*' formats       ' %F{magenta}%b%f%F{yellow}%u%c%f'
zstyle ':vcs_info:git:*' actionformats ' %F{magenta}%b|%a%f%F{yellow}%u%c%f'

add-zsh-hook precmd vcs_info                                   # refresh git info per prompt

PROMPT='%F{cyan}%~%f${vcs_info_msg_0_} %(?.%F{green}.%F{red})%#%f '
# <<< shell-prompt skill <<<
BLOCK
echo "Appended lightweight prompt block to $ZSHRC"

# --- verify ------------------------------------------------------------------
if command -v zsh >/dev/null 2>&1; then
  if zsh -n "$ZSHRC"; then
    echo "✓ zsh syntax OK"
  else
    echo "✗ zsh syntax error — restoring backup"
    cp "$backup" "$ZSHRC"
    exit 1
  fi
fi

echo
echo "Done. Activate it with:  source \"$ZSHRC\""
