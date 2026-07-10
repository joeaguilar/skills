---
name: shell-prompt
description: "Use only when the user explicitly invokes $shell-prompt or asks to install or customize the repository's lightweight native-zsh git prompt in ~/.zshrc using vcs_info. Do not use for oh-my-zsh, Powerlevel10k, Starship, bash/fish prompts, or unrelated shell configuration."
---

# Shell Prompt

Install a lightweight native-zsh prompt into `~/.zshrc`. Git info comes from zsh's built-in `vcs_info`, so the prompt avoids extra `git` subprocesses on every keystroke.

## What the prompt looks like

```
~/AI_Projects/skills  main* %     path + branch + dirty marker + prompt char
~                  %              outside a repo, the git segment disappears
```

- `%~`: current path, with `$HOME` shown as `~`
- branch segment: current git branch with `*` for unstaged changes and `+` for staged changes; hidden outside a git repo
- trailing `%` or `#`: green on success and red when the last command exited non-zero

## How to run

Run the bundled script from the installed Codex skill:

```bash
bash ~/.codex/skills/shell-prompt/scripts/append-prompt.sh
```

The script:

1. Is idempotent: if a `vcs_info` prompt or this skill's marker is already in `~/.zshrc`, it does nothing.
2. Backs up `~/.zshrc` to `~/.zshrc.bak.<timestamp>` before writing.
3. Appends the prompt block, wrapped in `# >>> shell-prompt skill >>>` and `# <<< shell-prompt skill <<<` markers.
4. Verifies the result with `zsh -n` and restores the backup if the file no longer parses.

After it runs, tell the user to activate it in the current shell with `source ~/.zshrc`.

## Customizing

- **Shorter path:** change `%~` to `%2~` (last two folders) or `%1~` (current folder only).
- **Drop git info:** remove the `zstyle`/`vcs_info`/`add-zsh-hook` lines and the `${vcs_info_msg_0_}` reference in the `PROMPT` line.
- **Add a right-side clock:** append `RPROMPT='%F{8}%*%f'` after the `PROMPT=` line.

## Uninstall

Delete everything between the `# >>> shell-prompt skill >>>` and `# <<< shell-prompt skill <<<` markers in `~/.zshrc` (or restore a `~/.zshrc.bak.*` backup), then `source ~/.zshrc`.
