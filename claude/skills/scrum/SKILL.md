---
name: scrum
description: "Chain-based continuous delivery, sized to the ask: compile the ask into the smallest sufficient contract, form dependency-ordered CHAINS (falsifiable premise + linked increments), then walk them in parallel lanes with NO wave barriers — a link starts the moment its own deps land. The product stays runnable and user-visible from the first link; ceremony (councils, ledgers, digests) is priced and only bought when the work earns it. Commit per verified link. Trigger: `/scrum`, \"run a scrum\", \"work this as chains\", \"chain-based delivery\", \"form chains and walk them\". NOT for wave-based backlog clearance (use /blitz), the autonomous sprint loop (use /overdrive), roadmap evidence campaigns (use /proof-campaign), planning-only grooming (use /sprint), or one-off issue filing (use itr)."
---

# /scrum — chains, not waves; product always runnable

Chains replace sprints. A **chain is a claim** — "B cannot land before A, and this ordering leads somewhere valuable" — carried as a falsifiable **premise**. Links (smallest verifiable increments) land as commits the moment they're proven; a link waits only on **its own** dependencies, never on a wave barrier.

**The prime directive: the user can see and run the product after every landed link.** Process artifacts exist to serve the next link; any ceremony that outweighs the work it verifies is a defect. Rigor is priced per link, not uniform.

> *Caveman register — few token do trick. Commands/thresholds exact; prose stripped.*

## Slash invocation

```
/scrum [input | --backlog] [--lanes N] [--budget N] [--name slug] [--verify "cmd"]
       [--lean | --full] [--resume] [--close-now] [--abort] [--dry-run]
```

| Arg | Default | Meaning |
|---|---|---|
| `input` | — | Spec path, inline brief, or nothing (recent `/plan` / conversation). → **new run**. |
| `--backlog` | — | Form chains from the existing open `itr` backlog instead of a spec. |
| `--lanes N` | `3` | Max concurrent lanes (= active chains). **Hard cap 5**. |
| `--budget N` | unset | Token budget (e.g. `500k`). Exhaustion → finish in-flight links, honest closure. **Never ask the operator for more funds.** |
| `--name slug` | auto | Run slug. Sanitized `[a-z0-9-]`, cap 32. |
| `--verify "cmd"` | auto | Override verify gate (Phase 0 table). |
| `--lean` / `--full` | auto | Force the apparatus size (see **Scale gate**). |
| `--resume` | — | Reattach to `missions/CURRENT`: reconcile state (git · itr · journals), resume. |
| `--close-now` | — | Force closure now over what has landed. Honest complete/incomplete. |
| `--abort` | — | Cancel every live chain, then close. |
| `--dry-run` | off | Intake + formation, **print** chains/premises, stop. No writes, no agents. |

---

## Scale gate — size the apparatus BEFORE buying it

Decided at Phase 0, printed one line, overridable by `--lean`/`--full`:

- **LEAN** (default for: greenfield brief · single outcome · estimated ≤ 10 links · no pre-existing multi-epic backlog): itr epic + links **are** the entire paper trail. No contract.md, no premise.md files, no FACTS ledger, no councils, no digests, no budget arithmetic. Intake = a 5-line plan in the epic body. Orchestrator makes premise calls itself and journals one line.
- **FULL** (only when: ≥ 2 chains with cross-chain dependencies · existing multi-epic backlog · operator asked): adds slim contract + premise files + councils, per the sections below. Even in FULL, every ceremony below carries its price rule.

A run may **downshift** FULL→LEAN mid-walk (council verdict or operator verb); it never silently upshifts.

## Roles & artifacts

**Attended-with-defaults.** Operator present but optional: silence at a link boundary → recommended default executes. Never stall waiting; never interrupt to ask for budget.

- **You** = operator. Intervention verbs any time.
- **Orchestrator** = sole git committer, lease warden, and — in LEAN — the only judge.
- **Link agents** — one per link, `isolation: worktree`, execute + verify their scope, never touch git state on main.
- **Reviewers** — fresh context per link, adversarial, session model. Walker never self-grades.
- **Council seats** (FULL only) — 3 fresh contexts per premise decision, `codex exec -m gpt-5.5` via a thin wrapper agent (the `ambiguous` role in MODELS.md); evidence seat MAY run gpt-5.6-sol when the Codex plugin is authenticated.

Artifacts (target repo). LEAN: `missions/CURRENT` + itr + git only. FULL adds:

```
missions/<slug>/
├── contract.md          # SLIM: outcomes · non-goals · executable acceptance oracles ·
│                        #   authority envelope. EDITED IN PLACE — git history is the
│                        #   amendment trail; never append amendment sections.
├── FACTS.jsonl          # ONLY discoveries that invalidate ANOTHER chain's assumption.
└── chains/<chain-id>/
    ├── premise.md       # ordering-claim · value-claim · assumptions [{id, text}] · kill criteria
    ├── LEASE            # {link, agent-desc, started} — crash recovery marker
    └── journal.md       # ONE line per landed link; discoveries only when they change a decision
```

