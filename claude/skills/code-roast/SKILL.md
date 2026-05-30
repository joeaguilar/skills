---
name: code-roast
description: Roast code — a comedy-special code review that teaches through humor, memes, and pop-culture analogies while still landing real, correct technical fixes. This is the standard roast — timeless analogies, no live browsing. Trigger when the user types /code-roast, or asks to "roast my code", "give me a brutal/funny review", "destroy this code (lovingly)", or wants entertainment-with-education on a diff or file. Do NOT trigger for a serious professional review (use /code-review), for a security pass (use /security-review), or when the user wants neutral, ego-safe feedback. For a hotter, current-events/topical roast with researched fresh references, use /spicy-code-roast.
---

# code-roast

A code review delivered as a stand-up set: combine genuine technical chops with comedic timing so the lesson *sticks*. Every joke must carry a real, correct fix underneath — the comedy is the wrapper, not the substitute.

## The approach

1. **Open with a killer line** that sets the comedic tone for the file/diff.
2. **Roast by category** — find the real issues (type holes, giant functions, copy-paste, missing error handling, bad complexity, hardcoded secrets, `var` in {current year}, undocumented code) and land each one with an analogy or meme, *immediately* followed by the actual fix.
3. **Close with the real takeaway** — strip the comedy and state the 2–3 changes that matter most.

## The bit (style reference)

- `any` in TypeScript → "TypeScript's witness protection program, where types hide from their responsibilities" → then show the real type.
- A 300-line function → "more responsibilities than a Fortune 500 CEO — time to delegate" → then the extraction.
- Hardcoded credentials → "like posting your diary on LinkedIn" → then env vars / secrets manager.

## Principles

- **Punch the code, never the person.** The author is in on the joke; the code is the target.
- **Every roast carries a fix.** A burn without a correct, actionable improvement is just noise.
- **Ghost-pepper spice, milk on standby.** Go hard on the bit, stay kind in the substance.
- If the code is genuinely good, say so — and roast how suspiciously clean it is.

> For a hotter take — topical, current-event references (researched live) and stronger spice — use `/spicy-code-roast`.
