---
name: retro-game-assets
description: "Retro game art assets: SVG/bitmap sprites, tiles, backgrounds, HUD, logos, CRT overlays, 8-bit/16-bit/pixel/neon style."
---

# Retro Game Assets

## Overview

Use this skill to turn a retro game feature, screen, or theme into production-ready art assets. Favor deterministic SVG/code-native output for vector UI, scalable symbols, overlays, and simple shapes; invoke `$imagegen` for bitmap illustrations, textured backgrounds, transparent sprite cutouts, thumbnails, and concept art.

## Workflow

1. Inspect the game context before drawing.
   - Identify the game genre, canvas or layout dimensions, existing asset folders, naming conventions, import style, palette, and rendering stack.
   - Prefer `rg --files` and a quick scan of existing assets/CSS/canvas code before creating new files.

2. Create a short art direction brief.
   - Capture: target asset(s), use location, dimensions, era/style, theme, palette, animation/state needs, transparent/background requirements, and avoid list.
   - If details are missing, infer from the game. Ask only when the choice would materially change implementation, such as 8-bit vs 16-bit or SVG vs raster.

3. Choose the asset path.
   - **SVG/direct code:** icons, HUD symbols, logos, badges, vector enemies/items, CRT masks, frame art, cabinet decals, simple particles, and scalable UI.
   - **Bitmap via `$imagegen`:** painted or pixel-styled backgrounds, title art, textured props, character concepts, transparent sprite cutouts, social thumbnails, cards, and any raster asset the user explicitly requests.
   - **Hybrid:** use `$imagegen` for a concept, then simplify into SVG or a limited-palette sprite when the game needs crisp deterministic output.

4. Build game-ready specs before producing assets.
   - Use exact dimensions and scale factors. Prefer integer coordinates for SVG and power-of-two or tile-aligned bitmap sizes when useful.
   - Define variants up front: idle/run/hit/explode states, disabled/active UI states, light/dark backdrops, mobile/desktop crops, or parallax layers.
   - Use non-destructive filenames. Do not overwrite existing assets unless the user explicitly asks.

5. Produce SVG assets directly.
   - Use a stable `viewBox`, integer-aligned geometry, grouped layers with useful ids, and no external references.
   - Keep filters lightweight; glow and CRT effects should not make gameplay text or hit targets hard to read.
   - Optimize for runtime use: avoid huge path counts, embedded raster data, hidden off-canvas junk, and layout-shifting dimensions.

6. Produce bitmap assets through `$imagegen` when possible.
   - Load and follow the `$imagegen` skill for generation/editing, save-path handling, transparency, and validation.
   - Prompt with the exact asset role, dimensions/aspect, era, palette, subject, backdrop, and constraints.
   - For transparent sprites or props, use `$imagegen`'s built-in-first chroma-key workflow unless true/native transparency is explicitly required or the subject is too complex.
   - Move project-bound outputs into the repo and update consuming code. Never leave referenced assets only under `$CODEX_HOME/generated_images`.

7. Validate in context.
   - Inspect SVGs as XML and, when useful, render them in the app or browser.
   - Inspect bitmaps for dimensions, alpha, crispness, readability, and unwanted text/watermarks.
   - Verify integrated assets in the actual game viewport, including small mobile sizes and high-DPI scaling. Use `image-rendering: pixelated` only when the asset is meant to stay pixel-crisp.

8. Leave a compact asset note when useful.
   - For multi-asset batches, record each output path, intended use, dimensions, and any `$imagegen` prompt that matters for future variants.

## Reference

Read `references/retro-art-direction.md` when the request involves a new visual style, multiple assets, spritesheet planning, palette selection, or detailed bitmap prompts.