**itr is the graph.** Chain = epic (premise summary in body, tag `mission-<slug>`). Link = child issue (tag `chain:<epic-id>`; DoD as executable block in acceptance; order via `--blocked-by`). Commit trailer `Chain-Link: <chain>#L<n>` = the join key; the chain-map is **derived** from `itr graph` + `git log`, never maintained; git wins every disagreement.

---

## The loop at a glance

```
Phase 0  Preflight ...... tracker, git baseline, verify gate, SCALE GATE
Phase 1  Intake ......... ask → outcomes + oracles (LEAN: 5-line plan; FULL: slim contract)
Phase 2  Formation ...... chains + links filed; FIRST LINK = walking skeleton, live
─ the walk: continuous, event-driven — NO wave barriers ─────────────────────
Phase 3  Walk ........... claim → execute (worktree) → review (severity floor) → land LIVE
Phase 4  Premise calls .. contradiction/kill-criterion → LEAN: orchestrator rules; FULL: council
Phase 5  Cancellation ... falsified premise → keep/revert dispositions + one-page report
─ stop: all chains terminal · budget exhausted · abort/close-now ─
Phase 6  Closure ........ full gate + acceptance oracles vs main → complete|incomplete
```

---

## Phase 0 — Preflight

Announce `Phase 0 — Preflight`. Terse.

1. **Mode:** input → new run. `--backlog`/no input + open tickets → chains from backlog. `--resume` → read `missions/CURRENT`, reconcile (git `Chain-Link:` trailers vs itr vs journals; git wins), skip to Phase 3. Nothing usable → `Nothing to run — supply a spec/brief or --backlog.` Stop.
2. **Tracker:** `itr stats`; no `.itr.db` → `itr init`. `itr agent-info` once — prefer its syntax.
3. **Tooling** (non-blocking): `kgr` → file inference. `gatr` → gates as `gatr run --tag <name> -- <cmd>`; absent → run directly. `STORY_STYLE.md`/`CLAUDE.md` → mirror conventions.
4. **Git baseline:** not a repo → `git init` + baseline commit. Detached HEAD → branch `mission-<slug>`. Dirty tree → stash + surface restore hint. `BASELINE_SHA = git rev-parse HEAD`.
5. **Verify gate** — auto-detect unless `--verify`:

   | File | Default verify gate |
   |---|---|
   | `Cargo.toml` | `cargo test && cargo clippy -- -D warnings && cargo fmt --check` |
   | `package.json` | union of existing `test`/`lint`/`typecheck`/`build` scripts |
   | `pyproject.toml` | `pytest && ruff check . && ruff format --check .` |
   | `go.mod` | `go test ./... && go vet ./... && test -z "$(gofmt -l .)"` |
   | `Makefile` w/ `test` | `make test` + any of `lint`/`check`/`verify` |
   | nothing matched | greenfield: the gate is whatever the skeleton link creates (build + smoke run); existing repo: ask once |

6. **Scale gate** (above) — print `scale: LEAN|FULL — <one-line reason>`.
7. **Slug:** `missions/CURRENT` written at launch (end of Phase 2).

---

## Phase 1 — Intake

Announce `Phase 1 — Intake`.

- **LEAN:** distill the ask into ≤ 5 lines in the epic body: outcome · non-goals · the ONE acceptance oracle (executable or observable: "game playable at dev URL") · known risks. No red-team agent, no assumption register, no interrogation round — ambiguities get a recommended default inline and the walk starts. Ask the operator only a question whose wrong answer would invalidate the first chain.
- **FULL:** slim contract.md (outcomes · non-goals · executable oracles · authority envelope). One red-team pass (fresh agent, read-only): top-3 ways this plan fails in this repo, file-level evidence. ONE `AskUserQuestion` round (≤ 4 questions, defaults marked); silence → default. No budget arithmetic sections — the ledger is the harness token count, never prose.

**Price rule:** intake spend caps at ~2% of budget (or ~10 min unset). Working software is the best interrogator — prefer building the skeleton to debating the plan.

---

## Phase 2 — Formation

Announce `Phase 2 — Formation`.

