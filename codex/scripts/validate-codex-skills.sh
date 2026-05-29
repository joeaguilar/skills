#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)/skills}"
status=0

if [ ! -d "$ROOT" ]; then
  echo "Missing skills directory: $ROOT" >&2
  exit 1
fi

while IFS= read -r skill_md; do
  skill_dir="$(dirname "$skill_md")"
  rel="${skill_dir#$ROOT/}"

  if ! sed -n '1p' "$skill_md" | grep -qx -- '---'; then
    echo "ERROR: $rel/SKILL.md is missing YAML frontmatter start"
    status=1
  fi

  if ! sed -n '2,40p' "$skill_md" | grep -q '^name:'; then
    echo "ERROR: $rel/SKILL.md is missing frontmatter name"
    status=1
  fi

  if ! sed -n '2,40p' "$skill_md" | grep -q '^description:'; then
    echo "ERROR: $rel/SKILL.md is missing frontmatter description"
    status=1
  fi

  if [[ "$rel" != .system/* ]] && [ ! -f "$skill_dir/agents/openai.yaml" ]; then
    echo "ERROR: $rel is missing agents/openai.yaml"
    status=1
  fi

  if grep -RIn --exclude-dir=.git --exclude='*.bak' -E '\.claude/skills|AskUserQuestion|subagent_type|run_in_background|SendMessage' "$skill_dir" >/tmp/codex-skill-validate.$$ 2>/dev/null; then
    echo "WARN: $rel contains possible non-Codex references:"
    sed 's/^/  /' /tmp/codex-skill-validate.$$
  fi
  rm -f /tmp/codex-skill-validate.$$
done < <(find "$ROOT" -mindepth 2 -maxdepth 4 -name SKILL.md | sort)

if [ "$status" -eq 0 ]; then
  echo "Codex skill validation passed for $ROOT"
fi

exit "$status"
