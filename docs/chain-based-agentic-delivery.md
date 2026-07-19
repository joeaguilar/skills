# Chain-Based Agentic Delivery

**Status:** design capture — blank-canvas exploration, not yet implemented as a skill/workflow.
**Provenance:** derived from a first-principles Scrum-replication discussion (2026-07-18), hardened by a two-model adversarial review (Fable subagent + Codex gpt-5.6-sol high), and a five-blade consortium on the container/graph questions (all five blades returned).

---

## 1. Why not Scrum

Every Scrum batching structure is a compensation for a *human* constraint agents don't share:

- **Standing teams / code ownership** amortize slow human context-loading (months). Agent context-loading costs minutes, so ownership degrades to *file-conflict avoidance for the duration of a piece of work*.
- **The sprint timebox** batches coordination because human synchronization is expensive. Agent synchronization is free, so the calendar batch is vestigial — a sprint boundary cuts dependency chains at an arbitrary point and forces flow to queue.
- **The Daily Scrum** schedules lossy human state-sync. Agents sync via artifacts on disk.

What survives from Scrum is its **epistemology**, not its calendar: empirical control loops (inspect/adapt with real levers), falsifiable goals, executable Definition of Done, and separation of implementer from acceptor. The retro survives as a cadence (budget- or event-triggered), not a ceremony.

**The core reframe: a sprint is a container; a chain is a claim.** A sprint asserts nothing — items go in, the timebox does the rest. A chain asserts something about the world: *"B cannot land before A, and this ordering leads somewhere valuable."* Claims can be wrong, must be evidenced, and stay open to revision. Every design element below is downstream of that.

---

## 2. The chain primitive — mapping

| Chain element | Agentic construct |
|---|---|
| Chain | A path through the backlog DAG — an ordered claim with a premise, not a bucket |
| Chain premise | Falsifiable hypothesis; **ordering-claim and value-claim held separately** (they fail differently: ordering-falsified → reparent; value-falsified → terminate); enumerated assumptions with IDs |
| Link | Smallest independently verifiable increment, with its own executable DoD |
| Spine vs frontier | Links backed by evidence vs links drafted ahead; **no links are drafted past the evidence horizon — a spike sits there instead** |
| Spike | The chain-former: recon that creates, extends, or falsifies premises. Hard budget cap + mandatory terminal verdict: `harden` / `redirect` / `dead-end` |
| Lane | The execution context (or agent relay) that walks the chain serially, under a renewable heartbeat **lease** (expiry ⇒ reclaimable; no zombie chains) |
| Chain journal | Durable typed memory handed link to link (`decision` / `discovery` / `open-question` / `superseded`), periodically compacted by a fresh context |
| Link gate | Single adversarial reviewer vs the DoD (artifact decision) |
| Chain gate | Three-seat council (premise decision) |
| Merge node | Where chains converge; automatic council checkpoint — premises compound there |
| WIP limit | Max concurrent lanes, bounded by file-territory overlap and budget |
| Timebox equivalent | Per-chain budget, allocated at formation, decremented per link |
| Standup equivalent | Journal update + per-link premise check; cross-lane propagation via the FACTS ledger |
| Retro equivalent | Graph retro — periodic review of the DAG itself, event/budget-triggered |
| Increment | Lands at every verified link. `commit` = checkpoint; **`landed` additionally requires integration acceptance** (merge-queue-style check against the current graph) |
| Cancellation | Chain-scoped; **publishes a falsification** (see §9) |

**Formation modes** (a healthy system runs all four): top-down decomposition from a charter outcome; spike-seeded frontier extension; bottom-up accretion (blocked work grows the chain backwards); backlog mining (infer edges in a flat backlog to recover the latent DAG). Well-formed chain criteria: **one premise** (two premises = two chains + an edge), **a value terminal** (the tail is independently shippable), **lane-viable territory**.

---

## 3. Working a chain — the per-link cycle

