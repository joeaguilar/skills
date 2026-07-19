---
name: mission
description: "Chain-based continuous delivery: compile the ask into a mission contract, form dependency-ordered CHAINS (falsifiable premise + linked increments) from the backlog, then walk them in parallel lanes with NO wave barriers — a link starts the moment its own deps land. Commit per verified link, adversarial review + per-assumption premise verdicts every link, 3-seat councils on premise decisions, cancellation publishes a falsification report. Trigger: `/mission`, \"run a mission\", \"work this as chains\", \"chain-based delivery\", \"form chains and walk them\". NOT for wave-based backlog clearance (use /blitz), the autonomous sprint loop (use /overdrive), roadmap evidence campaigns (use /proof-campaign), planning-only grooming (use /sprint), or one-off issue filing (use itr)."
---

# /mission — chains, not waves

Chains replace sprints. A sprint is a container (asserts nothing); a **chain is a claim** — "B cannot land before A, and this ordering leads somewhere valuable" — carried as a falsifiable **premise** with enumerated assumptions. Links (smallest verifiable increments) land as commits the moment they're proven; a link waits only on **its own** dependencies, never on a wave barrier. Premises are judged by councils; falsified chains cancel and publish what was learned.

> *Caveman register — few token do trick. Commands/thresholds exact; prose stripped.*
> Design lineage: `docs/chain-based-agentic-delivery.md` (skills repo) — the verbose reference.

## Slash invocation

```
/mission [input | --backlog] [--lanes N] [--budget N] [--name slug] [--verify "cmd"]
         [--resume] [--close-now] [--abort] [--dry-run]
```

| Arg | Default | Meaning |
|---|---|---|
| `input` | — | Spec path, inline brief, or nothing (recent `/plan` / conversation). → **new mission**. |
| `--backlog` | — | Form chains from the existing open `itr` backlog instead of a spec. |
| `--lanes N` | `3` | Max concurrent lanes (= active chains). **Hard cap 5** (higher → clamp + warn). |
| `--budget N` | unset | Mission token budget (e.g. `500k`). Unset → burn-based kill criteria skipped; link/rework criteria still fire. |
| `--name slug` | auto | Mission slug. Sanitized `[a-z0-9-]`, cap 32. |
| `--verify "cmd"` | auto | Override verify gate (Phase 0 table). |
| `--resume` | — | Reattach to `missions/CURRENT`: reconcile state (git · itr · journals), resume the walk. |
| `--close-now` | — | Force the closure gate now over what has landed. Honest complete/incomplete. |
| `--abort` | — | Cancel every live chain via the full cancellation protocol, then close. |
| `--dry-run` | off | Intake + formation, **print** chains/premises, stop. No `itr` writes, no agents, no commits. |

Unsupplied flags → auto-detected in Phase 0.

---

## Roles & artifacts

**Attended-with-defaults.** Operator present but optional: every question carries a recommended default; silence at a link boundary → default executes per the authority envelope. Never stall waiting.

- **You** = operator. One intake interrogation; decision briefs (default-carrying); intervention verbs any time.
- **Orchestrator** = sole git committer, **the write gate**, FACTS writer, council convener, lease warden.
- **Link agents** — one per link, spawned `isolation: worktree`, execute + verify, **never touch git state on main**.
- **Reviewers** — fresh context per link, adversarial, session model. Walker never self-grades.
- **Council seats** — 3 fresh contexts per premise decision, `model: opus` (the `ambiguous` role in MODELS.md); evidence seat MAY run gpt-5.6-sol via `codex exec` for cross-model diversity when the Codex plugin is authenticated.

Artifacts (in the target repo):

