#!/usr/bin/env python3
"""Read-only stable SemVer proposal from reachable tags and Conventional Commits."""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

VERSION = re.compile(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", re.ASCII)
SUBJECT = re.compile(r"^([a-z]+)(?:\([^\r\n()]+\))?(!)?:[ \t]+\S")
BREAKING = re.compile(r"^BREAKING[ -]CHANGE:[ \t]*\S", re.MULTILINE)


def git(repo, *args):
    result = subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True, text=True,
        encoding="utf-8", errors="replace", check=False,
    )
    if result.returncode:
        raise ValueError(result.stderr.strip() or "git command failed")
    return result.stdout.strip()


def parse_version(value):
    if not VERSION.fullmatch(value):
        raise ValueError(f"Expected stable X.Y.Z version, got {value!r}")
    return tuple(map(int, value.split(".")))


def classify(message):
    subject = message.splitlines()[0] if message else ""
    match = SUBJECT.match(subject)
    if BREAKING.search(message) or (match and match.group(2)):
        return "major"
    if match and match.group(1) == "feat":
        return "minor"
    if match and match.group(1) in {"fix", "perf"}:
        return "patch"
    return "none"


def plan(repo, base=None, initial_version="0.0.0"):
    initial = parse_version(initial_version)
    head = git(repo, "rev-parse", "--verify", "HEAD^{commit}")
    if git(repo, "rev-parse", "--is-shallow-repository") == "true":
        raise ValueError("Shallow history cannot establish the release range; fetch full history first.")
    tags = git(repo, "tag", "--merged", "HEAD").splitlines()
    stable = {tag: parse_version(tag[1:]) for tag in tags
              if tag.startswith("v") and VERSION.fullmatch(tag[1:])}
    if base is not None:
        if base not in stable:
            raise ValueError("--base must name a stable vX.Y.Z tag reachable from HEAD")
    else:
        if any(re.match(r"^v\d+\.\d+\.\d+[-+]", tag) for tag in tags):
            raise ValueError("Prerelease/build-metadata tags need project release tooling or an explicit stable --base.")
        base = max(stable, key=stable.get) if stable else None
    current = stable[base] if base else initial
    # Resolve the tag to an object ID; never let user-supplied ref text become options.
    base_commit = git(repo, "rev-parse", "--verify", f"refs/tags/{base}^{{commit}}") if base else None
    revision = f"{base_commit}..{head}" if base_commit else head
    raw = git(repo, "log", revision, "--format=%B%x00")
    messages = [message.strip() for message in raw.split("\0") if message.strip()]
    ranks = {"none": 0, "patch": 1, "minor": 2, "major": 3}
    bump = max((classify(message) for message in messages), key=ranks.get, default="none")
    major, minor, patch = current
    if bump == "major":
        next_parts = major + 1, 0, 0
    elif bump == "minor":
        next_parts = major, minor + 1, 0
    elif bump == "patch":
        next_parts = major, minor, patch + 1
    else:
        next_parts = None
    version = ".".join(map(str, next_parts)) if next_parts else None
    return {
        "head": head, "base_tag": base, "base_commit": base_commit,
        "base_version": ".".join(map(str, current)), "commits": len(messages),
        "bump": bump, "next_version": version,
        "next_tag": f"v{version}" if version else None,
        "ignored_tags": sorted(set(tags) - set(stable)),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--base", help="Reachable stable vX.Y.Z tag")
    parser.add_argument("--initial-version", default="0.0.0")
    args = parser.parse_args()
    try:
        result = plan(args.repo, args.base, args.initial_version)
    except (OSError, ValueError) as exc:
        print(f"Version planning failed: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
