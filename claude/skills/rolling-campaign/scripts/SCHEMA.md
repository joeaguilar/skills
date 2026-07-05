# rolling-campaign JSON schemas

A chain is a sequence of campaign legs. Each leg writes the same compact-JSON state a single campaign does — `campaign.json`, `queue.json`, `evidence.json`, `ledger.json` — plus two chain-specific files: `handoff.json` (per leg) and `chain.json` (per chain).

The per-leg campaign state (`campaign.json` / `queue.json` / `evidence.json` / `ledger.json`) follows the proof-campaign compact-JSON shape: `campaign.json` is the renderer entrypoint (goal, scope, window, cap, totals, status); `queue.json` holds work items with lane/status/owned-files/AC/evidence refs; `evidence.json` is the verification matrix; `ledger.json` carries wave history, signals, and the derived report content. All timestamps ISO 8601, all IDs strings, all cross-file references via `id`.

This document specifies only the two files unique to a chain.

---

## handoff.json (the resume + decision contract)

Written at the end of every leg (Phase 4) and mirrored to `chain/CURRENT/handoff.json`. **Not read by any renderer** — read by `scripts/chain.sh` and by the next `--resume` leg. It is the only thread between two cleared contexts.

```json
{
  "schema": "rolling-campaign-handoff/1",
  "from_leg": "leg-001-2026-07-04-foundation",
  "from_leg_dir": "chain/leg-001-2026-07-04-foundation",
  "ended_at": "2026-07-04T18:30:00Z",
  "stop_condition": "cap_pressure",
  "continue": "yes",
  "halt_reason": null,
  "verify_gate": "npm test && npm run lint",
  "roadmap_remaining": ["§A.5", "§A.6", "§A.7"],
  "deflected_issues": [
    { "item_id": "Q-9", "itr": "itr#88", "gate": "verify", "attempts": 1,
      "reason": "Deterministic: needs PO smoke on staging data; identical retries cannot change it — deflected after 1 attempt." }
  ],
  "deflected_all": ["itr#88"],
  "next_campaign": {
    "dir": "chain/leg-002-2026-07-04-sync",
    "n": 2,
    "slug": "sync",
    "goal": "Close §A.5-§A.6 (Sync completion, Schema v2)",
    "roadmap_rows": ["§A.5", "§A.6"],
    "queued_item_ids": ["Q-15", "Q-17", "Q-22"],
    "prepared": true
  },
  "chain": { "index": 1, "max_campaigns": 8 },
  "carryover_notes": "Q-9 migration flake stabilized; watch CI on first sync wave."
}
```

`deflected_issues` are the items **this leg** handed to the PO (each is filed to `itr`, marked `blocked`, and added to `smoke_test.items`). `deflected_all` is the **cumulative** set across every leg so far — the next `--resume` leg loads it and **excludes those ids from its `ready`/candidate pool**, so the chain never re-attempts its own deflected work (the anti-steamroll rule). `deflected_issues` is expected, designed output — the PO-smoke queue — not a failure list.

| Field | Type | Notes |
|---|---|---|
| `schema` | string | Contract version. `rolling-campaign-handoff/1`. |
| `from_leg` | string | id of the leg that just finished. |
| `from_leg_dir` | string | Its folder, relative to repo root. |
| `ended_at` | ISO 8601 | Close time of this leg. |
| `stop_condition` | enum | `cap_pressure` \| `queue_empty_more_remains` \| `roadmap_complete` \| `only_deflected_remains` \| `verify_unfixable` \| `needs_human` \| `no_progress_2x` \| `max_campaigns` \| `aborted`. `only_deflected_remains` and `roadmap_complete` are **success** stops. |
| `continue` | enum | `yes` \| `no`. **The only field the driver branches on.** `yes` is invalid unless `next_campaign.prepared` is true. |
| `halt_reason` | string \| null | One-line human-readable cause when `continue: no`; null otherwise. The driver prints this. |
| `verify_gate` | string | Gate command, carried forward so the next leg needn't re-detect. |
| `roadmap_remaining` | string[] | Rows still ❌/🟡 inside the approved chain boundary. Empty ⇒ slice done. |
| `deflected_issues` | object[] | Items **this leg** handed to the PO — `{item_id, itr, gate, attempts, reason}`. Each is filed to `itr`, marked `blocked`, and added to `smoke_test.items`. `attempts` is how many rounds ran before deflecting (`1` = early-deflected on a deterministic, attempt-invariant cause; up to `3` otherwise). Expected output, not failures. |
| `deflected_all` | string[] | **Cumulative** deflected `itr` ids across all legs. The next `--resume` leg loads this and excludes these from its candidate pool — the anti-steamroll rule. When the candidate pool minus this set is empty, the chain is done (`only_deflected_remains`). |
| `next_campaign` | object \| null | The drafted-and-ready next leg. Null when `continue: no`. |
| `next_campaign.dir` | string | Folder that already exists on disk. |
| `next_campaign.queued_item_ids` | string[] | `next_campaign`-lane items to promote to `ready` on resume. |
| `next_campaign.prepared` | bool | True only when the folder + queue items exist on disk. `continue: yes` is invalid without it. |
| `chain.index` | integer | 0-based leg number of the campaign that just ran. |
| `chain.max_campaigns` | integer | Safety cap; the driver stops at this many legs. |
| `carryover_notes` | string \| null | Short free text for the next context (watch-items, gotchas). |

