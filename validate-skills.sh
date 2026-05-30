#!/usr/bin/env bash
set -uo pipefail

# Parity / drift validator across the two skill trees.
# Codex ports are INTENTIONALLY reworded, so this does NOT compare content.
# It checks:
#   1. Set parity   — every skill in claude/skills has a sibling in codex/skills
#                     (and vice-versa), ignoring codex-only .system/.
#   2. Staleness    — compares each claude SKILL.md's git blob hash against the
#                     baseline recorded in codex/PARITY.tsv (the claude content
#                     the codex port was last reconciled against). A change ->
#                     the port is probably stale -> re-port. Rename-proof.
#   3. Frontmatter  — every SKILL.md has `name:` and `description:`.
# Then it calls codex/scripts/validate-codex-skills.sh for the codex tree's
# deeper checks (agents/openai.yaml presence, Claude-ism lint).

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
CLAUDE_SKILLS="$REPO_DIR/claude/skills"
CODEX_SKILLS="$REPO_DIR/codex/skills"
errors=0
warns=0

list_skills() { # tree -> skill dir names that contain a SKILL.md, excluding .system
  [ -d "$1" ] || return 0
  for d in "$1"/*/; do
    name="$(basename "$d")"
    [ "$name" = ".system" ] && continue
    [ -f "$d/SKILL.md" ] && echo "$name"
  done | sort
}

echo "== 1. Set parity (claude/skills <-> codex/skills, .system excluded) =="
claude_list="$(list_skills "$CLAUDE_SKILLS")"
codex_list="$(list_skills "$CODEX_SKILLS")"

only_claude="$(comm -23 <(printf '%s\n' "$claude_list") <(printf '%s\n' "$codex_list"))"
only_codex="$(comm -13 <(printf '%s\n' "$claude_list") <(printf '%s\n' "$codex_list"))"
shared="$(comm -12 <(printf '%s\n' "$claude_list") <(printf '%s\n' "$codex_list"))"

if [ -n "$only_claude" ]; then
  while IFS= read -r s; do
    [ -n "$s" ] && { echo "  ERROR: '$s' has no codex port (claude-only) -> port it into codex/skills/$s"; errors=$((errors+1)); }
  done <<< "$only_claude"
fi
if [ -n "$only_codex" ]; then
  while IFS= read -r s; do
    [ -n "$s" ] && { echo "  ERROR: '$s' has no claude source (codex-only) -> add claude/skills/$s or remove the port"; errors=$((errors+1)); }
  done <<< "$only_codex"
fi
[ -z "$only_claude$only_codex" ] && echo "  OK: both trees expose the same $(printf '%s\n' "$shared" | grep -c .) skills"

echo
echo "== 2. Staleness (claude source changed since codex port? via codex/PARITY.tsv) =="
manifest="$REPO_DIR/codex/PARITY.tsv"
if [ ! -f "$manifest" ]; then
  echo "  SKIP: no codex/PARITY.tsv baseline found"
else
  while IFS= read -r s; do
    [ -z "$s" ] && continue
    cur="$(git hash-object "$CLAUDE_SKILLS/$s/SKILL.md" 2>/dev/null)"
    base="$(awk -v k="$s" '$1==k{print $2}' "$manifest")"
    if [ -z "$base" ]; then
      echo "  WARN $s: no baseline in codex/PARITY.tsv -> reconcile the codex port, then record its line"
      warns=$((warns+1))
    elif [ "$cur" != "$base" ]; then
      echo "  WARN $s: claude source changed since the codex port was reconciled -> re-port, then refresh codex/PARITY.tsv"
      warns=$((warns+1))
    fi
  done <<< "$shared"
  [ "$warns" -eq 0 ] && echo "  OK: every codex port is reconciled against the current claude source"
fi

echo
echo "== 3. Frontmatter (name: + description: in each SKILL.md) =="
while IFS= read -r md; do
  head -40 "$md" | grep -q '^name:'        || { echo "  ERROR: $md missing 'name:'"; errors=$((errors+1)); }
  head -40 "$md" | grep -q '^description:' || { echo "  ERROR: $md missing 'description:'"; errors=$((errors+1)); }
done < <(find "$CLAUDE_SKILLS" "$CODEX_SKILLS" -mindepth 2 -maxdepth 4 -name SKILL.md 2>/dev/null | sort)
echo "  checked $(find "$CLAUDE_SKILLS" "$CODEX_SKILLS" -mindepth 2 -maxdepth 4 -name SKILL.md 2>/dev/null | wc -l | tr -d ' ') SKILL.md files"

echo
echo "== 4. Codex tree deep checks (delegated) =="
if [ -x "$REPO_DIR/codex/scripts/validate-codex-skills.sh" ]; then
  "$REPO_DIR/codex/scripts/validate-codex-skills.sh" || errors=$((errors+1))
else
  echo "  SKIP: codex/scripts/validate-codex-skills.sh not executable"
fi

echo
echo "== Summary: $errors error(s), $warns staleness warning(s) =="
[ "$errors" -eq 0 ]
