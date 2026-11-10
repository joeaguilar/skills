#!/usr/bin/env python3
"""Check active discovery, registry parity, and archive boundaries (requires PyYAML)."""
import json
import re
import subprocess
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CODEX = ROOT / "codex"


def normalize(value):
    keys = {"manifest_path": "manifestPath", "manifest_paths": "manifestPaths",
            "primitive_types": "primitiveTypes", "unlocked_by": "unlockedBy"}
    if isinstance(value, dict):
        return {keys.get(key, key): normalize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize(item) for item in value]
    return value


def gitignored(path):
    """True when git ignores the path: an externally sourced payload a clone may lack."""
    try:
        result = subprocess.run(["git", "check-ignore", "-q", "--", path.relative_to(ROOT).as_posix()],
                                cwd=ROOT, capture_output=True)
    except OSError:
        return False
    return result.returncode == 0


def main():
    registry = json.loads((CODEX / "registry/skill-tree.json").read_text(encoding="utf-8"))
    mirror = yaml.safe_load((CODEX / "registry/skill-tree.yaml").read_text(encoding="utf-8"))
    assert normalize(mirror) == registry, "YAML and JSON registry differ"
    items = {**registry["skills"], **registry.get("primitives", {})}
    actual = {p.parent.relative_to(CODEX).as_posix() for p in (CODEX / "skills").rglob("SKILL.md")}
    actual.update(p.relative_to(CODEX).as_posix() for root in ("agents", "commands") for p in (CODEX / root).glob("*.md"))
    declared = {item.get("path") or item["platforms"]["codex"]["path"] for item in items.values()}
    assert actual == declared, f"Active payload/registry mismatch: {actual ^ declared}"

    archived = json.loads((CODEX / "archived/manifest.json").read_text(encoding="utf-8"))["entries"]
    seen = set()
    retired_skills = []
    for entry in archived:
        relative = Path(entry["root"]) / entry["name"]
        assert relative.as_posix() not in seen, f"Duplicate retirement: {relative}"
        seen.add(relative.as_posix())
        assert not (CODEX / relative).exists(), f"Retirement still active: {relative}"
        assert (CODEX / "archived" / relative).exists(), f"Missing archive: {relative}"
        assert entry["replacement"], f"Missing replacement guidance: {relative}"
        if entry["root"] == "skills":
            retired_skills.append(entry["name"])
    assert not any("archived" in Path(p).parts for p in declared), "Archive exposed as active provider"

    for line in (ROOT / "PLATFORM_ONLY.tsv").read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        platform, kind, name = line.split()
        payload = ROOT / platform / kind / name
        if kind == "skills":
            payload /= "SKILL.md"
        assert payload.exists() or gitignored(payload), f"Platform-only entry has no active payload: {line}"

    # A preserved archive must not remain a routing dependency in current instructions.
    for folder in (CODEX / "skills", CODEX / "commands"):
        for file in folder.rglob("*"):
            if not file.is_file() or file.suffix not in (".md", ".yaml") or ".system" in file.parts:
                continue
            text = file.read_text(encoding="utf-8")
            for name in retired_skills:
                assert not re.search(r"\$" + re.escape(name) + r"\b", text), f"Archived invocation in {file}: {name}"
                assert f"../{name}/SKILL.md" not in text, f"Archived dependency in {file}: {name}"
    print(f"Lean fleet valid: {len(registry['skills'])} skills, {len(registry.get('primitives', {}))} other primitives; {len(archived)} retired.")


if __name__ == "__main__":
    main()
