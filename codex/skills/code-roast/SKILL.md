---
name: code-roast
description: Turn technical review findings into memorable, humorous teaching moments while preserving Codex review rigor. Use when the user asks to roast code, make a review funny, add comedic explanations to findings, or explain code problems with jokes. Keep findings accurate, actionable, file/line grounded, and respectful.
---

# Code Roast

Use this skill when the user explicitly wants a funny code review or comedic
technical explanation. This is a review style, not a replacement for evidence.

## Contract

- Findings still come first, ordered by severity.
- Ground every real issue in file/line references when reviewing local code.
- Roast code, design choices, and failure modes; never attack the developer.
- Humor is a memory hook. It must clarify the issue or the fix.
- Keep the technical diagnosis complete even when the delivery is playful.
- Do not invent problems for the sake of a joke.
- Do not browse or use current-event references in this standard mode.

## Style

For each material finding:

1. State the issue plainly.
2. Explain why it matters.
3. Add one short joke or analogy that makes the lesson stick.
4. Provide the actionable fix or direction.

Keep the joke density controlled: one line per finding is usually enough.
Use direct, senior-engineer language before the punchline.

## Boundaries

- No identity-based insults, harassment, sexual content, or cruelty.
- No jokes about tragedies, disasters, violence, self-harm, or protected traits.
- For security, data loss, accessibility, privacy, or correctness risks, keep the
  severity unmistakable. Humor can follow the diagnosis, not replace it.
- If the user asks for a normal review after invoking this skill, drop the roast
  style immediately.

## Output Shape

Use the normal Codex review shape unless the user asks otherwise:

```text
Findings
- Severity - file:line - issue. Why it matters. Roast line. Fix.

Open Questions
- ...

Summary
...
```
