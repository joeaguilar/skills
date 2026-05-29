# shell-prompt

A lightweight, framework-free **zsh prompt** for `~/.zshrc`. No oh-my-zsh, powerlevel10k, or starship — git info comes from zsh's built-in `vcs_info`, so it stays fast (no extra `git` subprocess on every keystroke).

## What it looks like

```
~/AI_Projects/skills  main* %     ← path (cyan) · branch (magenta) · dirty markers (yellow) · % (green/red)
~                  %              ← outside a repo: the git segment disappears
```

| Segment | Meaning |
|---------|---------|
| `%~` | current path, `$HOME` shown as `~` |
| branch | current git branch, with `*` (unstaged) / `+` (staged) dirty markers; hidden outside a repo |
| `%` / `#` | prompt char — **green** on success, **red** when the last command exited non-zero (`#` if root) |

## Install

```bash
bash append-prompt.sh
```

The script:

1. **Idempotent** — if a `vcs_info` prompt (or this skill's marker) is already in `~/.zshrc`, it does nothing.
2. **Backs up** `~/.zshrc` → `~/.zshrc.bak.<timestamp>` before writing.
3. **Appends** the prompt block, wrapped in `# >>> shell-prompt skill >>>` … `# <<< shell-prompt skill <<<` markers.
4. **Verifies** the result with `zsh -n`, restoring the backup if it no longer parses.

Then activate it:

```bash
source ~/.zshrc
```

## Customize

- **Shorter path:** change `%~` to `%2~` (last two folders) or `%1~` (current folder only).
- **Drop git info:** remove the `zstyle` / `vcs_info` / `add-zsh-hook` lines and the `${vcs_info_msg_0_}` reference in the `PROMPT` line.
- **Right-side clock:** add `RPROMPT='%F{8}%*%f'` after the `PROMPT=` line.

## Uninstall

Delete everything between the two `# >>> shell-prompt skill >>>` / `# <<< shell-prompt skill <<<` markers in `~/.zshrc` (or restore a `~/.zshrc.bak.*` backup), then `source ~/.zshrc`.

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Skill definition (agent-facing): frontmatter + instructions |
| `append-prompt.sh` | The installer script |
| `README.md` | This file (human-facing docs) |

## As a Claude Code skill

Invoke with `/shell-prompt` once this repo is the active skills source. See `SKILL.md` for the trigger phrasing.
