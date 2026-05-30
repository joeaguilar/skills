# Panthexia Material Spec

## Current Projection Contract

Use current source as authority. As of Epic #226 work:

| Value | Contract |
| --- | --- |
| World tile size | `32x32` flat-grid pixels (`TILE_SIZE = 32`) |
| Default pitch | `0.5` |
| Projected floor footprint | `32x16` at default pitch |
| Projection style | Front-projected orthographic / dead-on HD-2D |
| Wall style | Flat-front rectangles; no left/right side faces |

Wall quads currently use `iso_diamond_verts_with_height(tx, ty, height, cam)`. At default pitch, visible wall texture sizes are:

| Cell height | Default projected wall rect |
| --- | --- |
| 1 | `32x48` |
| 2 | `32x80` |
| 3 | `32x112` |
| 4 | `32x144` |

Prefer authoring 2x or 4x source sizes when useful, but keep the same aspect ratio and include the intended downscale target in the asset note.

## Suggested Output Paths

Use these paths once a Panthexia texture-loading path exists:

```text
web/assets/textures/env/floor/<material>_<variant>_<w>x<h>.png
web/assets/textures/env/wall/<material>_<variant>_<w>x<h>.png
web/assets/textures/env/water/<material>_fNN_<w>x<h>.png
web/assets/textures/env/sky/<layer>_<variant>_<w>x<h>.png
web/assets/textures/env/previews/<material>_<variant>_repeat3x3.png
```

Until integration exists, keep drafts in a temporary or artifact folder and record the intended final path.

## Material Families

| Family | Use | Notes |
| --- | --- | --- |
| `floor_metal` | hubs, shops, labs | Subtle cyberpunk panels; seams must not create a checkerboard. |
| `floor_stone` | dungeons, shrines | Fantasy masonry with neon/circuit accents. |
| `floor_road` | world safe corridors | Lower contrast than POIs; readable path direction. |
| `floor_grass` / `floor_forest` | wilderness | Forest should read denser than grass but not hide sprites. |
| `wall_metal` | hub/shop buildings | Flat-front panels, signage glow allowed, no side faces. |
| `wall_rock` | dungeon/mountain | Vertical face texture; avoid fake angled side planes. |
| `water_neon` | hub water feature | 4 or 8 loopable frames; bright highlights must not dominate doors/POIs. |
| `sky_city` / `sky_wilds` | mockups/parallax | Use as backdrop only; avoid text and characters. |

## Prompt Pattern

Use this structure for bitmap generation:

```text
Use case: Panthexia environment material
Asset type: seamless <floor tile | flat-front wall texture | water animation frame | sky parallax layer>
Primary request: <material and use location>
Dimensions: <exact pixel size>
Projection: front-projected orthographic HD-2D, dead-on camera, no dimetric side faces
Style: cyberpunk x fantasy, modern 16-bit/HD-2D material art, crisp game texture
Palette: <hex accents or named Panthexia colors>
Seam constraints: loopable left/right and top/bottom edges; no visible border unless it is a designed tile grid
Constraints: no text, no watermark, no characters, no photorealism, no blurry stock texture
Avoid: <material-specific risks>
```

For water frames, add:

```text
Animation: frame <N> of <M>, subtle coherent ripple shift, same camera and lighting as all frames, identical edges across the loop.
```

For sky/parallax, replace seam constraints with:

```text
Parallax constraints: loopable left/right edge, gameplay-safe contrast, foreground characters must remain readable.
```

## Validation Checklist

- Dimensions match the stated contract.
- Floors and water have a 3x3 or 5x5 repeat preview with no obvious seams.
- Wall textures read as a single flat front face, not a skewed box.
- Water frames are equal size and visually loopable.
- Sky/parallax layers do not contain text, characters, or gameplay-critical contrast conflicts.
- Asset note names final/intended path, dimensions, material family, prompt summary, and verification mode.

## Visual Gate Template

Use this shape in Panthexia tickets that ship visible material work:

```text
Visual gate:
  LOOK AT:    <specific map/screen/material and where it appears>
  IGNORE:     <known-deferred adjacent visual issues + ticket numbers>
  EXPECTED:   <seams, projection fit, style, contrast, and loop behavior>
  CONFOUNDERS: <adjacent rendering/camera/cache issues out of scope>
```

Close notes must say one of: `Verified visually`, `Verified via tests only`, or `Partial`.
