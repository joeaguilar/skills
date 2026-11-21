---
name: task-for-review
description: "Work in task-for-review mode, where every change is shaped so a human can review it easily: a worktree under `.claude/worktrees/`, small one-line Conventional Commits, stacked PRs that each carry one idea, evidence from a real run, and a PR description written for the reviewer. Not always on, but binding once it is, and it outranks conflicting commit, branch and PR instructions from other rules and skills. Trigger: `/task-for-review`, \"work in review mode\", \"make this easy to review\", \"stack this into PRs\", \"stacked PRs\", \"seed this project\", \"set up a new project for review\", \"run the review preflight\", or whenever a project's AGENTS.md or CLAUDE.md says it works in task-for-review mode. Do NOT trigger to review an existing diff or PR (use `/code-review`), to decide what to build (use `/spec-writer` or `/sprint`), for release tags (use `/auto-versioning`), or for Gitea chores such as cloning or pruning branches (use the `gitea` skill)."
---

# task-for-review — work shaped for the human reviewer

**Priority #1: the work must be easy for a human to review.** Every rule below serves that. When a rule is unclear, or two rules pull apart, do whatever makes the reviewer's job easier.

The rules are goals with their reasons, not procedures; how you reach them is your call. There are no numeric limits: size is judged against "can a person review this in one sitting".

## When it is on, and what it outranks

- **On** for a session when it is invoked, and for a whole project when that project's `AGENTS.md` (or `CLAUDE.md`) carries the line *"This project works in task-for-review mode: load the task-for-review skill before changing any tracked file."* Otherwise it is off and nothing here applies.
- **Binding while on.** Where another instruction conflicts with this skill (a global or project rules file, or another skill that says not to commit, to commit on the current branch, or to squash), this skill wins. Every instruction that does not conflict stays in force. A direct instruction from the user in the conversation beats this skill.
- **Inside another skill** (a backlog run, a sprint, a single-feature build): that skill decides what work is done and in what order; this one decides how it is committed, branched, verified and written up.
- **Agents you hand work to** do not inherit a session invocation. Put the mode's name and their worktree path in the brief.
- **Standing permission.** With the mode on you may, without asking: push the stack's branches and the `review-assets` branch, and open or update PRs on the project's own remotes. Force-push (with lease) only the stack's own branches, after a restack. Never merge a PR, never commit on or push to main, and never create a remote repository without confirming its name and visibility. Those are the user's.

## Before any work: preflight

Run `<skill-dir>/scripts/preflight.sh` from the project (`<skill-dir>` is the base directory the runtime reports for this skill; fallback `~/.claude/skills/task-for-review`). It is read-only and prints `key: value` facts, then:

- **`blocker:`** something that would stop the work from reaching a reviewable PR, with its fix after `->`. Fix what is yours to fix (a project that was never seeded: see rule 8). Relay the rest to the user with the exact command (a host login, a git identity). Do not start until it prints `ready: yes`, unless the user says to go on anyway.
- **`warn:`** worth knowing first. Tell the user in one message and keep going.
- **`worktree:`** a stack already in flight. Resume it instead of starting a second one for the same work.

<!-- claude-only -->
A login is interactive, so hand it to the user as a command to type at the prompt: `! gh auth login`.
<!-- /claude-only -->

## The rules

1. **One-line Conventional Commits, small and often.** `type(scope): summary`, with no body and no trailers. The scope is the ticket id when the work has one (`feat(itr-42): …`), otherwise the domain or module (`fix(auth): …`). *Why:* the log alone tells a reviewer what each step did and which ticket or area it belongs to.

2. **Slice for the reviewer.** A commit is one small step; a branch groups the commits of one larger idea. Before coding, write a short stack plan (each branch, the one idea it carries, what it sits on), show it, and keep going unless the split is a real judgment call.
   - *One idea per PR*, so it can be approved or rejected on its own.
   - *Mechanical changes apart from behavior* (renames, moves, formatting, generated files get their own commits), so they can be skimmed and the behavior read closely.
   - *Every commit stands alone*: it builds and passes the project's checks, so the reviewer can step through one commit at a time.
   - *A behavior change and its test land in the same commit*, so no commit asks for trust.