```
claim link (lease + blocking deps verified against git)
  → execute
  → adversarial review:   diff vs DoD  +  attack the DoD's adequacy
                          + per-assumption premise verdicts
  → commit (checkpoint) → integration acceptance (landed)
  → journal update → FACTS diff → advance
```

Hardening rules (survivors of adversarial review):

- **The walker never self-grades.** The reviewer — not the lane — returns per-assumption verdicts: `supports | neutral | contradicts | new-assumption-implied`. Any `contradicts` mechanically triggers a council; the walker cannot suppress or reclassify it.
- **The DoD is not ground truth — it's another authored artifact.** It is frozen at link-claim. The reviewer returns two statuses: `implementation_conforms` AND `acceptance_oracle_adequate`, and must answer "name a behavior the acceptance criterion implies that this DoD does not test." Reviewer charter is counterexample-first, and includes "what did this diff *work around*?" — a workaround visible in the diff with an empty findings field fails the review.
- **Unenumerated assumptions fail upward.** A finding that matches nothing in the premise is treated as `new-assumption-implied` and escalates one rung up — never dropped. Fail-silent is the bug.
- **User-visible behavior always lands flagged-off until the chain completes.** This one rule is what makes cancellation cheap.
- **Speculation** (starting link N+1 before N verifies) is legal only in an isolated worktree branched from the last verified commit, journal-quarantined, and mechanically discarded if upstream fails. If that isolation can't be guaranteed, it's forbidden.

---

## 4. Gates — adversary for artifacts, council for premises

Two epistemic decision types, two gate topologies:

- **Verification** (code, diffs, DoD): ground truth exists and is cheap to consult — one adversarial reviewer suffices; a counterexample settles it.
- **Judgment under uncertainty** (work / rescope / cancel a chain): no artifact arbitrates a forecast — a lone skeptic is either kill-happy or a rubber stamp. These get a **three-seat council**: value seat (worth the remaining budget against the charter?), delivery seat (executable from here — deps, rework rate, budget?), evidence seat (prosecute — the strongest case against continuing, as a concrete falsification argument, not a vote label).

Council hardening (survivors of adversarial review):

- **Independence is manufactured, not asserted:** disjoint evidence briefs per seat (value: charter + burn + landed demos; delivery: DAG + rework + territory; evidence: failure logs + dissent ledger), blind initial votes, different models per seat where available.
- **Rescope = terminate + successor.** The premise is the chain's identity and is immutable; a material rescope closes the chain and opens a successor with `supersedes` provenance.
- **Councils fire on pre-registered mechanical kill criteria**, not judgment calls: every 25% of chain budget, every N links, rework ratio over threshold, any spike returning `redirect`. A chain where every finding is "classified low" still gets audited. Rendered as a TOC-style **fever chart** — budget burned vs links landed, plotted against green/yellow/red zones pre-registered at formation; red-zone entry auto-convenes the council. One artifact serves both the human heartbeat and the kill-criteria substrate.
- **Cancel asymmetry:** once a kill criterion has fired, a lone `cancel` vote takes `proceed` off the table (minimum verdict: rescope). Continuation is the option that requires evidence.
- **Cumulative dissent tripwire** (replaces per-seat calibration tracking, which is unbuildable at n≈10): the same seat dissenting in the same direction on two consecutive reviews auto-escalates to the human with a one-screen brief.

---

## 5. Cross-chain machinery

