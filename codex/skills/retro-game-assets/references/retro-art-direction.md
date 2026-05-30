# Retro Art Direction Reference

## Art Direction Brief

Use this brief shape when a request is vague or spans multiple assets:

```text
Game/context:
Asset list:
Use location:
Output format: SVG | PNG | WebP | spritesheet | mixed
Dimensions:
Style era:
Theme:
Palette:
Animation or states:
Transparency/background:
Integration path:
Avoid:
```

## Style Recipes

**Vector arcade, 1978-1983**
- Best for: space shooters, asteroids, circuit boards, score overlays, cabinet marquees.
- Look: black voids, neon line art, sparse geometry, cyan/magenta/amber strokes, optional soft glow.
- Prefer SVG. Use simple paths, strokes, and restrained filters.
- Avoid: filled cartoon shapes, noisy textures, realistic lighting.

**8-bit arcade or console, 1983-1987**
- Best for: character sprites, pickups, hazards, small enemies, tiles.
- Look: strong silhouette, chunky pixels, 16x16 or 32x32 sprites, 2-4 color ramps per object, hard edges.
- Prefer hand-authored SVG with pixel blocks, canvas drawing, or small raster sprites.
- Avoid: anti-aliased edges, tiny gradients, too many colors, unreadable shapes at 1x.

**16-bit console, 1988-1994**
- Best for: richer characters, title screens, parallax backgrounds, boss art.
- Look: 32x32, 48x48, or 64x64 sprites, hue-shifted shadows, bolder highlights, layered backgrounds.
- Bitmap generation can help for concept art and backgrounds; simplify if gameplay sprites need exact readability.
- Avoid: photorealism, modern flat UI, indistinct low-contrast palettes.

**Neon cabinet or pinball**
- Best for: menus, attract screens, powerups, score celebrations.
- Look: chrome edges, lit signage, saturated accent colors, starbursts, lens-like highlights.
- SVG works well for signage and UI chrome; bitmap works well for title/key art.
- Avoid: bloom that hides text, dark-only palettes, excessive decorative clutter.

**CRT overlay**
- Best for: optional screen polish, pause menus, title cards.
- Look: subtle scanlines, shadow mask, mild barrel feel, phosphor tint, vignette only at edges.
- Keep effects optional or lightweight so gameplay stays clear.
- Avoid: strong blur, heavy flicker, high-opacity lines over small text.

**Handheld LCD**
- Best for: minimalist puzzle games, score widgets, monochrome modes.
- Look: olive/gray background, dark segmented shapes, low frame count animation, no glow.
- SVG or CSS is usually enough.
- Avoid: full-color sprites, smooth gradients, photographic materials.

## Palette Starters

Adapt these; do not force every game into one palette.

**Arcade phosphor**
- `#07080c` deep black
- `#00e5ff` cyan
- `#ff3df2` magenta
- `#ffe45e` amber
- `#ff6b35` orange
- `#f5f7fa` highlight

**8-bit candy**
- `#141414` near black
- `#1b1f3a` navy shadow
- `#2de2e6` cyan
- `#f706cf` pink
- `#fee440` yellow
- `#ffffff` white

**16-bit adventure**
- `#13293d` ink blue
- `#006d77` teal
- `#83c5be` mint
- `#ffddd2` pale peach
- `#e29578` coral
- `#f4f1de` cream highlight

**LCD handheld**
- `#9aa66a` screen green
- `#69704b` mid tone
- `#25291c` dark segment
- `#d7deb0` highlight

## Asset Specs

**Sprites**
- Common sizes: 16x16, 24x24, 32x32, 48x48, 64x64.
- Include pivot/anchor expectations when movement or collision matters.
- Keep silhouettes readable at the smallest gameplay scale.
- For states, preserve proportions across frames: idle, move, hit, death, powered, disabled.

**Tiles**
- Common sizes: 8x8, 16x16, 24x24, 32x32.
- Confirm seamless edges for repeating tiles.
- Separate collision tiles from decorative overlays when the codebase supports it.
- Build variations: flat, corner, edge, damaged, highlight, shadow.

**Backgrounds**
- Prefer layered parallax when a game scrolls: sky/far/mid/near/foreground.
- Keep gameplay lanes lower contrast than hazards and collectibles.
- Export exact viewport or repeatable layer dimensions.

**HUD and UI**
- Prioritize scan speed over decoration.
- Use icon-only controls where established, with accessible labels in the consuming UI.
- Confirm legibility at mobile sizes and on CRT/scanline overlays.

**Particles and effects**
- Use small additive-looking bursts, sparks, rings, trails, hit flashes, and pickup glints.
- Keep alpha edges clean.
- Avoid effects that obscure hitboxes for more than a few frames.

## SVG Rules

- Include `xmlns`, a stable `viewBox`, explicit width/height when the consuming app expects fixed dimensions, and a short `<title>` when useful.
- Prefer integer coordinates, crisp rectangles, simple polygons, and path reuse.
- Use CSS variables or `currentColor` only when the app already styles SVGs that way.
- Keep filters modest. If using glow, put it behind the gameplay-critical shape.
- Do not embed base64 images unless the user explicitly wants a self-contained SVG.
- Do not use remote fonts, remote images, scripts, or event handlers.

## Bitmap Prompt Patterns

When using `$imagegen`, shape prompts like this:

```text
Use case: stylized-concept
Asset type: <sprite/background/HUD/title art/etc. for a retro browser game>
Primary request: <subject and purpose>
Scene/backdrop: <only if not transparent>
Subject: <main subject>
Style/medium: <8-bit pixel art | 16-bit pixel art | neon vector arcade | CRT cabinet art>
Composition/framing: <centered, full body, generous padding, exact aspect>
Color palette: <palette name or hex accents>
Constraints: game-ready, readable at <size>, no watermark, no unintended text
Avoid: photorealism, blurry edges, modern mobile-game gloss unless requested
```

For transparent sprite-style assets, add the `$imagegen` chroma-key instructions:

```text
Create the subject on a perfectly flat solid #00ff00 chroma-key background for background removal.
The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Keep the subject fully separated from the background with crisp edges and generous padding.
Do not use #00ff00 anywhere in the subject.
No cast shadow, no contact shadow, no reflection, no watermark, and no text unless explicitly requested.
```

For parallax backgrounds:

```text
Asset type: seamless parallax background layer
Primary request: <environment and mood>
Style/medium: 16-bit console pixel art
Composition/framing: horizontal layer, loopable left and right edges, gameplay-safe contrast
Constraints: no text, no characters unless requested, clear foreground separation
```

## Validation Checklist

- Asset names are descriptive, versioned when replacing, and placed in the expected project folder.
- Dimensions, aspect ratio, and transparent/opaque background match the consuming code.
- SVGs parse cleanly and do not include scripts, remote references, hidden junk, or huge unnecessary paths.
- Bitmaps have the expected alpha behavior and no unintended text, watermark, odd hands/faces, or style drift.
- Pixel assets are crisp at 1x and upscale using nearest-neighbor/pixelated rendering.
- The final game screen still reads clearly: player, enemies, hazards, pickups, score, and controls are visually distinct.