3. **Work in a worktree.** All work happens in `.claude/worktrees/<name>`, one worktree per stack. Parallel workstreams are independent stacks, each in its own worktree, each branching from main. *Why:* streams cannot collide, and the main checkout stays usable.

4. **Main is reserved.** The main checkout is the user's, for running and testing; the main branch moves only when a reviewed PR merges. Never edit or commit there. Every change to tracked files is a PR, even a one-commit typo fix (a stack of one). The single exception is the first commit of a brand-new project (rule 8). *Why:* with no exceptions, nobody has to judge what counts as "too small to review".

5. **Stacked PRs.** Each PR's base is the branch below it, built with plain git and the host's CLI. The title is the Conventional Commit line for the branch's idea; PRs open ready, not draft. The same stack applies on GitHub and Gitea. With no PR host, stack the branches anyway and put each description on the `review-assets` branch beside its evidence.
   - Before a PR opens, reorganise history freely. Once it is open, review fixes arrive as **new commits**; then restack the branches above and refresh the description. *Why:* the reviewer reads only what changed since their last look.
   - The user merges, bottom-up, without squashing, so the commit slices survive.
   - After the host confirms a PR merged: restack what remains onto main, delete the merged branch, and remove the worktree once its last branch has merged. Never remove a worktree that holds uncommitted or unpushed work.

6. **Verify by observing the real thing.** Observe the change through the surface a user would touch, and capture it: a browser or emulator screenshot for a UI, the actual command and its output as text for a CLI or API, a short driver script and its output for a library. Passing tests alone never count. *Why:* a reviewer can trust what they can see.
   - Every PR in a stack is verified at its own tip. A PR with nothing observable says so and points to the PR where the behavior first shows.
   - When you cannot observe the change (no emulator, a login, hardware, a paid service), open the PR anyway and state exactly what was not observed, why, and the steps for the reviewer to check it. Never imply a check that did not happen.

7. **Describe the PR for its reviewer.** Use the project's PR template when it has one, otherwise `templates/pr-description.md`. Sections, in order, dropping any that has nothing to say: **Breadcrumbs** (place in the stack) · **Screenshot / recording** (before and after when changing something that existed) · **What and Why** (ELI5, then ELI18, then technical; each gives the why) · **How to review** · **Changelog** (from `scripts/changelog.sh`; you write only the reasons) · **Verification** (what ran, what was observed, what was not) · **Risk and rollback** · **Not in this PR** · **Alternatives rejected**.

8. **Seed a project deterministically.** `scripts/seed.sh` does the part that never varies: `git init`, the ignore entry, `AGENTS.md` (the source of project facts, with the opt-in line), a `CLAUDE.md` that imports it, the PR template, `glossary.md`, the tracker, and the first commit. Then follow the `next:` lines it prints: the language stack by judgment in its own commit, the tracker snapshot, and remotes after confirming names and visibility. It is safe to re-run and never overwrites a file. On a project that already has commits it adds only what is missing, from a worktree, and that change reaches main as a PR.

## Look these up when the step arrives

| step | file |
|---|---|
| is everything in order | `scripts/preflight.sh` (`--help` lists every line it prints) |
| new project, or adopting an existing one | `scripts/seed.sh [--name NAME] [--dry-run] [ROOT]` |
| worktree, stacking, restacking, opening PRs, after a merge, cleanup | `stack.md` |
| the Changelog table | `scripts/changelog.sh [--fold] [BASE [HEAD]]` |
| screenshots and recordings into a PR | `scripts/assets.sh KEY FILE...` (prints the markdown to paste) |
| the PR description sections | `templates/pr-description.md` |

<!-- claude-only -->
Claude Code's own worktree tool and subagent worktree isolation already use `.claude/worktrees/`, so either may create the worktree. For evidence, the browser tools, the `/run` skill and an emulator's screenshot command are all fine; pick whichever shows the change as a user meets it.
<!-- /claude-only -->

## Don't

- Don't start on a `blocker:`. Fix it or relay it first.
- Don't commit, edit or run a build in the main checkout, and don't merge.
- Don't rewrite commits a reviewer may already have read.
- Don't leave a `WHY?` in a changelog, or an empty section heading, in a PR description.
- Don't claim verification from tests alone, or a check you did not run.
- Don't turn these rules into a checklist for their own sake: when following one to the letter would make the PR harder to review, say so and do the reviewable thing.
