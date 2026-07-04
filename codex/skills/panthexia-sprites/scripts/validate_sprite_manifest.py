#!/usr/bin/env python3
"""Validate a Panthexia sprite manifest and referenced PNG dimensions."""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

MVP_REQUIRED = {
    "player.class.street_samurai",
    "player.class.netrunner",
    "player.class.tech_medic",
    "player.class.cyber_knight",
    "player.class.shadowrunner",
    "player.class.cyber_mystic",
    "player.class.chronomancer",
    "enemy.corrupted_drone",
    "enemy.street_thug",
    "enemy.glitch_sprite",
    "enemy.data_phantom",
    "enemy.neon_viper",
    "enemy.cyber_wraith",
    "enemy.plasma_slime",
    "enemy.virtual_hound",
    "enemy.shock_sentinel",
    "enemy.boss.overlord_mech",
    "world.actor.player",
    "world.npc.generic",
    "world.npc.shopkeeper",
    "world.npc.guard",
    "world.npc.citizen",
    "world.npc.vendor",
    "world.tile.door",
    "world.tile.chest",
    "world.poi.town",
    "world.poi.dungeon",
    "world.poi.boss_lair",
    "world.object.barrel",
    "world.object.crate",
    "world.object.lamp_post",
    "world.object.sign",
    "world.object.terminal",
    "world.object.debris",
    "world.object.neon_sign",
    "ui.resource.hp_loss",
    "ui.resource.hp_gain",
    "ui.resource.mp_spend",
    "ui.resource.mp_gain",
    "ui.resource.tlp_spend",
    "ui.resource.tlp_gain",
    "vfx.hit_spark",
    "vfx.critical_hit",
    "vfx.heal_glyph",
    "vfx.cast_telegraph",
    "vfx.death_poof",
    "vfx.projectile_impact",
}


def png_size(path: Path) -> tuple[int, int, int]:
    data = path.read_bytes()
    png_sig = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    if len(data) < 33 or not data.startswith(png_sig):
        raise ValueError("not a PNG")
    if data[12:16] != b"IHDR":
        raise ValueError("missing IHDR")
    width, height, bit_depth, color_type = struct.unpack(">IIBB", data[16:26])
    return width, height, color_type


def safe_file(value: str) -> bool:
    parts = value.split("/")
    has_backslash = chr(92) in value
    starts_unsafe = value.startswith("/") or value.startswith(chr(92))
    return bool(value) and not starts_unsafe and not has_backslash and all(p not in {"", ".", ".."} for p in parts)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: validate_sprite_manifest.py web/assets/sprites/manifest.json", file=sys.stderr)
        return 2
    manifest_path = Path(sys.argv[1])
    root = manifest_path.parent
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    errors: list[str] = []
    ids: set[str] = set()
    for index, entry in enumerate(manifest.get("sprites", [])):
        sid = entry.get("id", "")
        file = entry.get("file", "")
        if not sid:
            errors.append(f"entry {index}: missing id")
        if sid in ids:
            errors.append(f"duplicate id: {sid}")
        ids.add(sid)
        if not safe_file(file):
            errors.append(f"{sid}: unsafe file path {file!r}")
            continue
        path = root / file
        if not path.exists():
            errors.append(f"{sid}: missing file {path}")
            continue
        try:
            width, height, color_type = png_size(path)
        except ValueError as exc:
            errors.append(f"{sid}: {exc}")
            continue
        if width != entry.get("source_w_px") or height != entry.get("source_h_px"):
            errors.append(f"{sid}: PNG is {width}x{height}, manifest says {entry.get('source_w_px')}x{entry.get('source_h_px')}")
        if color_type != 6:
            errors.append(f"{sid}: PNG color type {color_type}, expected RGBA color type 6")
    missing = sorted(MVP_REQUIRED - ids)
    if missing:
        errors.append("missing MVP IDs: " + ", ".join(missing))
    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        return 1
    print(f"OK: {len(ids)} sprite entries validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