1. **Recover the DAG:** decompose backwards from each outcome. Well-formed chain: one premise · value terminal · lane-viable file territory.
2. **THE SKELETON RULE (greenfield or new surface): the first link of the first chain is a walking skeleton** — the smallest end-to-end runnable slice of the real product (app boots, real render path, one real interaction), wired live, **observed running** (run it; UI → screenshot or manual look) before any other link is drafted deep. Every later link extends a running product.
3. **File to itr:** epic per chain (premise summary in body) → links as children (acceptance = DoD w/ executable or observable check, `blocked_by` for order). Draft links only to the evidence horizon — beyond it file a spike (hard cap 30k tokens, pre-registered questions, terminal verdict `harden|redirect|dead-end`).
4. **FULL only:** premise.md per chain (ordering-claim, value-claim, assumptions with ids, kill criteria). LEAN: premise = one sentence in the epic body.
5. `--dry-run` → print chains/premises, stop.

---

## Phase 3 — The Walk

Announce `Phase 3 — Walk`. Continuous admission, event-driven. **No link waits on anything but its own blocked-by deps and its chain's serial order.**

**Admission:** while lanes < `--lanes` and an unblocked chain head exists → claim (write `LEASE` in FULL, `itr claim` always). New chain admitted the moment a lane frees.

**Per-link cycle:**

1. **Claim:** deps green **in git** (blocked-by closed *and* their `Chain-Link:` commits reachable). DoD frozen at claim.
2. **Execute:** link agent (template below), `isolation: worktree`, `run_in_background: true`. Timeout `min(30m, budget-share)`; hung → interrupt, count as attempt.
3. **Review — severity floor.** Fresh reviewer gets patch + frozen DoD + agent report. Returns JSON:
   ```json
   { "conforms": true,
     "findings": [{"sev": "P0|P1|P2|P3", "text": "..."}],
     "premise_signal": "supports|neutral|contradicts — only when this diff actually bears on the premise" }
   ```
   **Only P0/P1 block landing.** P2/P3 → filed as itr issues, never rework. **ONE rework round max**: after one failed rework, land the green subset and file the rest — an 80% link in the tree beats a 100% link in quarantine. `contradicts` → Phase 4 before the next claim on that chain. No manufactured findings: an empty findings list on a clean diff is a PASS, not a lazy review.
4. **Land LIVE (orchestrator, serial):**
   ```
   git -C <worktree> add -A && git -C <worktree> diff --cached > /tmp/<chain>-L<n>.patch
   git apply --index /tmp/<chain>-L<n>.patch     # stale vs moved HEAD → fresh worktree, retry
   <SCOPED check>                                # link's own DoD check + typecheck/build —
                                                 #   NOT the full suite (full gate: terminal links + closure)
   git commit -m "scrum <slug> <chain>#L<n>: closes itr#<id>" -m "Chain-Link: <chain>#L<n>"
   ```
   Red scoped check → do NOT commit; one retry on fresh HEAD. `itr close <id>` after the commit lands. **Chain terminal link + Phase 6: run the FULL verify gate.**
5. **Observe:** after each landed link on a user-facing surface, RUN the product (dev server, binary, screenshot for UI). The running product is the primary oracle; a green gate on an invisible feature proves nothing the user can see.
6. **Record:** LEAN → nothing beyond git + itr. FULL → one journal line; FACTS only if the discovery invalidates another chain's assumption.

**Rules of the walk:** **user-visible behavior lands LIVE and wired — never dormant, never parked behind an unrequested flag.** Keep main runnable at every commit; if a link would break the running product mid-chain, split it smaller, don't dark-ship it. `FREEZE` file present (FULL) → lanes park at next boundary. Crash recovery: stale `LEASE` + no matching `Chain-Link:` commit → link unclaimed, re-run; stale lease's patch never applied.

---

## Phase 4 — Premise calls

A premise question fires ONLY on: reviewer `contradicts` · a pre-registered kill criterion · operator `contest`. **No cadence triggers — no per-N-links, per-budget-tranche, or per-rework councils.**

- **LEAN:** the orchestrator rules it directly — `proceed | reshape | cancel` — and journals one line in the epic. Reshape = edit the remaining links in itr; no supersede protocol.
- **FULL:** 3 blind seats (value/delivery/evidence briefs), verdicts `proceed | rescope | cancel | downshift` (downshift = drop to LEAN — the ceremony itself is the problem). Unanimous → act. 2-1 → act, journal dissent. 1-1-1 → operator brief. Rescope = close epic, open successor with `itr relate --type supersedes`.

**Price rule:** a premise call costs ≤ 1 link of tokens. If the call is about process (rigor, ceremony, cadence) rather than the premise, the answer is always `downshift`, not more process.

---

## Phase 5 — Cancellation

Announce `Cancel — <chain>`. Cancelling publishes what was learned — one page, not a dossier.