- **FACTS ledger — project-scoped, not mission-scoped.** Append-only ledger of shared-reality discoveries (environment facts, external-API behavior, invariants), tagged with originating mission/chain. Every link-claim mechanically diffs new FACTS entries against the chain's assumption IDs — the premise check becomes a diff, not judgment. Project scope is load-bearing: a mission-scoped ledger amnesia-wipes the org at every closure; facts learned in mission 1 must invalidate assumptions in mission 3.
- **Typed cross-chain dependency edges** that appear as first-class assumptions in the dependent's premise ("assumes chain-C delivers X"). Edge types: `requires-output` (blocking), `requires-premise-truth` (blocking), `ordering-only` (blocking), `uses-artifact` / `uses-evidence` (advisory, drift = finding).
- **Escalation ladder** for discoveries: match the fact against the artifact hierarchy — story → chain backlog → chain premise → charter — and the *highest* artifact contradicted sets the response. Hardened: classification is done by a **fresh-context classifier** that sees only the finding + hierarchy (the discoverer is the interested party and systematically downgrades); ties resolve upward; rulings are logged.
- **Aggregate triggers:** plan-invalidating conditions are usually distributed — five sub-threshold findings across three chains can jointly kill a charter no single rung notices. Standing triggers over the FACTS ledger (N discoveries in a budget window; two chains independently hitting premise-level findings; aggregate rework threshold) convene a charter audit.
- **Plan-exception freeze:** on a charter-level trip, atomically freeze the *affected dependency closure only* — each lane in it finishes or aborts its current link (never mid-link; commit-per-link makes this nearly free) — while provably unrelated lanes continue. Blast radius is a set, not a scalar.
- **Authority envelope** (fixed at intake): what the system may rescope autonomously, thresholds that require the human, and the timeout default — which is always *"continue the uncontested subset,"* never "proceed as before" and never "stall."

---

## 6. Intake — the mission contract

The prompt+plan is the least-reviewed artifact in most systems and the one everything inherits from. Intake is also the **last synchronous moment** — the human just pressed enter and is still present. Four stages:

1. **Compile** the prompt+plan into a mission contract: outcomes, non-goals, constraints, **acceptance oracles (executable — the closure gate is "run these")**, budget, authority envelope. Every material statement classified: evidenced fact / testable assumption / preference / ambiguity.
2. **Attack it:** a fresh-context red agent produces the top-3 ways the plan fails *in this repository* with file-level evidence, plus a mechanical repo-reality diff (files the plan names that don't exist; features that already exist; version claims vs lockfiles).
3. **Order spikes by invalidation blast-radius** — probe first the assumption whose failure invalidates the most downstream work.
4. **One bounded interrogation + launch digest.** Questions batched once, each carrying the default assumed if unanswered. No lane starts until every assumption is tagged: `verified-at-intake | spike-scheduled | human-confirmed | assumed-by-default`. The `assumed-by-default` list is the contract — cancellations trace back to it.

**Mission closure gate:** acceptance oracles pass against the *integrated* system, required chains terminal, findings below threshold — else the honest verdict is `incomplete`. Without this, agents improve the backlog forever and never declare the request delivered.

---

## 7. Chain review — graph operations

Two review objects: the **work** (per-link, artifact gate) and the **claim** (does the chain still describe reality?). Structural verdicts are graph operations:

`extend` (frontier hardens into spine) · `prepend` (missing precondition surfaces) · `splice`/`prune` (a link is two / unnecessary) · `split` (two independent premises — fission into parallel lanes; hidden parallelism recovered) · `reparent` (ordering-claim wrong, value intact — new dependency root) · `merge` (chains converge; automatic council) · `terminate` (premise falsified — §9).

**Governing rule:** the premise is the chain's identity. Premise-preserving ops are lane-local but logged as structured graph-diffs and **replayed at the next council** (a pruned link's DoD must be shown satisfied elsewhere or provably not entailed — otherwise prune is silent scope erosion). Premise-altering or cross-chain ops require the council.

---

## 8. What a cancelled chain is

**Cancelling a sprint stops a batch; cancelling a chain publishes a falsification.** If termination doesn't produce knowledge, the system didn't cancel a claim — it just stopped typing. Concretely:

