---
name: itr-snapshot
description: "Make an itr issue tracker travel with its git repo: keep `.itr.db` gitignored and track a deterministic `itr export` snapshot at `.itr/issues.jsonl`, guarded by a normalizing freshness check, with `--write` / `--restore` recipes wired into the repo's task runner and docs, then PROVE it with the bundled verification battery under gatr and commit. Trigger whenever the user wants itr issues committed, versioned, synced between machines/clones/remotes, restored on a fresh clone, or asks why a clone has no issues, mentions `.itr.db` in git, `git add .itr.db`, an itr export/backup/snapshot, or wants the itr equivalent of 'gitignore the output, track the reviewed snapshot' — even if they don't say 'snapshot'. Also use it to re-verify or upgrade an existing snapshot setup. Do NOT trigger for filing/claiming/closing issues (use the itr skill), for gitignoring non-itr artifacts, or for committing the SQLite file itself (this skill exists because that churns)."
---

# itr-snapshot — track the issue tracker as a diffable snapshot

`.itr.db` is a SQLite file. Committing it churns a multi-megabyte binary on
every `itr close` and cannot merge; gitignoring it (the usual fix) means a
fresh clone has **no issues** while the repo's docs and commits reference
`itr#NNN` ids everywhere. The way out is the same split used for generated
test evidence: the live output stays gitignored, the reviewed snapshot is
tracked.

`itr export` (itr ≥ 3.3.1) is byte-deterministic, id-sorted JSONL — one line
per issue bundling the issue row with its notes, audit events, blockers and
relations — and `itr import` restores it into a fresh database with issue ids
preserved. So the tracked file `.itr/issues.jsonl` is a faithful, greppable,
line-diffable form of the tracker, and `git log -p` on it is the tracker's
history.

## What you install in the target repo

| Piece | Purpose |
|---|---|
| `scripts/itr_snapshot_check.py` | copied from this skill's `scripts/`. `--write` regenerates the snapshot atomically (never truncates on a failed/empty export); default mode compares a fresh export to the file and exits 1 naming added/removed/changed issue ids; `--restore` rebuilds the DB (`itr init` if none, then `itr import`); `--strict`; `--root DIR`. |
| task-runner recipes | `itr-snapshot` (write), `itr-snapshot-check`, `itr-restore`; the check appended to the repo's lint/ci/docs-lint gate so a stale snapshot fails the gate like a stale lockfile. |
| `.gitignore` | `.itr.db` and `.itr.db-*` (WAL/shm sidecars) — never the snapshot. |
| docs | the repo's itr section (CONTRIBUTING / CLAUDE.md / AGENTS.md — whichever it already uses) gains: fresh clone → restore; after tracker changes → snapshot + commit; one writer at a time. |
| `.itr/issues.jsonl` | the snapshot itself, written last so it includes any issue you filed for this work. |

Run `scripts/verify_itr_snapshot.sh <repo-root>` (bundled here) under gatr
before committing. It only touches scratch databases and asserts the tracked
snapshot's hash is unchanged.

## Why the check normalizes

`itr import` preserves **issue** ids but assigns fresh surrogate row ids to
notes, events and relations. A restored clone therefore exports identical
content with different `id` fields on those rows. The check strips those ids
and sorts the rows before comparing, so a restored clone passes while any real
change (issue fields, note text, event history, blockers, relations) still
fails. Expect one noisy-but-harmless diff of those `id` fields the first time
a machine snapshots after restoring.

