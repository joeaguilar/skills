# Props, UI, and VFX Guidance

## World Props And Markers

Use IDs from `ObjectKind::world_sprite_id` and `Tile::world_sprite_id` in `src/systems/world/map.rs`. Props use 36x48 bottom-center; door/chest/POI markers use 32x32 center.

Doors, chests, and POIs still draw marker text from the renderer, so the sprite itself should not include letters. The sprite should supply shape and color only.

## UI Resource Sprites

Use `ui.resource.hp_loss`, `hp_gain`, `mp_spend`, `mp_gain`, `tlp_spend`, and `tlp_gain` for resource delta feedback. Use 32x32 source PNG, 24x24 base draw size, center pivot. Prefer plus/minus, pulse, droplet, and charge shapes without text labels.

## Battle VFX

Use `vfx.hit_spark`, `critical_hit`, `heal_glyph`, `cast_telegraph`, `death_poof`, and `projectile_impact`. Use 32x32 source PNG and center pivot. VFX should be brief, high-contrast, and not obscure HP bars or target cursors for more than a few frames.

## Deterministic MVP Generator

Panthexia currently includes `scripts/generate_mvp_sprites.py` in the repo. Use it as the baseline for deterministic PNGs and manifest structure; replace individual PNGs with imagegen outputs when higher art quality is needed, not by changing stable IDs.
