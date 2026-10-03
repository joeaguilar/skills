---
name: gitea
description: "Use the bundled `gitea` helper for anything that talks to the user's self-hosted Gitea server (SSH alias `gitea`, remotes like `gitea:blue/<repo>.git`, sometimes a remote named `nas`) instead of hand-rolling ls-remote probes, curl calls, or guessing hosts, ports, and repo names. Trigger whenever the user asks to clone or pull a repo \"from gitea\" or \"from the NAS\", push a project to Gitea or create a new Gitea repo, list their Gitea repos, add a Gitea remote, find the newest branch or which branches are merged or stale, clean up merged remote branches, or list/view/create/merge a pull request on Gitea — even when they just say \"the repo\" and its remote is `gitea:`. Do NOT trigger for GitHub repos or PRs (use `gh`), for filing or tracking issues (use itr), or for purely local git work (commits, rebases, local branches) that never talks to the server."
---

# gitea — drive the self-hosted Gitea

`scripts/gitea` (next to this file) is a stdlib-only Python CLI. Git traffic goes over the SSH alias and needs no token; everything else goes through the REST API and needs one. It derives the server address, web/API URL, and default owner by itself (from `~/.ssh/config` and the SSH greeting), so never hardcode the IP or ports in commands you write.

**Invoke** `<skill-dir>/scripts/gitea <subcommand>` from the Bash tool, where `<skill-dir>` is the base directory the runtime reports for this skill (fallback `~/.claude/skills/gitea`). Below it is written as `gitea`. From PowerShell or cmd, which cannot run that sh launcher, run `<skill-dir>\scripts\gitea.cmd …` instead. **First use in a session:** `gitea doctor` — it checks SSH auth, server reachability, the token, the default owner, and which Gitea repo the cwd belongs to.

## Which subcommand answers what

| ask | command | token |
|---|---|---|
| "pull/clone X from gitea" | `gitea clone X [dir] [--branch B] [--depth N]` | no |
| does repo X exist | `gitea exists X` (exit 0/1) | no |
| clone URL / web link | `gitea url [X] [--web]` | no |
| point this local repo at Gitea | `gitea remote X [--name N]` | no |
| newest branch, which are merged | `gitea branches [--unmerged] [--base B] [--json]` inside a clone | no |
| branches of a repo not cloned | `gitea branches X` (names + SHAs only) | no |
| delete merged remote branches | `gitea prune-merged [--match GLOB] [--keep GLOB]` → add `--apply` | no* |
| list my repos | `gitea repos [filter] [--json]` | yes |
| new repo / push this project | `gitea create NAME [--public] [-d TEXT] [--remote] [--push]` | yes |
| pull requests | `gitea pr list [--state all]`, `pr view N`, `pr diff N`, `pr create [--title T] [--push]`, `pr merge N [--style squash] [--delete-branch]` | yes |
| anything else (issues, releases, labels, webhooks…) | `gitea api METHOD path [--data JSON\|@file]` | usually |

\* With a token, `prune-merged` also refuses to delete a branch that heads an open PR.

**Repo arguments** are `name` (default owner), `owner/name`, or any Gitea remote URL; the server is case-insensitive. Inside a clone, `branches`, `prune-merged`, `url`, and `pr` infer the repo from whichever remote points at Gitea (preferring `origin`); pass `--repo owner/name` to `pr` to target another.

## Token

`repos`, `create`, `pr`, and most `api` calls need a token from `GITEA_TOKEN` or `~/.config/gitea/token`. When it is missing, the script prints the exact steps (web page, scopes, file location) — relay them. The user creates and saves the token themselves: never ask them to paste it into the chat, and never print, echo, or write it for them. Until it exists, say which part of the task needs it and do the SSH-only parts anyway.

Config overrides, if the defaults ever stop fitting (env var, or `KEY=VALUE` lines in `~/.config/gitea/config`): `GITEA_SSH_HOST` (default `gitea`), `GITEA_URL` (default `http://<alias HostName>:3000`), `GITEA_OWNER`.

## Recipes

```sh
gitea clone panthexia .                          # into the current, empty dir
gitea branches                                   # newest first; status vs the default branch
gitea prune-merged --match 'worktree-agent-*'    # dry run: shows what --apply would delete
gitea create my-tool --push                      # private repo, add remote, push current branch
gitea pr create --push                           # push this branch, PR into the default branch
gitea pr merge 12 --style squash --delete-branch
gitea api GET 'repos/blue/panthexia/issues?state=open'
```

## Conventions

- **"Latest branch" means newest commit date.** `gitea branches` sorts that way and marks the default branch.
- **`merged` means ahead 0**: the branch has no commits missing from the base. Squash-merged or cherry-picked work still shows `unmerged` — inspect `git log <base>..<branch>` or `git diff <base>...<branch>` before calling it lost work.
- **Confirm outward or destructive actions** — `create`, `pr create`, `pr merge`, `prune-merged --apply`, and `api` with POST/PATCH/PUT/DELETE — unless the user asked for exactly that. Run the dry run or read-only view first and show it.
- **Read every error.** The server is LAN-only: "cannot reach" means off-network or the server is down, so report it rather than retrying in a loop. A 404 without a token usually means a private repo, not a typo.
- **Write API paths without a leading slash** (`repos/…`). The launcher undoes Git Bash's `/path` → `C:/Program Files/Git/path` rewriting, but a slash-free path is immune everywhere. Browse the API at `<url>/api/swagger` for endpoints that have no subcommand.
- Prefer this helper over ad hoc `curl` or `git ls-remote` probing; fall back to `gitea api` rather than hand-building requests.

## Don't

- Don't use it for GitHub remotes (`gh`) or for issue tracking (itr).
- Don't delete branches the user wants kept. `prune-merged` is a dry run until `--apply` for exactly this reason.
- Don't handle the token in chat — see Token.
