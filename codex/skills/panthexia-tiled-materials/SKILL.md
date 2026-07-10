---
name: panthexia-tiled-materials
description: "Use for Panthexia floor, wall, water, sky, and parallax environment materials that need projection-aware dimensions, seamless repeats, palettes, repeat previews, or visual gates. Do not use for characters, enemies, props, items, UI icons, or battle VFX sprites."
---

# Panthexia Tiled Materials

## Overview

Use this skill to produce Panthexia environment materials that match the front-projected orthographic iso direction from Epic #226. It specializes the broader `$retro-game-assets` workflow around tile seams, projection dimensions, flat-front walls, water loops, sky/parallax layers, and Panthexia visual gates.

## Boundaries

Use this skill for:

- Floor/ground materials: stone, road, grass, forest, metal, dungeon floor, shop floor, shrine floor.
- Flat-front wall materials: cyberpunk masonry, neon metal panels, dungeon rock, shop counter fronts, mountain/ridge faces.
- Water materials: seamless water tiles and loopable frame sets.
- Sky/parallax backgrounds: mood layers for mockups or future scene backdrops, not map collision tiles.
- Material palettes, naming plans, prompt batches, seam-preview checks, and #226 visual-gate notes.

Do not use this skill for character or object sprite pipelines. Split those later if they become repeated work:

- `panthexia-character-sprites`: player, NPC, enemy/mob bodies, world/battle sheets, anchors, animation frames.
- `panthexia-prop-objects`: barrels, crates, signs, terminals, debris, doors/chests as object sprites.
- `panthexia-battle-vfx`: particles, projectiles, hit flashes, status-effect sprites.
- `panthexia-ui-assets`: HUD icons, menus, badges, title/logo polish.

Keep floor, wall, water, and sky together for now because their shared risk is environment art direction, tileability, projection fit, and visual validation against the same iso scene.

## Workflow

1. Inspect the current Panthexia context before authoring assets.
   - Read `itr get 226` and `docs/IN_PROGRESS.md` when working inside the Panthexia repo.
   - Prefer current source over stale docs: check `src/render/iso.rs`, `src/render/floor_rt.rs`, `src/render/sort.rs`, and `src/systems/world/map.rs`.
   - Confirm the active base projection before using dimensions: current baseline is `TILE_SIZE = 32`, default `pitch_factor = 0.5`, so a floor tile projects to `32x16`.

2. Write a compact material brief.
   - Include: target material, tile type, map/use location, dimensions, output format, palette, loop/variant count, integration path, and avoid list.
   - If the request is vague, infer a cyberpunk x fantasy HD-2D direction and ask only when the missing choice changes the asset contract.

3. Choose the asset contract.
   - Floors: seamless projected rectangles, usually `32x16`, `64x32`, or `128x64` source PNG/WebP.
   - Walls: flat-front dead-on textures only; no left/right side faces, dimetric skew, or 2:1 diamond wall caps unless explicitly requested for a mockup.
   - Water: same projected footprint as floors, with all frames identical size and loop-safe on all four edges.
   - Sky: viewport or parallax layer assets; do not treat sky as a repeating collision/map tile.

4. Generate or author the asset.
   - Use deterministic SVG/code-native output only for simple masks, overlays, or guides.
   - Use `$imagegen` for bitmap material concepts, textured tiles, water frames, and sky/parallax art.
   - Prompt for exact dimensions, seamless edges when needed, no watermark, no unintended text, no characters unless the user explicitly asks.

5. Validate before integrating.
   - Check dimensions, alpha/background behavior, style consistency, and absence of text/watermarks.
   - Make or inspect a 3x3 or 5x5 repeat preview for every seamless tile or water frame.
   - When assets are integrated into Panthexia, run the game and record the required visual-gate verification mode from `AGENTS.md`.

6. Leave an asset note.
   - Record output paths, dimensions, intended tile/use, prompt summary, validation performed, and any deferred follow-up ticket numbers.

## Reference

Read `references/panthexia-material-spec.md` for concrete size tables, naming conventions, prompt patterns, and visual-gate templates.