```
missions/
├── CURRENT                    # one line: active mission slug
├── FACTS.jsonl                # project-lifetime ledger — spans missions, never per-slug.
│                              #   {ts, mission, chain, link, kind: discovery|constraint|invalidation,
│                              #    text, touches: ["<chain>:<assumption-id>"]}
│                              #   Orchestrator = sole writer (lanes return findings; orchestrator appends).
└── <slug>/
    ├── contract.md            # immutable; amendments append as versioned sections.
    │                          #   outcomes · non-goals · acceptance oracles (EXECUTABLE cmds) ·
    │                          #   budget arithmetic {total, per-chain alloc, spent, returned} ·
    │                          #   authority envelope · assumption register w/ intake tags
    ├── FREEZE                 # presence = all lanes pause at next link boundary (touch/rm)
    ├── digest.md              # heartbeat log (append per digest)
    ├── debrief.md             # written at closure
    └── chains/<chain-id>/     # chain-id = its itr epic id
        ├── premise.md         # IMMUTABLE — ordering-claim · value-claim · assumptions
        │                      #   [{id: A1…, text, tag, depends?: <chain-id>}] · kill criteria ·
        │                      #   budget alloc · supersedes?: <chain-id>
        ├── LEASE              # {link, agent-desc, started} — crash recovery marker
        ├── journal.md         # append-only: ## L<n>/<type> — text
        │                      #   types: decision|discovery|open-question|superseded|review|council|spike
        │                      #   + one maintained line: facts-cursor: <last FACTS ts read>
        └── falsification.md   # written once, at seal, on cancellation only
```

**itr is the graph.** Chain = epic (premise summary in body, tag `mission-<slug>`). Link = child issue (tag `chain:<epic-id>`; DoD as executable block in acceptance; order via `--blocked-by` — itr hard-errors on cycles, which is the acyclicity check). Spike = issue tagged `spike`. Rescope provenance = `itr relate --type supersedes`. Cancelled unstarted links → status `wontfix` + tag `falsified` (syntax per `itr agent-info`). Commit trailer `Chain-Link: <chain>#L<n>` = the join key; the chain-map is **derived** on demand from `itr graph` + `git log` — never a maintained artifact, and where map and git disagree, **git wins**.

---

## The loop at a glance

```
Phase 0  Preflight ......... tracker, tooling, clean git baseline, verify gate
Phase 1  Intake ............ prompt+plan → contract: oracles, budget, envelope, assumption tags
Phase 2  Formation ......... backlog/spec → chains: premise.md + itr epic + linked issues + spikes
─ the walk: continuous, event-driven — NO wave barriers ─────────────────────────
Phase 3  Walk .............. lanes claim ready links → execute (worktree) → review → land+commit
Phase 4  Councils .......... kill criteria / contradicts / FACTS hit → 3 seats → proceed|rescope|cancel
Phase 5  Cancellation ...... falsified premise → dispositions, falsification.md, downstream invalidation
─ stop: all chains terminal · budget exhausted · abort/close-now · all-remaining-blocked ─
Phase 6  Closure ........... run acceptance oracles vs integrated main → complete|incomplete → debrief
```

Heartbeat digests + decision briefs fire throughout (see **Operator surface**).

---

## Phase 0 — Preflight

Announce `Phase 0 — Preflight`. Terse logging.

1. **Mode:** input → new mission. `--backlog` / no input + open tickets → form chains from backlog. `--resume` → read `missions/CURRENT`, reconcile (git log `Chain-Link:` trailers vs itr status vs journals; git wins), skip to Phase 3. Nothing usable → print `Nothing to run — supply a spec/brief or --backlog.` Stop.
2. **Tracker:** `itr stats`; no `.itr.db` → `itr init` (fail → surface + stop). `itr agent-info` once — prefer its syntax for update/close/relate/depend over anything here.
3. **Tooling** (non-blocking): `kgr` → file inference + edge evidence. `gatr` → all gates run as `gatr run --tag <name> -- <cmd>`; absent → run cmds directly. `STORY_STYLE.md`/`CLAUDE.md` → mirror conventions. `docs/ROADMAP.md` → seed outcomes.
4. **Git baseline** (load-bearing — orchestrator commits per link): not a repo → **hard stop** (`git init` and retry). Detached HEAD → branch `mission-<slug>`. Dirty tree → `git stash push --include-untracked -m "mission: pre-run WIP"` + surface restore hint. `BASELINE_SHA = git rev-parse HEAD`; confirm clean (`git diff-index --quiet HEAD --`).
5. **Verify gate** — auto-detect unless `--verify`:

   | File | Default verify gate |
   |---|---|
   | `Cargo.toml` | `cargo test && cargo clippy -- -D warnings && cargo fmt --check` |
   | `package.json` | union of existing `test`/`lint`/`typecheck`/`format:check` scripts |
   | `pyproject.toml` | `pytest && ruff check . && ruff format --check .` |
   | `go.mod` | `go test ./... && go vet ./... && test -z "$(gofmt -l .)"` |
   | `Makefile` w/ `test` | `make test` + any of `lint`/`check`/`verify` |
   | nothing matched | stop and ask for the gate cmd (one-time setup input, not a workflow gate) |

