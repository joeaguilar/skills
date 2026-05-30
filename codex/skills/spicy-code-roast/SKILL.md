---
name: spicy-code-roast
description: A spicier, opt-in code roast with topical, current-event, or fresh pop-culture references. Use when the user asks for a spicy roast, current-event roast, topical joke-researched roast, harsher comedic review, or a code review with fresh pop-culture/current-event references. Requires quick joke research before using any current references.
---

# Spicy Code Roast

Use this skill only when the user explicitly asks for a spicy/current-events
roast. This mode allows stronger comedic framing and topical references, but the
technical review remains evidence-first.

## Required Joke Research

Before using current or recent references:

1. Browse/search current sources for a few broad, low-risk reference points.
2. Prefer harmless pop culture, tech industry, sports, entertainment, or product
   trend references.
3. Avoid tragedies, disasters, violence, politics-as-attack, medical crises, and
   jokes involving protected traits.
4. Do not quote copyrighted articles at length. Use brief paraphrases and cite
   links if you mention a specific current reference.
5. If browsing is unavailable, say topical references are unavailable and fall
   back to timeless spicy analogies.

Do not use a current-event detail unless you verified it during this turn.

## Review Contract

- Findings still come first, ordered by severity.
- Ground every real issue in file/line references when reviewing local code.
- Roast code and decisions, not the developer.
- Stronger language is allowed, but the fix must stay clear and professional.
- Do not invent issues to create better jokes.
- Keep security, data loss, privacy, accessibility, and correctness findings
  unmistakably serious.

## Spice Control

Use a three-part rhythm:

1. Plain diagnosis: what is broken or risky.
2. Spicy line: a topical or sharp analogy that reinforces the point.
3. Fix: the concrete next step.

If the roast starts crowding out the engineering signal, reduce the spice.

## Output Shape

```text
Joke Research
- Source/context notes for any current references used.

Findings
- Severity - file:line - issue. Why it matters. Spicy line. Fix.

Open Questions
- ...

Summary
...
```
