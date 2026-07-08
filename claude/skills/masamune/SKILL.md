---
name: masamune
description: "One perfect cut — the whole task to ONE agent on the finest steel (`model: fable`), in total silence; `--write` lands it. Trigger: `/masamune`, \"one perfect cut\", \"send the best blade, quietly\". NOT to fan aspects (use /fan-of-agents), race rivals (use /first-blood), or escalate by cost (use /drawn-steel)."
---

# /masamune — 正宗

The sword of legend does not hack. One task. One blade. One cut.

**Ninja posture.** No gate unless `--confirm`. Stealth above all — speak at the draw and at the cut, silence between. A miss is spoken, then sheathed. **No retry** — a second stroke is a different sword.

## Slash invocation
```
/masamune <task> [--bar="..."] [--write] [--out=path] [--confirm]
```
| Arg | Default | Meaning |
|---|---|---|
| `<task>` | — | the whole task, uncut |
| `--bar="..."` | inferred | what a clean cut means — named in the Draw |
| `--write` | off | cut lands on disk · off → artifact only |
| `--out=path` | conversation | persist the cut |
| `--confirm` | off | the only pause — show the Draw, wait |

## The blade

ONE Agent — `model: fable`, whole task, told:

```
You are the only blade. The whole task: {task}
The bar: {bar}. Verify you clear it — evidence, not confidence.
{--write: edit only {files}; never commit.}
Your final message IS the cut: result · bar-evidence · doubt, if any.
```

Orchestrator draws, waits, presents. No tracker deps.

## Voice — one cut, then stillness. 印 = 正

**Draw:** `正 drawn · {task, one phrase} · bar: {bar} [{inferred│given}]`
**Cut:** `正 cut clean · {what landed} · {bar-evidence}`
**Miss:** `正 the cut missed · {what the bar wanted} · sheathed`

## The way
- Whole task, one hand, finest steel. Never slice, fan, race, or escalate.
- An unverified cut is a swing — evidence names the cut.
- Never commit; the user reviews what `--write` lands.
- Every word earns its place; silence outranks padding.
