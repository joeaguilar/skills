# Stack mechanics

Commands for the parts of a stack that are easy to get wrong. Everything here is plain git plus the host's CLI (`gh` for GitHub, the `gitea` helper for Gitea). `<main>` is the `main-branch` line of `preflight.sh`; `<remote>` is the remote the project reviews on. `AGENTS.md` names that remote under Review; when a project has several remotes and none is named, ask once and record the answer there.

## Start a stack

```sh
git fetch <remote>
git worktree add .claude/worktrees/<stack> -b <first-branch> <remote>/<main>   # no remote: <main>
cd .claude/worktrees/<stack>
```

Each further layer is a branch cut from the one below, in the same worktree: `git switch -c <next-branch>`. Name branches after their idea (`feat/retry-parser`), not their position, since positions change as lower PRs merge.

## Open the PRs, bottom first

```sh
git push -u <remote> <branch>
gh pr create --base <branch-below-or-main> --head <branch> --title "<type(scope): summary>" --body-file <file>
gitea pr create --base <branch-below-or-main> --head <branch> --title "<type(scope): summary>" --body-file <file>
```

Write the body to a file outside the worktree (a temp folder), so it never lands in a commit. Breadcrumbs need every PR's number, so open the whole stack first and then update each description:

```sh
gh pr edit <number> --body-file <file>
gitea api PATCH repos/<owner>/<repo>/pulls/<number> --data @<json-file>      # {"body": "..."}
```

Then look at each PR on the host once: the base is the branch below, the images render, and the diff shows only that branch's idea. If an image does not render, say so in the description instead of leaving a broken picture.

## No PR host

Stack the branches the same way. Write each description to `PR.md` in a temp folder and store it with its evidence:

```sh
<skill-dir>/scripts/assets.sh <branch> PR.md shot.png
```

Tell the reviewer how to read it: `git show review-assets:<branch>/PR.md`, or `git worktree add --detach .claude/worktrees/review-assets review-assets` to browse it with the pictures beside it. Keep `--detach`: `assets.sh` refuses to move the branch while a worktree has it checked out.

## A lower branch changed (review fix, or a slip found later)

Commit the fix on the branch it belongs to, then carry the branches above it along in one move, from the top of the stack:

```sh
git switch <top-branch>
git rebase --update-refs <changed-branch>
git push --force-with-lease <remote> <each-branch-above-the-changed-one>
git push <remote> <changed-branch>          # a plain push: it only gained commits
```

`--update-refs` moves every branch between the changed one and the top, except a branch that is checked out in another worktree: git leaves that one where it was. If the user has a middle branch checked out in the main checkout to test it, ask them to switch off it first, or the push will publish that layer stale. Check with `git worktree list` before restacking. Without it (the `update-refs: no` line of preflight) rebase each branch onto the one below, bottom to top. Afterwards rerun `changelog.sh` and the evidence for the PRs whose commits moved, and update their descriptions.

## After the user merges the bottom PR

Confirm with the host, never from local state: `gh pr view <number> --json state,mergedAt`, or `gitea pr view <number>`.

```sh
git fetch <remote>
git switch <top-branch>
git rebase --update-refs --onto <remote>/<main> <merged-branch>
git push --force-with-lease <remote> <each-remaining-branch>
```

The next PR up now targets main. GitHub retargets it when the merged branch is deleted on the host; otherwise:

```sh
gh pr edit <number> --base <main>
gitea api PATCH repos/<owner>/<repo>/pulls/<number> --data '{"base":"<main>"}'
```

Update the breadcrumbs of the PRs that remain.

## Cleanup

A merged branch that is not the one checked out in the worktree:

```sh
git branch -D <merged-branch>                     # -d refuses after a rebase-merge; the host already confirmed the merge
git push <remote> --delete <merged-branch>        # skip if the host deleted it
```

The last branch of the stack is the one the worktree has checked out, and git will not delete a checked-out branch. So the worktree goes first, and from outside it:

```sh
git log --branches --not --remotes                # inside the worktree: must print nothing that belongs to this stack
git -C <main-checkout> worktree remove .claude/worktrees/<stack>
git -C <main-checkout> branch -D <last-branch>
git push <remote> --delete <last-branch>          # skip if the host deleted it
```

`<main-checkout>` is the `main-checkout` line of preflight. Removing a worktree and deleting a branch change no file there, so this does not break rule 4. `git worktree remove` refuses a worktree with uncommitted changes. Never add `--force`; find out what the changes are.