6. **Slug + skeleton:** `missions/<slug>/` created, `missions/CURRENT` written at launch (end of Phase 2).

---

## Phase 1 — Intake

Announce `Phase 1 — Intake`. The prompt+plan is the least-reviewed artifact in the system and the one everything inherits from — attack it now, while the operator is still present.

1. **Compile contract.md:** outcomes · non-goals · **acceptance oracles as executable commands** (closure = run these; wire through `gatr run --tag oracle-<k> --`) · budget (`--budget` or unset) · authority envelope (what proceeds on silence: **continue the uncontested subset** — never "proceed as before", never stall). Classify every material statement: evidenced fact | testable assumption | preference | ambiguity.
2. **Red-team** (fresh agent, read-only): top-3 ways this plan fails *in this repo* with file-level evidence + repo-reality diff (named files that don't exist · asked-for features that already exist · version claims vs lockfiles). Findings → assumption register.
3. **Assumption register:** every assumption gets `id` + tag: `verified-at-intake | spike-scheduled | human-confirmed | assumed-by-default`.
4. **ONE interrogation round** — single `AskUserQuestion` (≤4 questions), ranked by budget impact, each option list led by the recommended default `(Recommended)`. Unanswered/skipped → default, tagged `assumed-by-default`. The `assumed-by-default` list is the contract: cancellations trace back to it.
5. **Launch digest** → `digest.md`: chains-to-be, premises, full `assumed-by-default` list, budget split, spike order.

---

## Phase 2 — Formation

Announce `Phase 2 — Formation`. Chains are discovered structure, not selected batches.

1. **Recover the DAG:** spec decomposition (backwards from each outcome: what must be true first?) + backlog mining (`itr graph`; infer edges from shared files via kgr, explicit "X before Y"). Well-formed chain: **one premise** (two premises = two chains + an edge) · **value terminal** (tail independently shippable against an oracle) · **lane-viable territory** (declared file set walkable without permanent cross-lane collision).
2. **Write premise.md per chain** — ordering-claim and value-claim as *separate* falsifiable statements (they fail differently: ordering → reparent; value → terminate) · assumptions w/ ids + tags (+ `depends: <chain-id>` for cross-chain edges — mirrored as itr blocked-by between epics) · **kill criteria** (defaults below) · budget alloc (pool ÷ proportional link count). Premise = chain identity, **immutable** — never edited, only superseded.
3. **File to itr:** epic per chain (`itr add -k epic`, tag `mission-<slug>`, premise summary in body; capture id = chain-id) → links as children (`itr batch add`: tag `chain:<id>`, acceptance = DoD w/ executable check, `blocked_by` for intra-chain order). **Draft links only to the evidence horizon** — beyond it file a spike, not links.
4. **Spikes:** issue tagged `spike`, hard cap (default **30k tokens**), pre-registered questions in answerable form, **mandatory terminal verdict**: `harden` (draft the next links) | `redirect` (premise implication → council) | `dead-end` (→ council). No verdict = failed spike, counts as rework. **Order spikes by invalidation blast radius** — probe the assumption whose failure kills the most downstream work first.
5. `--dry-run` → print chains/premises/spike order, stop (no itr writes).

---

## Phase 3 — The Walk

Announce `Phase 3 — Walk`. Continuous admission, event-driven. **The anti-sprint invariant: no link waits on anything but its own blocked-by deps and its chain's serial order. No wave barriers, no batch gates, no cadence councils.**

**Admission:** while lanes < `--lanes` and an unblocked chain head exists → claim it (write `LEASE`, `itr claim` the link). A lane walks its chain serially; lanes run parallel to each other. New chain admitted the moment a lane frees — never "at the next boundary".

**Per-link cycle:**

1. **Claim:** deps green **in git** (blocked-by links closed *and* their `Chain-Link:` commits reachable from HEAD — completion = artifact exists, never a status flag). FACTS diff: read `missions/FACTS.jsonl` past this chain's `facts-cursor`; any entry touching an assumption id → **council before claim**. DoD frozen at claim (copy into the lease context).
2. **Execute:** spawn link agent (template below), `isolation: worktree`, `run_in_background: true`. Timeout `min(30m, budget-share)`; hung → interrupt, count as attempt.
3. **Review** (fresh reviewer, gets: patch + frozen DoD + premise assumptions + agent report). Returns JSON:
   ```json
   { "implementation_conforms": true, "acceptance_oracle_adequate": true,
     "oracle_gap": "behavior the AC implies that the DoD does not test, or null",
     "premise_verdicts": [{"id": "A1", "verdict": "supports|neutral|contradicts|new-assumption-implied"}],
     "workarounds": "what did this diff work around? (empty findings + visible workaround = FAIL)",
     "findings": [] }
   ```
   Any `contradicts` → mechanical council trigger — the walker cannot suppress it. `new-assumption-implied` → append to register via journal, escalate one rung (**a finding that matches nothing escalates UP, never drops**). Review fail → re-plan + retry; **rework ≥ 2 per link → council** (quarantine-link vs rescope).
4. **Land (orchestrator, serial — the write gate):**
   ```
   git -C <worktree> add -A && git -C <worktree> diff --cached > /tmp/<chain>-L<n>.patch
   git apply --index /tmp/<chain>-L<n>.patch        # main tree, clean; FAIL → stale vs moved HEAD
                                                    #   → discard worktree, retry link on fresh HEAD (attempt++)
   <verify gate via gatr>                           # integration acceptance — full repo, MUST be green
   git commit -m "mission <slug> <chain>#L<n>: closes itr#<id>" \
              -m "<one-line gate summary>" \
              -m "Chain-Link: <chain>#L<n>" \
              -m "Co-Authored-By: <orchestrator model> <noreply@anthropic.com>"
   ```
   Red integration gate → flaky double-check (re-run 2×, green = flaky, log + proceed); consistently red → do NOT commit, retry link on fresh HEAD (attempt++). `itr close <id>` after commit verified landed (`git rev-parse HEAD` moved + tree clean).
5. **Record:** journal entries (`## L<n>/review`, discoveries as `## L<n>/discovery`); shared-reality discoveries → orchestrator appends to `missions/FACTS.jsonl`; advance `facts-cursor`; clear `LEASE`; check kill criteria; next link.

**Rules of the walk:** user-visible behavior lands **dormant** — behind a flag where the project has flags, else not wired into any user-facing path — until the chain's terminal link. Speculation (link N+1 before N lands) only in an isolated worktree, journal-quarantined, mechanically discarded if upstream fails. `FREEZE` present → lanes park at next link boundary; `rm FREEZE` → resume. Crash recovery: stale `LEASE` + no matching `Chain-Link:` commit → link unclaimed, re-run; a stale lease's patch is never applied (the fencing check).

**Lane-local graph ops** (premise-preserving: extend after `harden`, splice, prune) → allowed, logged as journal `decision` entries, **replayed at the next council** — a pruned link's DoD must be shown satisfied elsewhere or not entailed by the premise. Premise-touching or cross-chain ops (terminate, reparent, merge, split) → council only.

---

## Phase 4 — Councils

Announce `Council — <chain>: <trigger>`. Premise decisions are judgment under uncertainty — no artifact arbitrates — so: 3 seats, never 1.

**Mechanical triggers (pre-registered in premise.md — never judgment calls):**
- every **25%** of chain budget burned (`--budget` set) · every **5** landed links · link rework **≥ 2** · spike `redirect`/`dead-end` · any reviewer `contradicts` · FACTS entry touching an assumption · operator `contest`.

**Protocol:** 3 parallel fresh agents, blind (no shared narrative), **disjoint briefs**:
- **value seat** — contract outcomes + budget arithmetic + landed-link list: *still worth the remaining allocation?*
- **delivery seat** — itr graph + rework counts + territory: *executable from here?*
- **evidence seat** — failure tails + journal open-questions + dissent ledger: *prosecute — strongest concrete case against continuing.*

Verdicts `proceed | rescope | cancel` + one line why. Tally (orchestrator): **unanimous → act. 2-1 → act, journal the dissent (`## L<n>/council`); same seat dissenting same direction 2 consecutive councils → operator brief. A fired kill criterion + any cancel vote → `proceed` off the table (min verdict rescope) — continuation must earn evidence.** 1-1-1 → operator brief (genuine uncertainty).

**Rescope = terminate + successor.** Premise immutable: close the chain (Phase 5, dispositions apply), open successor epic with `supersedes: <old>` in premise.md + `itr relate --type supersedes`. Budget: remainder transfers to successor, journaled in contract arithmetic.

---

## Phase 5 — Cancellation

Announce `Cancel — <chain>`. **Cancelling publishes a falsification, or it didn't happen.**

1. **Disposition per landed link** (v1 two-way): `keep-dormant` (harmless, stays dark) | `revert` (harmful under the falsified premise — executed as a normal reviewed link through the full Phase 3 cycle; revert cost quoted + paid from chain budget before return).
2. **In-flight:** lease revoked, worktree discarded, link `aborted` never verified; salvage findings into journal, never code.
3. **Seal:** journal append-locked → fresh context compacts into `falsification.md`: premise · which assumption broke at which link · evidence · total cost. Shared-reality discoveries promoted to FACTS first. Unstarted links → `wontfix` + tag `falsified`. Lane context dissolved — successors read the report, not the raw journal.
4. **Budget:** remainder − revert cost → mission pool (contract arithmetic). Only formation events draw from the pool — surviving lanes never absorb it silently.
5. **Downstream:** every chain whose premise carries `depends: <cancelled>` → FACTS `invalidation` entry touching that assumption → forced premise check (council) before its next claim. Cascading termination is correct — fast falsifications beat zombie chains.
6. **Verdict digest** (never an apology): `Chain <id> cancelled at L<n>/<total>. A2 falsified — <evidence>. Kept L1–L3 dormant, reverted L4 (cost 1 link). <N>% budget returned. Downstream: <M> re-checked. A2 was assumed-by-default at intake.` → `digest.md` + operator.

---

## Phase 6 — Closure

Announce `Phase 6 — Closure`. Fires when: all chains terminal · budget exhausted (in-flight links finish, no new claims) · `--close-now` · `--abort` (cancel-all first) · all remaining chains blocked on falsified deps.

1. **Run every acceptance oracle** from contract.md against integrated main (`gatr run --tag oracle-<k> -- <cmd>`).
2. **Verdict:** `complete` = all oracles green + every chain terminal. Anything else = **`incomplete`** — say so plainly, list what's missing. Never round up.
3. **Flag-flip review:** dormant user-visible work from completed chains → operator brief listing flips (recommended default: flip completed chains' flags; falsified chains stay dark).
4. **Debrief** → `missions/<slug>/debrief.md`: outcomes vs contract · per-chain terminal state · falsification reports · FACTS learned this mission · budget reconciliation · residue (open links, `assumed-by-default` survivors). Cancellation-traceable-to-defaulted-assumption rate = the metric that says whether intake was too shallow.
5. Close epics (`itr close` per terminal chain), repoint/remove `missions/CURRENT`, `docs/ROADMAP.md` exists → `/roadmap --update` non-blocking. Stop. Don't push/PR, don't start the next mission.

---

## Operator surface

Two channels, never mixed. **A digest never contains a buried question; a question is never buried in a digest.**

- **Pulse digest** (FYI → `digest.md` + one screen to operator, max 30 lines): at every 10% budget tranche (`--budget` set) · any chain state transition · else every 5 landed links. Sections in fixed order, empty ones omitted: `LANDED · MOVED (verdicts/tags) · LEARNED (FACTS) · SPENT · WATCH (trending toward kill criteria) · NEXT`. Status line every digest:
  `WALK · landed 14/31 (+22m) · burn 38%/land 45% · lanes 3/3`
  (staleness beyond expected link cadence, or lanes < expected → say so — quiet must mean healthy, never stuck).
- **Interrupt** (action needed, never batched): decision briefs — ≤15 lines, ≤3 evidence bullets, ≤2 options + Cancel (always priced), recommended default marked, delivered via `AskUserQuestion`; silence/skip → default executes at the next link boundary per the authority envelope.

**Intervention verbs** (plain language; effects at next link boundary; every verb journals):

| Verb | Effect |
|---|---|
| `fact <statement>` | FACTS entry → diffed against every chain's assumptions → councils where it contradicts |
| `contest <chain>.<A#>` / `confirm <chain>.<A#>` | force a council on it / tag `human-confirmed`, off kill-criteria pressure |
| `cancel <chain>` / `freeze` / `thaw` | full Phase 5 protocol / touch FREEZE / rm FREEZE |
| `fund <N>` / `amend <section>` | add budget, recompute denominators / contract re-versioned (never edited), affected premises re-checked |
| `nudge <chain>: <note>` | non-binding journal note, read at next claim + next council |
| `brief-me [--map]` | on-demand digest; `--map` renders the derived chain-map (`itr graph` + trailers) |
| `close-now` / `abort` | Phase 6 / cancel-all → Phase 6 |

---

## Link-agent prompt template

```
You are the lane agent for {chain-id} link L{n}: {title}. You work in YOUR OWN git worktree.

Chain premise (context — report anything that contradicts it):
{ordering-claim · value-claim · assumptions with ids}

Chain journal tail (what previous links learned):
{last ~20 journal lines}

Link body / acceptance (DoD frozen at claim):
{full body + acceptance verbatim}

Files this chain owns — stay inside: {territory}

HARD RULES:
- DO NOT commit, push, branch, merge, or touch git config. Orchestrator lands your work from a patch.
- DO NOT run any write-mode formatter (cargo fmt / prettier --write / ruff format / black / gofmt -w /
  any wrapper) — patch noise. READ-ONLY checks (--check / -l) are fine.
- User-visible behavior stays DORMANT: behind a flag if the project has flags, else not wired into
  any user-facing path. The chain's terminal link flips it on.
- You are a SENSOR as well as hands: a discovery that contradicts the premise is worth MORE than
  completing this link. Never work around a broken assumption silently — a workaround you don't
  report is a review failure.

When done, run the verify gate from the repo root: {verify command} — MUST exit zero.

Report back: one paragraph of changes · last 10 lines of gate output · findings[]:
{ discovery text, which assumption id it touches (or "unmatched" — unmatched escalates, never drops),
  open questions }. Do NOT close the ticket — the orchestrator closes after landing.
```

---

## How mission relates to the suite

| | `/blitz` · `/overdrive` | **`/mission`** |
|---|---|---|
| Unit | wave (batch, barrier-gated) | chain (dependency path, claim-gated) |
| A task starts when | its wave opens | its own deps land — continuous admission |
| Commit | per accepted wave | per landed link |
| Failure | quarantine-and-continue | council → rescope/cancel + falsification report |
| Premise | none (goal is an anchor) | falsifiable, enumerated assumptions, judged |
| Human | per-wave smoke / `--auto` | attended-with-defaults: briefs + verbs, silence → envelope default |

Backlog of independent bounded tickets → `/blitz` or `/overdrive` is simpler and faster. Deep dependency stacks, discovery-heavy work, or "this plan might be wrong" → `/mission`.

---

## Principles

- **A chain is a claim.** Premise immutable; rescope = supersede; every structural change is evidence-bearing.
- **Anti-sprint invariant.** No link transition guarded by a container event or a non-dependency chain. No wave barriers, no cadence ceremonies, no mission-level velocity metrics.
- **Adversary for artifacts, council for premises.** One reviewer settles a diff; three blind seats judge a forecast. The walker never self-grades; the reviewer also attacks the DoD.
- **Fail upward.** A finding that matches nothing escalates one rung up. Fail-silent is the bug.
- **Git wins.** Completion = commit reachable + oracle artifact, never a status flag. The chain-map is derived, disposable, and loses every argument with git.
- **Orchestrator = the write gate.** Sole committer; serial landings; stale leases never land (fencing).
- **Cancellation = knowledge.** Falsification report + dispositions + budget return, or it didn't happen. Cancelled-early ≠ failed — book the budget saved.
- **Intake is the last synchronous moment.** Spend it: red-team the plan, tag every assumption, batch the questions once.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. Already the design: one commit per landed link, orchestrator sole committer, agents never.

## Don't

- Don't add wave barriers, batch gates, or cadence-triggered councils — kill criteria fire councils, calendars don't.
- Don't let agents commit/push/branch/merge — patches through the write gate only.
- Don't land on a red integration gate; don't apply a stale lease's patch.
- Don't edit premise.md — supersede it.
- Don't let the walker classify its own findings' severity — reviewer verdicts + fail-upward do that.
- Don't drop an unmatched finding; don't skip a fired kill criterion because the chain "looks healthy".
- Don't draft links past the evidence horizon — file a spike.
- Don't run >5 lanes; don't tranche-gate budget (tranches trigger digests, not allocation).
- Don't count `incomplete` as complete; don't round oracle results up.
- Don't wire user-visible behavior live before the terminal link.
- Don't push/PR or start the next mission automatically.
