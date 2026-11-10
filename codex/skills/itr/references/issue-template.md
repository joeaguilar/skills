# Minimal issue conventions

Follow project examples when available. Otherwise use:

- **Title:** one observable change, phrased as an imperative.
- **Context:** failing scenario or user need, with relevant evidence.
- **Acceptance:** observable outcomes and relevant failure cases. For deferred
  investigation, state the question and evidence needed without inventing a fix.
- **Files/dependencies:** known paths and real prerequisites; mark new paths as
  proposed. Omit unknown or irrelevant fields.

Example: **Preserve the selected filter after reload.** Reload currently resets
the saved filter. Acceptance: selecting, reloading, and navigating back restores
the selection and matching results; invalid saved values use the existing
default. Verify through the real save and restore paths.

Create or update `STORY_STYLE.md` only when requested. A short example plus
necessary naming/tag conventions is enough; no mandatory taxonomy or wizard.
