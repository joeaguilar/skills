# Caveman Compression — contract intact

> How to shrink a skill file's token cost without breaking what it does.
> Distilled from the `/overdrive` compression pass. Reusable on any autonomous/reference skill.

Inspired by [caveman](https://github.com/JuliusBrussee/caveman): **"why use many token when few token do trick."**
The load-bearing line: **"Caveman no make brain smaller. Caveman make mouth smaller."**

---

## The idea, and the twist

Caveman compresses *delivery* — it strips the polite, hedging, restating prose around a point while keeping the point exact. Code, paths, URLs, numbers stay byte-for-byte.

The twist for **skill files**: a skill isn't chat output, it's an **executable contract**. An agent reads it and *acts*. So "preserve the brain" is not optional politeness — it's correctness. The prose can go telegraphic; the *contract* (commands, thresholds, control flow, guardrails) cannot lose a single bit, or you reintroduce the exact ambiguities a careful author removed. Compression that creates ambiguity is a regression, not a win.

So the whole method is one rule applied twice:

> **Compress the mouth all the way down. Touch the brain not at all.**

---

## Two layers

| | Brain — the contract | Mouth — the prose |
|---|---|---|
| **What** | commands, thresholds, control flow, tables, schemas, flags, regexes, edge-case guardrails | coaching, rationale, hedging, transitions, restatements, filler |
| **Rule** | **preserve byte-for-byte** | **compress hard / delete** |
| **Test** | "could an agent execute differently if this changed?" → brain | "is this explaining *why*, not *what*?" → mouth |

### Preserve byte-for-byte (never touch)

- **Exact commands** — `git reset --hard <sha>`, `itr update <id> --status open`, the `git add -A` + three-`-m` commit shape.
- **Every threshold/number** — `concurrency 5`, `max-retries 2`, `rework budget = 3`, `30m` timeout, `2×` backstop, `≥ 80%`, "2 consecutive zero-waves".
- **Control flow & decision rules** — what triggers a defer vs a quarantine, the re-derivation filter, stop conditions, the termination argument.
- **Tables, schemas, templates** — verify-gate detection table, wave-log schema, the per-arm prompt (it's a prompt the skill *emits* — that's code).
- **Identifiers an agent matches on** — tag names (`quarantined-sprint-N`, `from-review-N`), regexes (`^overdrive wave-\d+: closes …`), flag names.
- **Edge-case guardrails the review earned** — "stash is a backup, not auto-popped"; "reopen closed tickets, never quarantined"; "scan blocking quarantines before closing the epic". These are *why the skill is correct*. Terser wording, same logic.

### Compress hard (cut or telegraph)

- **Coaching essays** — "This is the innovation…", "That's the whole point."
- **Rationale repeated more than once** — state the *why* once, near the rule; delete the echoes.
- **Hedging & transitions** — "it's worth noting that", "in order to", "as mentioned above".
- **Restated guarantees** — one canonical "why this terminates" beats five scattered reassurances.
- **Filler grammar** — articles, auxiliary verbs, polite framing, full sentences where a fragment is unambiguous.

---

## Caveman style rules (the mouth)

- **Fragments over sentences.** "Red → re-run up to 2× on the unchanged tree." not "If it is red, you should re-run the gate up to two more times."
- **Drop articles & filler.** "Orchestrator commits → tree must be sane." not "Because the orchestrator commits, the tree must be sane."
- **Imperative + arrows.** `condition → action`. Dense, scannable, unambiguous.
- **Keep every noun that names a thing an agent touches.** Verbs and nouns carry the contract; articles and adverbs don't.
- **Numbers, commands, identifiers: typed exactly, once.** Never paraphrase a command into prose.

---

## The honest ratio

Caveman advertises ~65% on chatty assistant output. **A skill spec won't hit that** — and chasing it is the trap.

A good skill is ~60% irreducible contract: command blocks, tables, schemas, the emitted prompt template. That's all brain — it stays. You're only compressing the ~40% that's prose, so realistic whole-file reduction is **~20–25%** (word count drops more than char count, because prose is word-dense and tables/code are word-sparse).

`/overdrive`: **6,128 → 4,745 words (−23%)**, zero executable detail lost.

> If your reduction is much higher than ~25% on a mature skill, suspect you cut brain. Re-check the contract.

---

## Contract-integrity check (run after compressing)

Mechanical, greppable — this is how `/overdrive` was verified post-compression:

1. **Fences balanced** — ``` count is even.
2. **Every flag still referenced** — each `--flag` in the invocation table appears in a phase body, and vice-versa.
3. **All sections/phases present** — same header set as before; nothing dropped with its prose.
4. **Thresholds present** — grep each number/command (`max-retries`, `= 3`, `≥ 80%`, `git reset --hard`, the regex, tag names). Count ≥ 1.
5. **Templates & schemas intact** — the emitted prompt and any log/artifact schemas survived verbatim.
6. **Diff-read the cut** — skim `git diff` and confirm every deletion is mouth, never brain.

A 0 from a grep is usually a regex-escaping false negative (backticks, parens, unicode like `≥`) — re-check with a fixed-string match before "fixing" anything.

---

## Worked example

**Before (mouth + brain entangled):**
> *Announce: `Phase 5 — Monitor & self-heal`. Event-driven; no polling. Mid-edit LSP noise is ignored until an agent reports. **Permission / missing-dep failure** → orchestrator fixes it (edit manifest, install tool, grant the path), logs to `Interventions`, resumes the arm via `SendMessage`.*

**After (mouth stripped, brain identical):**
> *Event-driven, no polling. Mid-edit LSP noise ignored until an arm reports. **Permission / missing-dep fail** → orchestrator fixes (edit manifest, install tool, grant path), logs `Interventions`, resumes arm via `SendMessage`.*

Same commands, same triggers, same logging target. Fewer tokens loaded into context every time the skill fires.

---

## When to apply — and when not to

**Apply** to skills the agent runs *fast and autonomously*, where the file is loaded into context on every invocation and verbosity is pure cost: `/overdrive` and its kind. Also good for dense reference docs.

**Do NOT apply** to **coached, step-by-step skills where verbosity is the feature** — `/sprint`, `/blitz`, `/sprint-review`. Those walk a human through dialed-in changes; the prose *is* the product (announcements, the *why* of each gate, the coaching tone). Compressing them removes the thing that makes them good.

> Rule of thumb: **verbose for human-in-the-loop precision; caveman for hands-off speed.** One suite, two registers.

---

## Procedure

1. **Classify, don't rewrite blind.** Tag each block brain or mouth first.
2. **Freeze the brain.** Copy commands/tables/schemas/templates/thresholds across untouched.
3. **Telegraph the mouth.** Fragments, arrows, drop filler; keep one canonical statement of each *why*.
4. **Run the integrity check.** Greps + diff-read. Fix only real losses.
5. **Report the honest ratio.** Word/char delta, and an explicit "zero executable detail lost."
6. **Commit as its own step.** `add the skill` → `caveman pass` reads cleanly in history and is trivially revertible.
