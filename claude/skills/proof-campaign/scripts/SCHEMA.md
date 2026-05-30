# Proof-campaign JSON schemas

Every `/proof-campaign` run writes four JSON files into `campaign/<folder>/`:

| File | Role |
|---|---|
| `campaign.json` | Campaign-level state (goal, scope, window, cap, totals). Entrypoint for the renderer. |
| `queue.json` | All work items with lane/status, file ownership, AC, evidence refs. |
| `evidence.json` | Verification matrix — every test/screenshot/log linked to an item. |
| `ledger.json` | Wave history, signals, and the auto-derived report content (smoke-test items, retro, roadmap-update packet). |

The renderer (`scripts/render_campaign_report.py`) reads `campaign.json` as the entrypoint and auto-discovers the three sibling files in the same directory. Missing siblings are tolerated — the corresponding report sections render with a banner explaining the gap.

All timestamps are ISO 8601 (`2026-05-16T14:30:00Z`). All IDs are strings. All references between files use the `id` field.

---

## campaign.json

```json
{
  "id": "campaign-001-2026-05-16-foundation",
  "slug": "foundation",
  "n": 1,
  "goal": "Close §A.3-§A.5 (Storage, Sync, Schema) with full verify gate green",
  "scope": {
    "roadmap_rows": ["§A.3", "§A.4", "§A.5"],
    "intended_final_status": {
      "§A.3": "✅",
      "§A.4": "✅",
      "§A.5": "🟡"
    },
    "out_of_scope": ["§A.6", "§A.7", "§B.*"]
  },
  "window": {
    "started_at": "2026-05-16T14:00:00Z",
    "ended_at":   "2026-05-16T18:30:00Z"
  },
  "verify_gate": "npm test && npm run lint && npm run typecheck",
  "work_cap_tokens": 200000,
  "work_used_tokens": 142000,
  "concurrency": 5,
  "max_waves": null,
  "totals": {
    "verified": 14,
    "blocked": 1,
    "parked": 3,
    "next_campaign": 6,
    "quarantined": 1
  },
  "status": "complete",
  "divergence_note": null,
  "roadmap_path": "docs/ROADMAP.md",
  "tracker": "itr"
}
```

Field reference:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Folder name. `campaign-{n:03d}-{YYYY-MM-DD}-{slug}`. |
| `slug` | string | Short hyphenated handle. Used in display and the `--name` flag. |
| `n` | integer | Campaign number, 1-indexed, monotonic per repo. |
| `goal` | string | The one-line `G`. Mirrors what the PO approved at the single gate. |
| `scope.roadmap_rows` | string[] | Roadmap row identifiers (`§A.3`). Empty if `roadmap=absent`. |
| `scope.intended_final_status` | object | row → planned final status (`✅` / `🟡` / `❌`). Honest about what won't fully close. |
| `scope.out_of_scope` | string[] | Rows the planner will refuse to touch. Glob-style allowed (`§B.*`). |
| `window.started_at` | ISO 8601 | When the gate was approved. |
| `window.ended_at` | ISO 8601 \| null | Null while in-flight. |
| `verify_gate` | string | Exact command run between waves. |
| `work_cap_tokens` | integer | Main orchestrator work-token cap. Default 200000; worker, scout, and reviewer context budgets are independent. |
| `work_used_tokens` | integer | Running estimate of main orchestrator tokens spent coordinating the campaign. |
| `concurrency` | integer | Max simultaneous workers per wave. |
| `max_waves` | integer \| null | Optional hard cap. |
| `totals.verified` | integer | Items closed with full evidence. |
| `totals.blocked` | integer | Items that hit a wall and were left for human follow-up. |
| `totals.parked` | integer | Out-of-scope or insufficiently verifiable. |
| `totals.next_campaign` | integer | Drafted into next-campaign folder, not executed. |
| `totals.quarantined` | integer | Items pulled mid-wave to keep the gate green. |
| `status` | enum | `in_progress` \| `complete` \| `blocked` \| `aborted`. |
| `divergence_note` | string \| null | Set when `G` diverges from roadmap suggestion. |
| `roadmap_path` | string \| null | Path to ROADMAP at intake time. |
| `tracker` | string | `itr` or the override command. |

---

