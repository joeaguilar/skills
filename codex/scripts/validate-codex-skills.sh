#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)/skills}"
status=0
CODEX_ROOT="$(cd "$ROOT/.." && pwd -P)"

validate_yaml_frontmatter() {
  local file="$1" rel="$2" tmp err
  tmp="${TMPDIR:-/tmp}/codex-frontmatter.$$"
  err="${TMPDIR:-/tmp}/codex-frontmatter-error.$$"

  awk '
    NR == 1 && $0 == "---" { in_fm = 1; next }
    in_fm && $0 == "---" { exit }
    in_fm { print }
  ' "$file" > "$tmp"

  if command -v ruby >/dev/null 2>&1; then
    if ! ruby -ryaml -e 'YAML.safe_load(STDIN.read)' < "$tmp" >/dev/null 2>"$err"; then
      echo "ERROR: $rel has invalid YAML frontmatter:"
      sed 's/^/  /' "$err"
      status=1
    fi
  elif grep -nE '^[A-Za-z_][A-Za-z0-9_-]*:[[:space:]].*:[[:space:]]' "$tmp" > "$err"; then
    echo "ERROR: $rel has likely invalid YAML frontmatter; quote scalar values containing ': ':"
    sed 's/^/  /' "$err"
    status=1
  fi

  rm -f "$tmp" "$err"
}

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
  else
    validate_yaml_frontmatter "$skill_md" "$rel/SKILL.md"
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

  if [[ "$rel" != .system/* ]] && ! sed -n '2,8p' "$skill_md" | grep -Eq '^description:.*(Use|Trigger|Answer)'; then
    echo "ERROR: $rel/SKILL.md description must state when to use or trigger the skill"
    status=1
  fi

  case "$rel" in
    blitz|bootstrap-project-docs|dual-blitz|gauntlet|itr|overdrive|roadmap|run-the-rivers-dry|shell-prompt|sprint|sprint-review|story-style)
      if ! grep -Eq '^[[:space:]]+allow_implicit_invocation:[[:space:]]+false[[:space:]]*$' "$skill_dir/agents/openai.yaml"; then
        echo "ERROR: $rel must disable implicit invocation because it performs durable or high-autonomy writes"
        status=1
      fi
      ;;
  esac

  if grep -RIn --exclude-dir=.git --exclude='*.bak' -E '\.claude/skills|AskUserQuestion|subagent_type|run_in_background|SendMessage' "$skill_dir" >/tmp/codex-skill-validate.$$ 2>/dev/null; then
    echo "WARN: $rel contains possible non-Codex references:"
    sed 's/^/  /' /tmp/codex-skill-validate.$$
  fi
  rm -f /tmp/codex-skill-validate.$$
done < <(find "$ROOT" -mindepth 2 -maxdepth 4 -name SKILL.md | sort)

REGISTRY_JSON="$CODEX_ROOT/registry/skill-tree.json"
if [ -f "$REGISTRY_JSON" ] && command -v node >/dev/null 2>&1; then
  actual="${TMPDIR:-/tmp}/codex-skill-payloads.$$"
  declared="${TMPDIR:-/tmp}/codex-skill-registry.$$"
  while IFS= read -r skill_md; do
    rel_dir="${skill_md#$ROOT/}"
    rel_dir="${rel_dir%/SKILL.md}"
    printf 'skills/%s\n' "$rel_dir"
  done < <(find "$ROOT" -mindepth 2 -maxdepth 4 -name SKILL.md | sort) | sort > "$actual"
  node -e 'const r=require(process.argv[1]); for (const item of Object.values(r.skills || {})) console.log(item.path)' "$REGISTRY_JSON" | sort > "$declared"

  while IFS= read -r missing; do
    [ -z "$missing" ] && continue
    echo "ERROR: skill payload is missing from registry: $missing"
    status=1
  done < <(comm -23 "$actual" "$declared")
  while IFS= read -r missing; do
    [ -z "$missing" ] && continue
    echo "ERROR: registry skill path has no payload: $missing"
    status=1
  done < <(comm -13 "$actual" "$declared")
  rm -f "$actual" "$declared"
fi

check_markdown_frontmatter() {
  local file="$1" rel="$2" require_name="$3"

  if ! sed -n '1p' "$file" | grep -qx -- '---'; then
    echo "ERROR: $rel is missing YAML frontmatter start"
    status=1
  else
    validate_yaml_frontmatter "$file" "$rel"
  fi

  if [ "$require_name" -eq 1 ] && ! sed -n '2,40p' "$file" | grep -q '^name:'; then
    echo "ERROR: $rel is missing frontmatter name"
    status=1
  fi

  if ! sed -n '2,40p' "$file" | grep -q '^description:'; then
    echo "ERROR: $rel is missing frontmatter description"
    status=1
  fi

  if grep -In --exclude='*.bak' -E '\.claude/skills|AskUserQuestion|subagent_type|run_in_background|SendMessage' "$file" >/tmp/codex-skill-validate.$$ 2>/dev/null; then
    echo "WARN: $rel contains possible non-Codex references:"
    sed 's/^/  /' /tmp/codex-skill-validate.$$
  fi
  rm -f /tmp/codex-skill-validate.$$
}

if [ -d "$CODEX_ROOT/agents" ]; then
  while IFS= read -r agent_md; do
    rel="${agent_md#$CODEX_ROOT/}"
    check_markdown_frontmatter "$agent_md" "$rel" 1
  done < <(find "$CODEX_ROOT/agents" -maxdepth 2 -type f -name '*.md' | sort)
fi

if [ -d "$CODEX_ROOT/commands" ]; then
  while IFS= read -r command_md; do
    rel="${command_md#$CODEX_ROOT/}"
    check_markdown_frontmatter "$command_md" "$rel" 0
  done < <(find "$CODEX_ROOT/commands" -maxdepth 2 -type f -name '*.md' | sort)
fi

if [ "$status" -eq 0 ]; then
  echo "Codex primitive validation passed for $CODEX_ROOT"
fi

if [ -f "$(dirname "${BASH_SOURCE[0]}")/skill-tree.js" ]; then
  "$(dirname "${BASH_SOURCE[0]}")/skill-tree.js" validate
fi

if [ "${CODEX_VALIDATE_INSTALLED:-0}" -eq 1 ] && [ -x "$CODEX_ROOT/scripts/audit-installed-skills.sh" ]; then
  "$CODEX_ROOT/scripts/audit-installed-skills.sh" || status=1
fi

exit "$status"