- **Per-link disposition pass** (not blanket survival): `retain-active` (valuable regardless of premise) · `reparent` · `quarantine`/keep-dormant (dark behind its flag) · `revert` (harmful under the falsified premise — executed as a normal reviewed link; revert cost is quoted in the verdict and paid before budget returns). v1 may collapse this to two: keep-flagged-off | revert.
- **In-flight work:** lease revoked, aborted at the safe boundary, marked `aborted` never `verified`; findings salvaged, code discarded.
- **Journal:** append-locked, compacted by a fresh context into a **falsification report** (premise, which assumption broke at which link, evidence, total cost) — filed where future formation can cite it. Shared-reality discoveries promoted to the FACTS ledger first. The lane's context is dissolved, never reused.
- **Budget:** remainder minus revert cost returns to the mission pool; only formation events may draw from the pool (surviving lanes can't silently absorb it).
- **Downstream:** typed-edge invalidation posts to every dependent; each must clear a forced premise check before its next link-claim (rebase / rescope / cascade). Cascading termination is correct behavior — three fast falsifications beat three zombie chains.
- **The human sees a verdict, not an apology:** "Chain K cancelled at link 5/9. A2 falsified — [evidence]. Kept 1–3, reverted 4, 38% of budget returned. Downstream: M rescoped, N unaffected." If A2 was `assumed-by-default` at intake, the digest says so.

---

## 9. The container decision — a Mission is an anchor, not a gate

The consortium's verdict, reconciled:

**Name: Mission** (operator seat: the one container word with launch, bounded objective, success criteria, and legitimate abort semantics; makes the human seat self-describing — mission control, sitrep, go/no-go, debrief).

**Anatomy: the Mission is a contract with an account, a court, and a view — never a gate.** The skeptic seat's attack stands: a container becomes a sprint the moment it acquires its own state machine, because lifecycle events attract synchronization. So the Mission *owns things* but *gates nothing chains do*:

- Budget pool = an **account** rooted at the contract, drawn continuously per link — never tranche-gated (tranches trigger *digests*, not allocation).
- Closure gate = a **predicate** over {chain set × acceptance oracles}, evaluated on demand.
- Heartbeat digest = a **read-only view** over journals filtered by mission.
- Chain set = the set of chains whose contract FK points here — membership, not containment.
- FACTS ledger = **project-scoped**, outside the mission folder, entries tagged by mission.

**The anti-sprint invariant (machine-checkable):** no chain state transition may be guarded by a container event or by the state of a chain it has no dependency edge to. Coupling-without-an-edge is the formal tell that batching has crept back in. Companion smells: chain admission gated on container events; done chains queuing behind an aggregate gate; cadence-triggered councils; container-level velocity metrics ("chains per mission" → sizing → committing → protecting — velocity is the sprint's soul). The named prior-art anti-pattern is **SAFe's Program Increment**: a fixed-cadence container with pre-committed scope and ceremony-schedule dependency sync — the board is stale by day two and the container accretes rituals to compensate for its own staleness. Missions admit chains continuously and keep graph truth via a reconciler loop, never a calendar with a scope commitment.

**Operator surface** (condensed from the operator seat; full spec in the consortium transcript):

- Two channels, strictly separated: **pulse digest** (coalesced FYI — budget-tranche / event / max-silence-floor triggered; never contains a buried question; one screen hard cap) and **interrupts** (decision briefs, kill-criteria trips, lease stalls, cancellations — never batched).
- **Dead-man's switch:** a nominal digest fires at the silence floor even when nothing happened — "if you go more than \<floor\> without hearing from the system, the system itself is down." Silence becomes a signed statement.
- **Status line, three numbers:** `landed 14/31 (+22m)` (progress + staleness — time-since-last-landed-link is the best stuck-detector) · `burn 38% / land 45%` (spend vs proof — the fever-chart signal) · `leases 3/3` (pure liveness — the number that lets you trust the other two).
- **Decision briefs:** ≤15 lines, ≤3 evidence bullets, two options + Cancel (always priced), recommended default = what silence executes at the envelope deadline, mandatory "WHILE YOU DECIDE: continuing …/frozen …" line.
- **Intervention verbs** (the human is a privileged actor *inside* the protocol, never an out-of-band editor; effects land at link boundaries): `fact` · `contest` · `confirm` · `answer` · `cancel` · `freeze`/`thaw` · `amend` (contract re-versioned, never edited in place) · `fund` · `nudge` (non-binding steering) · `brief-me [--map]` · `close-now` · `abort`.

---

## 10. The chain-map decision — a derived map, not a law (yet)

Should there be a first-class chain-enforcement graph? **Yes as a map, no as an enforcer — in v1.**

The skeptic's structural argument is decisive at 2–6 lanes: git is an unclosable unmediated write path, so an authoritative graph rots into fiction at bypass-driven (not scale-driven) rates, and every gate that reads the graph instead of the world converts one stale row into N downstream false approvals. Meanwhile the collisions a transactional graph prevents are already covered by three cheap write-path checks:

1. **Lease exclusivity with fencing epochs.** Each lease acquisition mints a monotonically increasing epoch, stamped into every commit trailer and mutation request; the merge gate rejects any stale epoch. A zombie lane that outlived its lease mid-long-LLM-call *physically cannot land work* — timeout-only leasing is the Redlock fallacy (expiry doesn't stop a paused holder from writing after it wakes; fencing must be checked at the write gate).
2. **Link-claim precondition** verified against the *git state of direct dependencies only* (~0.2–0.5K tokens, not a graph read). Completion is Make-style: "landed" = commit exists + acceptance-oracle artifact exists — never a status flag someone must remember to flip.
3. **Acyclicity checked at edge-mutation time only** (~20-line DFS over tracker edges; edges change at rare, council-gated moments — invariant-at-mutation-points replaces invariant-continuous at 1/1000th the machinery).

The **chain-map** exists as a *derived index* — rebuilt on demand from tracker edges + git (`Chain-Link:` commit trailers as the join key) + journals — feeding renders, digests, and closure queries. **Where map and git disagree, git wins by construction**; a rotten index self-heals on rebuild and cannot propagate approvals. The operator only ever sees renders (`brief-me --map`), never the raw artifact.

**Declare/derive split** (the Bazel + Kubernetes borrowing): chains *declare* their own links and typed cross-chain edges in per-chain manifests committed to git; a loader *compiles* the global DAG on demand, rejecting cycles at load; the landed half is *derived* from git trailers — the map is compiled, never hand-maintained (hand-listed deps rot; that's why Gazelle exists). A **level-triggered reconciler** — run at digests, after waves, at startup — diffs declarations against observed reality (leases, landed commits, tracker state) and repairs or flags drift, converting DAG rot from a decay process into a bug a loop fixes. Edge-triggered thinking ("I emitted the event, so it happened") is the failure mode: one missed event is permanent drift. Bonus: `git log` over the committed manifests is a free, tamper-evident mutation journal. Cancellation cascades Airflow-style: flipping a chain to `terminated` mechanically marks dependents' blocked links `upstream_failed` via the typed edges — no agent judgment in the propagation path.

**Graduation rule:** promote the map toward the strong version (event-sourced JSONL log + WAL + mkdir-mutex + validation rules — full spec preserved from the enforcement-architect seat, severable core: acyclicity + unique-lane + status-legality with claim/land enforcement) only when single-writer-per-chain stops being enforceable by convention — more than one orchestrator process, more than ~6 lanes, edge mutations outside council gates — or on the first observed lost-update or cycle incident. And when graduating: **view first, authority later** — the graph earns authority only after it proves it never disagrees with tracker + git.

**Tripwires (production signals that the container or map is failing):**

| Signal | Threshold | Indicates |
|---|---|---|
| Map–reality divergence per reconcile sweep | >1 per 50 links, or any divergence surviving 2 link-cycles | an unmediated write path; map rotting into fiction |
| Bookkeeping ratio (graph/ledger tokens ÷ link-producing tokens) | >15% sustained 2 days | maintenance tax exceeds collision value — the map became the product |
| Claim-retry rate | >5% at ≤6 lanes | serialization bottleneck (global versioning where per-chain would do) |
| Coupling-without-an-edge count | >0 is a smell; >3/mission = the sprint is back | back-door batching |
| Ceremony-without-delivery | 2 digest periods of ledger/council writes with 0 landed links | process metastasis |

---

## 11. v1 minimal layout

Minimalist seat's layout, amended per the skeptic (FACTS at project root):

```
missions/
├── CURRENT                       # one line: active mission slug
├── FACTS.jsonl                   # project-lifetime ledger — lives in missions/ so the skill's
│                                 #   artifacts stay contained, but is NEVER per-slug: it spans
│                                 #   missions (the skeptic's scope argument holds; only the
│                                 #   location moved). Orchestrator is sole writer in v1.
└── <slug>/
    ├── contract.md               # immutable; amendments append as versioned sections
    │     outcomes · non-goals · acceptance-oracles (executable) · budget arithmetic ·
    │     authority-envelope · assumption register w/ intake tags
    ├── FREEZE                    # presence = affected lanes pause at next link boundary
    ├── digest.md                 # heartbeat target
    └── chains/<chain-id>/
        ├── premise.md            # IMMUTABLE — ordering-claim · value-claim · assumptions[id,tag,depends?]
        │                         #   kill-criteria · supersedes? (rescope provenance)
        ├── LEASE                 # {lane, acquired, expires} — rewrite to renew; expired ⇒ claimable
        ├── journal.md            # append-only typed entries + facts-cursor line
        └── falsification.md      # written once, at seal, on cancellation only
```

Links are **tracker issues** (`chain:<id>` label, blocked-by edges for order, DoD as an executable block in the body) — not files. Review and council verdicts are typed journal entries. Councils are 3 parallel subagent calls tallied by the orchestrator. The `chains/` directory listing *is* the chain set.

**v1 simplifications (deliberate):** disposition collapses to keep-flagged-off | revert; whole-mission FREEZE instead of computed dependency closures (over-freezing costs minutes at this scale; closure computation costs an engine); transitive invalidation via grep-for-`depends:` + per-dependent FACTS entries; aggregate triggers collapse to "any premise/mission-severity FACTS entry → council."

---

## 12. Open items

**Packaging (resolved 2026-07-18):** implemented as `claude/skills/mission/SKILL.md` — a single caveman-register suite skill (autonomous-execution family, not a Dojo blade, not a Workflow script: the mutable DAG and intervention verbs fight deterministic scripts). v1 is attended-with-defaults; single orchestrator = the write gate (subagents never touch git), lanes = worktree-isolated link agents landed serially via patch + integration gate; budget metered in subagent tokens; DoD/oracles run through `gatr`; council seats on the `ambiguous` role (opus) with optional Codex-sol evidence seat. The tracker capability check passed: `itr` provides blocked-by edges with mutation-time cycle rejection, tags, claim, and `supersedes` relations — tracker-is-the-graph holds.

- **Integration mechanics for `landed`** across 2–6 concurrent lanes (shared integration branch vs serialized merge queue). Related: whether git multi-ref transactions can serialize the merge gate across worktrees, or a single gatekeeper process is required (prior-art seat leans gatekeeper).
- **Fever-chart zone thresholds** — no empirical green/yellow/red boundaries exist for agent work; initial zones must be guessed and tuned against real missions.
- **Interrupt transport** for the operator channel (terminal vs push/email) and multi-operator missions (the verb set assumes exactly one human).
- **Tracker capability check:** the v1 layout assumes labels + blocked-by + claim semantics in `itr`; if blocked-by is absent, fallback is a per-chain `links.md` ordering file.
- **Mission-cancel crash durability:** FK-cascade must be idempotent and resumable (narrow question, answered by the strong-graph WAL if/when it graduates).
- **Mapping to existing primitives in this repo** (sprint suite, blitz waves, proof-campaign artifacts, overdrive loop) — deliberately excluded here; this doc is the blank-canvas capture.