## queue.json

```json
{
  "items": [
    {
      "id": "Q-1",
      "title": "Storage primitive: chunked write API",
      "source": "itr#34",
      "roadmap_rows": ["§A.3"],
      "lane": "verified",
      "owned_files": ["src/storage/chunks.ts"],
      "forbidden_files": ["src/storage/index.ts"],
      "acceptance": [
        "Writes blocks <= 4MB",
        "Verifies CRC on read",
        "Throws TypedStorageError on chunk mismatch"
      ],
      "verify": "npm test -- storage/chunks",
      "evidence_needed": ["unit", "e2e"],
      "evidence_refs": ["e-1", "e-2"],
      "token_estimate": 25000,
      "token_actual": 21800,
      "deps": [],
      "risk": "low",
      "wave": 2,
      "closed_at": "2026-05-16T15:42:00Z",
      "user_visible_change": "Large object writes no longer OOM at >50MB",
      "notes": null
    },
    {
      "id": "Q-15",
      "title": "Add retry to migration test setup",
      "source": "scout-review",
      "roadmap_rows": [],
      "lane": "next_campaign",
      "owned_files": ["test/migrations/setup.ts"],
      "acceptance": ["Migration test passes 10/10 runs"],
      "verify": "npm test -- migrations",
      "evidence_needed": ["unit"],
      "token_estimate": 10000,
      "risk": "low",
      "notes": "Drafted into campaign-002 — flake not in §A.3-§A.5 scope."
    }
  ]
}
```

`lane` enum:

| Value | Meaning |
|---|---|
| `ready` | Eligible to spawn in next wave. |
| `active` | Worker currently running. |
| `verified` | Closed with full evidence. |
| `blocked` | Hit a wall; needs human input. |
| `parked` | Out-of-scope or insufficiently verifiable. |
| `next_campaign` | Drafted into next-campaign folder, not executed. |
| `quarantined` | Pulled mid-wave to keep the gate green. |

Required fields: `id`, `title`, `lane`. All others optional but recommended.

`source` should name the originating ticket/scout (`itr#NN`, `scout-roadmap`, `scout-review`, `carryover-campaign-N`).

---

## evidence.json

```json
{
  "evidence": [
    {
      "id": "e-1",
      "item_id": "Q-1",
      "kind": "test",
      "label": "Unit: storage/chunks (8 specs)",
      "command": "npm test -- storage/chunks --reporter=junit",
      "result": "pass",
      "artifact_path": "campaign/campaign-001-2026-05-16-foundation/artifacts/storage-chunks.xml",
      "artifact_inline": null,
      "captured_at": "2026-05-16T15:40:00Z"
    },
    {
      "id": "e-2",
      "item_id": "Q-1",
      "kind": "e2e",
      "label": "Playwright: large upload",
      "command": "npx playwright test e2e/large-upload",
      "result": "pass",
      "artifact_path": "campaign/campaign-001-2026-05-16-foundation/artifacts/large-upload-trace.zip",
      "captured_at": "2026-05-16T15:41:00Z"
    },
    {
      "id": "e-7",
      "item_id": "Q-4",
      "kind": "screenshot",
      "label": "Settings: storage panel after refactor",
      "artifact_path": "campaign/campaign-001-2026-05-16-foundation/artifacts/storage-panel.png",
      "captured_at": "2026-05-16T16:12:00Z",
      "result": "pass"
    }
  ]
}
```

`kind` enum: `test`, `e2e`, `screenshot`, `diff`, `docs`, `migration`, `log`, `manual`.

`result` enum: `pass`, `fail`, `partial`, `not_run`.

`artifact_inline` (optional): short text excerpts (test output snippet, diff hunk). The renderer embeds these in `<pre>` blocks. Use `artifact_path` for binary or large artifacts — the renderer links instead.

---

## ledger.json

