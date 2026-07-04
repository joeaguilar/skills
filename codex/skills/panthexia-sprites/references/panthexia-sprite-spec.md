# Panthexia Sprite Spec

## Runtime Contract

| Family | Source size | Base draw size | Pivot | Notes |
| --- | --- | --- | --- | --- |
| Player battle class | 64x64 PNG | 36x48 | bottom_center | Stable IDs `player.class.*`; starter-party MVP exists. |
| Enemy battle | 64x64 PNG | 44x52 | bottom_center | Stable IDs `enemy.*`; bosses use `enemy.boss.*`. |
| World actor/NPC | 64x64 PNG | 36x48 | bottom_center | `world.actor.player`, `world.npc.*`. |
| World prop/object | 64x64 PNG | 36x48 | bottom_center | `world.object.*`. |
| World marker | 32x32 PNG | 32x32 | center | Door/chest/POI markers. |
| UI resource sprite | 32x32 PNG | 24x24 | center | HP/MP/TLP delta feedback. |
| Battle VFX | 32x32 PNG | 32x32 | center | Hit, heal, cast, poof, impact glyphs. |

## Output Paths

Runtime files live under `web/assets/sprites/` and are listed in `web/assets/sprites/manifest.json`.

```text
web/assets/sprites/player/class/<class>.png
web/assets/sprites/enemy/<enemy>.png
web/assets/sprites/enemy/boss/<boss>.png
web/assets/sprites/world/npc/<role>.png
web/assets/sprites/world/object/<object>.png
web/assets/sprites/world/tile/<marker>.png
web/assets/sprites/world/poi/<kind>.png
web/assets/sprites/ui/resource/<event>.png
web/assets/sprites/vfx/<effect>.png
```

## Manifest Entry

```json
{
  "id": "player.class.street_samurai",
  "file": "player/class/street_samurai.png",
  "source_w_px": 64,
  "source_h_px": 64,
  "base_w": 36.0,
  "base_h": 48.0,
  "pivot": "bottom_center",
  "family": "player",
  "tags": ["mvp"]
}
```

Manifest file paths are relative to `web/assets/sprites/`; do not include `..`, absolute paths, backslashes, generated URLs, or user-provided path fragments.

## Prompt Pattern

```text
Use case: Panthexia runtime sprite
Sprite ID: <stable registry id>
Family/use: <player class | enemy | NPC | prop | UI resource | VFX>
Dimensions: <exact source px>, transparent PNG
Draw contract: base size <w>x<h>, pivot <pivot>
Style: cyberpunk x fantasy HD-2D, crisp modern 16-bit pixel-art silhouette
Palette: neon cyan/magenta/yellow/green accents over dark ink shadows
Composition: centered full subject, generous padding, readable at in-game scale
States/frames: <idle / telegraph / hit / death / gain / spend / etc.>
Constraints: no text, no watermark, no photorealism, no blurry edges
Avoid: side-facing iso floor tiles, environment textures, cast shadows outside alpha
```

For chroma-key intermediates, use a flat `#00ff00` background and remove it before adding the PNG to the manifest.

## Validation

Run from the Panthexia repo root:

```bash
python3 /Users/josefaguilar/AI_Projects/skills/codex/skills/panthexia-sprites/scripts/validate_sprite_manifest.py web/assets/sprites/manifest.json
```

Check: manifest JSON parses, IDs are unique, file paths are safe, PNG dimensions match, every file has alpha-capable RGBA or truecolor+alpha encoding, and MVP IDs are present when validating the main repo manifest.

## Visual Gate Template

```text
Visual gate:
  LOOK AT:    <screen/map/battle route and exact sprite IDs>
  IGNORE:     <known-deferred adjacent art/code issues + ticket numbers>
  EXPECTED:   sprites render at stable anchors, alpha is clean, silhouette is readable, no fallback appears for MVP IDs
  CONFOUNDERS: CRT/bloom/tint/fade effects may color small sprites; judge geometry and readability with current effects enabled
```