1. **Disposition per landed link:** `keep` (it's live and harmless/useful) | `revert` (harmful under the falsified premise — one reviewed revert commit).
2. **In-flight:** lease revoked, worktree discarded; salvage findings into the epic, never code.
3. **Report:** ≤ 1 page in the epic close comment (FULL: also `falsification.md`): premise · what broke at which link · evidence · cost. Unstarted links → `wontfix` + tag `falsified`.
4. **Downstream:** chains depending on the cancelled premise get a premise call before their next claim.

---

## Phase 6 — Closure

Announce `Phase 6 — Closure`. Fires when: all chains terminal · budget exhausted (in-flight finishes, no new claims) · `--close-now` · `--abort`.

1. **Run the FULL verify gate + every acceptance oracle** against integrated main. For user-facing work the oracle includes actually running the product (screenshot/manual path).
2. **Verdict:** `complete` = oracles green + chains terminal. Anything else = **`incomplete`** — say so plainly, list the gap. Never round up.
3. **Debrief — 10 lines max, in the epic close comment:** outcomes vs ask · per-chain state · what was learned · residue. No budget reconciliation prose.
4. Close epics, repoint/remove `missions/CURRENT`. Stop. Don't push/PR, don't start the next run.

---

## Operator surface

- **Pulse:** one status line at each phase transition and chain-terminal event: `WALK · landed 6/9 · lanes 2/3 · product: RUNNING (last observed L6)`. FULL adds a ≤ 10-line digest at chain transitions. Nothing else, ever, unless asked (`brief-me`).
- **Interrupt** (action needed, never batched): decision briefs ≤ 10 lines, ≤ 2 options + Cancel, default marked; silence → default at next boundary. **Never a funding brief.**

**Intervention verbs:** `fact <statement>` · `contest <chain>` / `confirm <chain>` · `cancel <chain>` / `freeze` / `thaw` · `nudge <chain>: <note>` · `brief-me [--map]` · `close-now` / `abort` · `downshift`.

---

## Link-agent prompt template

```
You are the lane agent for {chain-id} link L{n}: {title}. You work in YOUR OWN git worktree.

Chain premise (report anything that contradicts it): {one-line premise}
What previous links learned: {≤5 lines}
Link body / acceptance (DoD frozen at claim): {verbatim}
Files this chain owns — stay inside: {territory}

HARD RULES:
- DO NOT commit, push, branch, merge, or touch git config. Orchestrator lands your work.
- DO NOT run write-mode formatters (--check / -l variants are fine).
- Wire user-visible behavior LIVE. The product must run better after your link than before.
  If your slice can't be wired live safely, say so — the orchestrator splits the link.
- Report a broken assumption instead of silently working around it.

Before reporting done: run YOUR scoped check ({DoD check + typecheck/build}) — exit zero —
and if you touched a user-facing surface, RUN the product and describe what you saw.

Report back: one paragraph of changes · scoped-check tail · what the running product now does ·
findings[] (anything contradicting the premise, open questions). Do NOT close the ticket.
```

---

## How /scrum relates to the suite

| | `/blitz` · `/overdrive` | **`/scrum`** |
|---|---|---|
| Unit | wave (batch, barrier-gated) | chain (dependency path, claim-gated) |
| A task starts when | its wave opens | its own deps land — continuous admission |
| Commit | per accepted wave | per landed link |
| Product visibility | end of wave | **live after every link** |
| Ceremony | fixed | priced — LEAN by default, FULL when earned |

Backlog of independent bounded tickets → `/blitz` or `/overdrive`. Deep dependency stacks or "this plan might be wrong" → `/scrum`.

---

## Principles

- **Working software is the primary measure of progress.** Every link leaves the product runnable and visibly better; the running product is the first oracle, the test suite the second.
- **Ceremony is priced.** Intake ≤ 2% of budget · premise call ≤ 1 link · review blocks only on P0/P1 · ledgers only when they change a decision. When process and product compete for tokens, product wins.
- **A chain is a claim.** Falsifiable premise; contradictions surface and get ruled, never suppressed.
- **Adversary for artifacts.** Fresh reviewer per link; the walker never self-grades. But a review that must invent findings is a defect — the severity floor is the fix.
- **Git wins.** Completion = commit reachable + oracle observed, never a status flag or a prose ledger.
- **Fail toward shipping.** One rework round, then land the green subset and file the rest. Cancelled-early ≠ failed — book the savings in one page.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. One commit per landed link, orchestrator sole committer, agents never.

## Don't

- Don't land user-visible work dormant, dark, or behind an unrequested flag — live or split smaller.
- Don't buy FULL ceremony for a LEAN ask; don't add cadence councils, budget tranches, or per-link full-suite runs.
- Don't ask the operator for funding — close honestly instead.
- Don't append amendments — edit the contract in place; git is the history.
- Don't rework more than once — land the green subset, file the rest.
- Don't let agents commit/push/branch/merge — patches through the write gate only.
- Don't land on a red scoped check; don't apply a stale lease's patch; don't skip the FULL gate at terminal/closure.
- Don't count `incomplete` as complete; don't round oracle results up.
- Don't push/PR or start the next run automatically.