Second normalization: `itr import` drops blocker edges whose blocker issue is
already done/wontfix — the same pruning `itr close` performs (its `REVIEW:
import removed N blocker edge(s) from done/wontfix issues` line says so). A
database that still carries such stale edges exports them, a restored clone
does not, so the check ignores a `blocked_by` entry whenever its blocker is
resolved on that side. Three of four repos this was first applied to carried
such edges (2, 1 and 12); wisphive had none, which is why its round-trip was
byte-clean and the others were not. The check prints a `NOTE:` with the count
it ignored so the pending pruning stays visible; `itr doctor --fix` clears
them from the live database, but that is the tracker owner's call. Edges added
*after* the blocker was resolved come back until itr refuses them (itr#293 in
itr's own tracker).

## Procedure

1. **Preflight the tool, not the story.** `itr --version` ≥ 3.3.1. If in
   doubt, prove the round-trip on a scratch DB before touching the repo:
   `itr export > /tmp/s.jsonl; itr --db /tmp/rt.db init; itr --db /tmp/rt.db import --file /tmp/s.jsonl`
   must import every issue, note, event, dependency and relation (the
   `IMPORT:` line lists the counts). Older importers abort on forward
   references with a foreign-key error.
2. **Survey the layout** — this decides where things go:
   - `git rev-parse --show-toplevel` from the repo; `itr stats` from the same
     place shows which database walk-up resolves (it may live in a **parent**
     directory — a monorepo root). The snapshot belongs in the git repo that
     will carry it; the DB may legitimately live above it. If the DB's own
     directory is a git repo with **no commits** (unborn), don't make its first
     commit for this — put the snapshot in the real repo and pin the DB with
     `ITR_DB_PATH` in every recipe so a stray local `.itr.db` can never shadow
     the parent one.
   - task runner: `justfile` / `Makefile` / npm scripts / none. With none,
     document the direct `python3 scripts/itr_snapshot_check.py …` commands
     instead of inventing a runner.
   - which doc owns the itr section (grep `itr` in CONTRIBUTING.md,
     CLAUDE.md, AGENTS.md, README.md; edit every copy that carries the same
     text — some repos keep CLAUDE.md and AGENTS.md as twins).
   - existing gate to hook: a `docs-lint`, `ci`, `verify` or lint recipe.
     `just` stops at the first failing line of a recipe, so a pre-existing red
     step masks the new one; run the check directly too.
   - branch and identity: commit on the branch that is checked out (say so if
     it is a feature branch identical to main), and confirm `git config
     user.email` is the intended identity before committing.
3. **Install** the script (`chmod +x`), the recipes, the ignore lines, the
   docs. Recipe pattern for `just` (adapt paths; add `ITR_DB_PATH=…` when the
   DB is in a parent directory):

   ```make
   itr-snapshot:            # regenerate .itr/issues.jsonl — run after tracker changes, commit with the work
       python3 scripts/itr_snapshot_check.py --write
   itr-snapshot-check:      # fail if the snapshot is stale vs the DB (surrogate row ids ignored)
       python3 scripts/itr_snapshot_check.py
   itr-restore:             # fresh clone: rebuild the DB from the snapshot (REPLACES colliding ids — a pull, not a merge)
       python3 scripts/itr_snapshot_check.py --restore
   ```
   `just --list` shows the **last** comment line above a recipe, so put the
   one-line summary last.
4. **File the itr issue for this work first** (the repo's own tracker,
   `itr add …`), then `--write` so the snapshot already contains it; close it
   with the evidence and `--write` again before committing.
5. **Verify** under gatr: `gatr run --tag itr-snapshot-verify -- bash
   scripts/verify_itr_snapshot.sh .` (point the second argument at the repo's
   script if you renamed it). Expect `ALL PASS`: live check, fresh-clone
   restore, normalization, drift by note and by new issue, pull-replaces-edit,
   local-only issue survives restore with an explanatory NOTE, failed export
   leaves the snapshot untouched, skip/strict/usage exits.
6. **Commit only behind the green gate.** Chain the battery, the issue
   close and the commit with `&&` (or check `gatr last` for `exit=0` first),
   and write "battery ALL PASS" into the commit message and close reason only
   after seeing it. A pre-written claim behind a `;` separator shipped three
   false "passed" commits the first time this skill was fanned across repos.
   Apply the procedure to ONE repo end-to-end before fanning out, so a
   data-dependent failure shows up once. Conventional Commits, subject ≤ 72
   chars (`chore(itr): track the tracker as a JSONL snapshot (itr#N)`), stage
   only the pieces above. Do not push unless the user asked for the remotes
   to be updated; list the push command instead.

## Rules the docs must carry

- **Fresh clone:** run the restore recipe; issue ids are preserved so every
  `itr#NNN` reference resolves.
- **After changing the tracker:** run the snapshot recipe and commit the file
  with the work; the gate fails while it is stale.
- **One writer at a time:** issue ids are sequential integers, so two clones
  filing issues concurrently mint the same id. Pull + restore before filing,
  snapshot + push after. Restore replaces colliding ids and **never deletes
  local-only issues** — it exits 1 and says so when some survive, which means
  "export them or remove them", not "restore failed".

## Report back

State the itr version, where the DB and the snapshot live (and why, if they
differ), which gate now runs the check, the gatr tag with `ALL PASS`, the
commit sha, and the exact push command left to the user. Mention any
pre-existing red in the gate the check was appended to.
