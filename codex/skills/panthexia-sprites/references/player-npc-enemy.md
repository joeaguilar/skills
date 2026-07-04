# Player, NPC, and Enemy Guidance

## Player Classes

Use stable IDs from `src/data/classes.rs::player_battle_sprite_id_for_class`. For MVP and early production, prioritize classes that appear in `Game::start_new_game`: Street Samurai, Netrunner, Tech Medic, Cyber Knight, Shadowrunner, Cyber Mystic, and Chronomancer.

Player silhouettes should face the camera, read at 36x48 base size, and keep the foot/pivot centered. Use class-specific props sparingly: blade, deck, med rig, shield, hood, mystic focus, time glyph.

## NPCs

Use IDs from `src/screens/exploration.rs::npc_world_sprite_id`: `world.npc.generic`, `shopkeeper`, `guard`, `citizen`, and `vendor`. NPCs use the same 36x48 bottom-center contract as world actors. Avoid over-detailing faces; role readability matters more than portrait quality.

## Enemies

Use stable IDs from `src/data/enemies.rs::enemy_battle_sprite_id_for`. Enemies render at 44x52 base size and may be tinted by battle state. Keep shapes distinct even when tinted: drone, thug, phantom, viper, wraith, slime, hound, sentinel, boss mech.

Enemy state variants should preserve anchor and silhouette size. Telegraph/hit/death can be separate frames later, but MVP static sprites must still read when the renderer applies telegraph/hit/death tint.
