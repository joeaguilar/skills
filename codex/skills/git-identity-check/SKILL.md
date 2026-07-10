---
name: git-identity-check
description: "Use when the user asks to audit git author identity, user.name/email overrides, historical author drift, or inconsistent repository configuration across one or more repos. Report and optionally fix configuration only when requested; never rewrite commit history."
---

# git-identity-check

Read-only audit of git author identity across repos. Two things can be wrong
independently — check both:

1. **Local override** — a repo's `.git/config` pins `user.name`/`user.email`,
   shadowing the global value. Future commits there keep using the old identity
   even after the global config is fixed.
2. **Historical commits** — past commits (already made, possibly pushed)
   authored under a different email or name alias.

## How to run it

For each target repo (default: every `.git` dir directly under the given base
path, or the repos explicitly named by the user):

```sh
cd <repo>
git config --local --get user.name; git config --local --get user.email
git config --get user.name; git config --get user.email
git log --format='%an <%ae>' | sort -u
git remote -v | head -2
```

Report a compact table per repo: local override (yes/no + value), resolved
identity, and any historical author strings that don't match the intended
identity.

## Fixing what you find

- **Local override present and wrong** -> safe, local-only, reversible:
  `git config --local --unset user.email` (and `user.name` if also overridden)
  so the repo falls back to global. Fine to do without extra confirmation once
  the user has approved the audit/fix.
- **Historical commits under the old identity** -> do **not** rewrite. Flag it
  and stop. This needs `filter-branch`/`git filter-repo` plus force-push, is
  irreversible for anyone who already cloned/forked, and is explicitly excluded
  from this skill's scope. Only act on it if the user separately and explicitly
  asks for a history rewrite on that specific repo.

## Notes

- Prefer `git config --local` (not `--global`) checks to detect overrides.
  `git config --get` alone won't tell you which level supplied the value.
- A repo with a GitHub/GitLab `origin` remote counts as published; call that out
  explicitly when flagging history issues so the user weighs the blast radius
  before deciding.
