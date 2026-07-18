---
name: shell-prompt
description: Install a lightweight, framework-free zsh prompt (path + git branch with dirty markers + exit-status-colored prompt char) into the user's ~/.zshrc, using zsh's built-in vcs_info — no oh-my-zsh, powerlevel10k, or starship. Idempotent; backs up ~/.zshrc and rolls back on syntax error. Trigger when the user types /shell-prompt, or asks to install/add/set up a lightweight or git-aware shell prompt, customize their zsh prompt, or get a prompt without a heavy framework. Do NOT trigger for the Claude Code statusline (that lives in settings.json + statusline.sh, not the shell prompt).
---

# shell-prompt

Installs a lightweight, native-zsh prompt into `~/.zshrc`. No frameworks — git info comes from zsh's built-in `vcs_info`, so it stays fast (no extra `git` subprocess on every keystroke).

## What the prompt looks like

```
~/AI_Projects/skills  main* %     ← path (cyan) · branch (magenta) · dirty markers (yellow) · % (green/red)
~                  %              ← outside a repo: the git segment disappears
```

- `%~` — current path, `$HOME` shown as `~`
- branch segment — current git branch with `*` (unstaged) / `+` (staged) dirty markers; hidden outside a git repo
- trailing `%` (or `#` for root) — **green** on success, **red** when the last command exited non-zero

## How to run

Run the bundled script:

```bash
bash ~/.claude/skills/shell-prompt/append-prompt.sh
```

The script:
1. **Is idempotent** — if a `vcs_info` prompt (or this skill's marker) is already in `~/.zshrc`, it does nothing. (Note: if the prompt block was added manually before, the script detects it and will not duplicate it.)
2. **Backs up** `~/.zshrc` to `~/.zshrc.bak.<timestamp>` before writing.
3. **Appends** the prompt block, wrapped in `# >>> shell-prompt skill >>>` … `# <<< shell-prompt skill <<<` markers.
4. **Verifies** the result with `zsh -n` and restores the backup if the file no longer parses.

After it runs, tell the user to activate it in the current shell with `source ~/.zshrc`.

## Customizing

- **Shorter path:** change `%~` to `%2~` (last two folders) or `%1~` (current folder only).
- **Drop git info:** remove the `zstyle`/`vcs_info`/`add-zsh-hook` lines and the `${vcs_info_msg_0_}` reference in the `PROMPT` line.
- **Add a right-side clock:** append `RPROMPT='%F{8}%*%f'` after the `PROMPT=` line.

## Uninstall

Delete everything between the `# >>> shell-prompt skill >>>` and `# <<< shell-prompt skill <<<` markers in `~/.zshrc` (or restore a `~/.zshrc.bak.*` backup), then `source ~/.zshrc`.

## Commit policy

- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. This skill writes only `~/.zshrc`, which normally lives outside any git repo — a typical run has nothing tracked to commit. If `~/.zshrc` is tracked (e.g. a dotfiles repo), commit the change there.