```json
{
  "waves": [
    {
      "n": 1,
      "started_at": "2026-05-16T14:05:00Z",
      "ended_at":   "2026-05-16T14:48:00Z",
      "bundles_run": 3,
      "items": ["Q-1", "Q-2", "Q-3"],
      "verify_result": "green",
      "retries": 0,
      "quarantines": [],
      "tokens_used": 45000,
      "notes": "Clean wave. Storage primitives landed first as planned."
    },
    {
      "n": 2,
      "started_at": "2026-05-16T14:50:00Z",
      "ended_at":   "2026-05-16T15:55:00Z",
      "bundles_run": 4,
      "items": ["Q-4", "Q-5", "Q-6", "Q-7"],
      "verify_result": "green",
      "retries": 1,
      "quarantines": [],
      "tokens_used": 62000,
      "notes": "Q-5 needed one repair pass for a lint error."
    }
  ],
  "signals": {
    "total_waves": 4,
    "retries": 1,
    "quarantines": 1,
    "verify_failures": 0,
    "scout_tickets_accepted": 6,
    "scout_tickets_parked": 2,
    "scout_tickets_next_campaign": 4
  },
  "retro": {
    "what_slowed": [
      "Migration test flake on first run (Q-9)"
    ],
    "process_fixes": [
      "Add retry to migration test setup — drafted as Q-15 in campaign-002"
    ],
    "followups": ["Q-15", "Q-17"]
  },
  "smoke_test": {
    "how_to_run": [
      "git checkout campaign-001-foundation",
      "npm install",
      "npm run dev",
      "Open http://localhost:5173"
    ],
    "items": [
      {
        "id": "S-1",
        "label": "Upload a >50MB file and confirm no OOM",
        "evidence_refs": ["e-1", "e-2"],
        "source_items": ["Q-1"]
      },
      {
        "id": "S-2",
        "label": "Open Settings → Storage panel; visual matches baseline",
        "evidence_refs": ["e-7"],
        "source_items": ["Q-4"]
      }
    ],
    "questions_for_po": [
      "Should chunk size be PO-configurable per project, or stay at 4MB?"
    ],
    "non_goals": [
      "Storage admin UI (deferred to §A.8)",
      "Cross-device sync (separate campaign)"
    ]
  },
  "roadmap_update": {
    "section_updates": [
      {
        "section": "§A.3",
        "current": "❌",
        "proposed": "✅",
        "evidence": "All 3 AC met. itr#34/#35/#36 closed with unit+e2e proof.",
        "linked_work": ["itr#34", "itr#35", "itr#36"]
      },
      {
        "section": "§A.4",
        "current": "❌",
        "proposed": "🟡",
        "evidence": "Core sync API shipped. Cross-device sync deferred per scope.",
        "linked_work": ["itr#40", "itr#41"]
      }
    ],
    "new_coverage": [
      {
        "section": "§A.5",
        "issue": "itr#52",
        "status": "open",
        "notes": "Stub upgraded with full AC by scout-sprint-lite."
      }
    ],
    "po_owned_or_ambiguous": [
      "§A.4 trajectory cell needs PO confirmation — partial-close was planned, but velocity may permit full-close next campaign."
    ],
    "suggested_command": "/roadmap --update --scope §A.3-§A.5"
  }
}
```

### `waves[]`

One entry per wave. `verify_result` is `green` \| `red` \| `partial`. `quarantines` lists `Q-*` ids removed mid-wave.

### `signals`

Aggregates over the whole campaign. Drives auto-retro depth — clean signals = short retro; any non-zero retry/quarantine/failure expands the retro sections.

### `retro`

Free-form arrays for the auto-generated retro. Keep short.

### `smoke_test`

Drives `smoke-test.html`. `evidence_refs` resolve into `evidence.json`. `source_items` resolve into `queue.json` items the PO can trace back to.

### `roadmap_update`

Drives `roadmap-update.html`. The renderer does **not** modify `docs/ROADMAP.md` — it produces the packet the PO applies via `/roadmap --update`.

---

## Minimal valid campaign

The smallest viable JSON set (renderer will produce all four reports without crashing):

```json
// campaign.json
{ "id": "campaign-001-2026-05-16-tiny", "n": 1, "goal": "Smoke", "status": "complete", "totals": {} }

// queue.json
{ "items": [] }

// evidence.json
{ "evidence": [] }

// ledger.json
{ "waves": [], "signals": {}, "retro": {}, "smoke_test": {}, "roadmap_update": {} }
```

The reports will be mostly empty with `(none recorded)` banners. Useful for first-run smoke tests and for paused/aborted campaigns.