**Invariant:** `continue: "yes"` ⇒ `next_campaign.prepared: true` and `next_campaign.dir` exists on disk. A missing, malformed, or `no` handoff is treated as **stop**, never as continue. Fail safe.

---

## chain.json (chain-level ledger)

One per chain, at `chain/chain.json`. Human/PO-facing rollup across all legs. Appended to at the end of every leg.

```json
{
  "schema": "rolling-campaign-chain/1",
  "chain_goal": "Prove §A.1-§A.7 (Storage → Schema v2) end-to-end",
  "chain_scope": { "roadmap_rows": ["§A.1", "§A.2", "§A.3", "§A.4", "§A.5", "§A.6", "§A.7"] },
  "started_at": "2026-07-04T14:00:00Z",
  "verify_gate": "npm test && npm run lint",
  "max_campaigns": 8,
  "divergence_note": null,
  "deflected_all": ["itr#88"],
  "legs": [
    {
      "index": 0,
      "id": "leg-001-2026-07-04-foundation",
      "dir": "chain/leg-001-2026-07-04-foundation",
      "roadmap_rows": ["§A.1", "§A.2", "§A.3", "§A.4"],
      "verified": 14, "blocked": 1, "parked": 3, "next_campaign": 6,
      "verify_result": "green",
      "work_used_tokens": 142000,
      "ended_at": "2026-07-04T18:30:00Z",
      "continue": "yes"
    }
  ],
  "halted": false,
  "halt_reason": null
}
```

| Field | Type | Notes |
|---|---|---|
| `schema` | string | `rolling-campaign-chain/1`. |
| `chain_goal` | string | The whole slice this chain will prove. |
| `chain_scope.roadmap_rows` | string[] | All rows across all legs. |
| `started_at` | ISO 8601 | When the seed gate was approved. |
| `verify_gate` | string | Detected/approved once at seed, carried by every leg. |
| `max_campaigns` | integer | Leg cap for the chain. |
| `divergence_note` | string \| null | Set when the chain goal diverges from the roadmap suggestion. |
| `deflected_all` | string[] | Cumulative PO-smoke `itr` ids handed over across the whole chain — the human's queue, and the exclusion set every leg honors. |
| `legs[]` | object[] | One entry appended per completed leg (fields mirror that leg's `campaign.json` totals + its handoff `continue`). |
| `halted` | bool | True once a leg emitted `continue: no`. Note: `only_deflected_remains`/`roadmap_complete` set this true but are **successful** completions, not failures. |
| `halt_reason` | string \| null | Copied from the halting leg's `handoff.halt_reason`. |

---

## Minimal valid handoff

Smallest handoff that halts cleanly (e.g. seed leg found the slice already complete):

```json
{
  "schema": "rolling-campaign-handoff/1",
  "from_leg": "leg-001-2026-07-04-tiny",
  "ended_at": "2026-07-04T14:10:00Z",
  "stop_condition": "roadmap_complete",
  "continue": "no",
  "halt_reason": "All approved roadmap rows already ✅ with linked verified work.",
  "next_campaign": null,
  "chain": { "index": 0, "max_campaigns": 8 }
}
```
