---
name: panthexia-sprites
description: "Use for Panthexia player, NPC, enemy, prop, item, UI, marker, or battle-VFX sprite production and integration, including transparent PNGs, sheets, manifest IDs, contact sheets, and visual gates. Do not use for floor, wall, water, sky, or other repeating environment materials."
---

# Panthexia Sprites

## Overview

Use this skill to produce sprite assets that fit Panthexia's cyberpunk x fantasy HD-2D direction and the Rust/Macroquad runtime sprite manifest. It covers character, enemy, NPC, prop, UI, and battle VFX sprites; environment materials remain in `$panthexia-tiled-materials`.

## Workflow

1. Inspect the current Panthexia context before authoring assets.
   - Check `web/assets/sprites/manifest.json`, `docs/rendering.md`, and the relevant stable ID source (`src/data/classes.rs`, `src/data/enemies.rs`, `src/systems/world/map.rs`, or `src/screens/exploration.rs`).
   - Confirm the consuming base draw size and pivot; current common contracts are 36x48 bottom-center for player/world actors, 44x52 bottom-center for battle enemies, 36x48 bottom-center for props, and 32x32 center for markers/VFX.

2. Write a compact sprite brief.
   - Include: sprite ID, family, use screen, dimensions, pivot, output path, states/frames, palette, transparency requirements, and avoid list.
   - Prefer stable registry IDs over filename-derived identity.

3. Choose the production path.
   - Use `$imagegen` for character/enemy/NPC/prop concepts and transparent bitmap sprites.
   - Use deterministic SVG or code-native generation for simple UI resource icons, VFX glyphs, and validation mockups.
   - Use `scripts/validate_sprite_manifest.py` after adding files or manifest entries.

4. Generate game-ready sprites.
   - Output transparent PNG by default; use chroma key only as an intermediate if needed.
   - Keep crisp silhouettes, generous padding, no text/watermark, no photorealism, and no subject color matching the chroma background.
   - Preserve anchor proportions across states: idle, telegraph/cast, hit, death, gain/spend, disabled/active.

5. Integrate and validate.
   - Add or update the manifest entry with source dimensions, base draw size, pivot, family, and tags.
   - Verify dimensions, alpha, manifest ID, fallback behavior, and in-game readability at FullHd1080 and Sd540 where relevant.
   - For visual tickets, include the Panthexia Visual Gate block and one close-note verification mode.

6. Leave an asset note for multi-asset batches.
   - Record output paths, sprite IDs, dimensions, prompt summary or generator script, validation performed, and deferred follow-up ticket numbers.

## References

- Read `references/panthexia-sprite-spec.md` for naming, dimensions, manifest fields, output paths, prompt pattern, and visual-gate template.
- Read `references/player-npc-enemy.md` for player, NPC, and enemy family guidance.
- Read `references/props-ui-vfx.md` for world props, UI resource sprites, and battle VFX guidance.
