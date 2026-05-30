# Wave Plan — sprint-1

## Wave 1

| Ticket | Files | Reason |
|---|---|---|
| itr#3 | `codex/explorer/index.html`, `codex/explorer/styles.css`, `codex/explorer/app.js` | Platform selector markup, styling, state storage, manifest pathing, and Markdown Explorer source selection are tightly coupled in the current explorer UI. |

## Conflicts

None. Single-arm wave.

## Notes

- Keep the UI read-only with respect to materialized payload installation.
- Do not touch Claude payloads.
- Verify gate: `./validate-skills.sh && node --check codex/scripts/skill-tree.js && node --check codex/explorer/app.js`.
