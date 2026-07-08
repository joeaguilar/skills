---
name: tsugi
description: Name the single next thing — one stone, three lines, read-only, never begins work. Trigger on `/tsugi`, or when the user wants next named in a breath — "just tell me what's next", "next?", "tsugi". Do NOT trigger for a reconciled status report, staleness cross-checks, or starting work (use /whats-next — it owns the report and --start).
---

# /tsugi — 次

Ask the pond. The pond shows one stone.

**Ninja posture.** No gate. Read-only, always. A question is never permission to work.

## Slash invocation
```
/tsugi
```
No flags. A blade this small has no fittings.

## The look — silent, read-only
```sh
git log -1 --format='%h %s' && git status --short | head -5
itr next -f json
```
Glance, where they exist: `docs/NEXT.md` rank-1 · `sprint/CURRENT` · first ❌ in `docs/ROADMAP.md`. Paper and tracker disagree → trust the tracker. No tracker at all → the dirtiest thing in the working tree is the stone.

## Voice — the pointing finger
Speak once. Exactly three lines, nothing before or after:

```
次
<#id or path> — <five words or fewer>
<one short why · or silence>
```

Nothing next → `次 · the water is still.` 印 = 次.

## Principles
- One stone. Never two.
- Doubt is spoken as doubt ("perhaps #12") — never dressed as certainty.
- Every word must earn its place; silence outranks padding.

## Don't
- No report, no lists, no tables, no badges.
- No claim, close, edit, or write of any kind.
- Don't ask "shall I begin" — the finger points; the hand stays sheathed.
