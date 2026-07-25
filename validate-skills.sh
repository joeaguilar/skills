#!/usr/bin/env bash
set -uo pipefail

# Parity / drift validator across the two primitive trees.
# Codex ports are INTENTIONALLY reworded, so this does NOT compare content.
# It checks:
#   1. Set parity   — every skill in claude/skills has a sibling in codex/skills
#                     (and vice-versa), ignoring codex-only .system/.
#   2. Staleness    — compares each claude SKILL.md's git blob hash against the
#                     baseline recorded in codex/PARITY.tsv (the claude content
#                     the codex port was last reconciled against). A change ->
#                     the port is probably stale -> re-port. Rename-proof.
#   3. Frontmatter  — every SKILL.md has `name:` and `description:`.
#   3b. Primitive roots — optional agents/ and commands/ roots are present in
#                     both platform trees when used, and markdown payloads have
#                     expected frontmatter.
# Then it calls codex/scripts/validate-codex-skills.sh for the codex tree's
# deeper checks (agents/openai.yaml presence, primitive registry, Claude-ism lint).
#   6. Model table — every inline cost/intelligence/taste table in claude/skills
#                     matches claude/MODELS.md (the source of truth), via
#                     claude/scripts/models.sh check. Runs in every mode: a drifted
#                     scores table ships wrong routing, so it blocks a commit.
#
# --frontmatter-only: run only the frontmatter checks (3 + the payload lint of
# 3b), skipping parity/staleness/deep checks. This is the pre-commit gate mode:
# broken frontmatter ships broken primitives, so it must block a commit, while
# parity gaps are legitimate mid-port states that shouldn't.
# --strict-staleness: make any parity staleness warning fail the command. Use
# this in CI and before declaring a porting pass complete.

FRONTMATTER_ONLY=0
STRICT_STALENESS="${STRICT_STALENESS:-0}"
for arg in "$@"; do
  case "$arg" in
    --frontmatter-only) FRONTMATTER_ONLY=1 ;;
    --strict-staleness) STRICT_STALENESS=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
CLAUDE_SKILLS="$REPO_DIR/claude/skills"
CODEX_SKILLS="$REPO_DIR/codex/skills"
errors=0
warns=0

# Intentional platform-only primitives. Drift is legitimate in BOTH directions: Claude
# carries legacy/native payloads not yet ported to Codex; Codex carries skills Claude
# can't run (e.g. image generation). These are declared in PLATFORM_ONLY.tsv and exempted
# from the cross-tree parity checks below. Payloads in the agents/commands roots that are
# listed here also skip the frontmatter lint (imported as-is, not managed-convention files).
PLATFORM_ONLY_FILE="$REPO_DIR/PLATFORM_ONLY.tsv"
platform_only_lines=""   # normalized "platform/root/name", one per line
if [ -f "$PLATFORM_ONLY_FILE" ]; then
  platform_only_lines="$(grep -vE '^[[:space:]]*(#|$)' "$PLATFORM_ONLY_FILE" \
    | awk 'NF>=3{print $1"/"$2"/"$3}' | sort -u)"
fi
is_platform_only() { # platform root name -> 0 if declared platform-only
  [ -n "$platform_only_lines" ] && printf '%s\n' "$platform_only_lines" | grep -qxF "$1/$2/$3"
}

list_skills() { # tree -> skill dir names that contain a SKILL.md, excluding .system
  [ -d "$1" ] || return 0
  for d in "$1"/*/; do
    name="$(basename "$d")"
    [ "$name" = ".system" ] && continue
    [ -f "$d/SKILL.md" ] && echo "$name"
  done | sort
}

if [ "$FRONTMATTER_ONLY" -eq 0 ]; then
echo "== 1. Set parity (claude/skills <-> codex/skills, .system excluded) =="
claude_list="$(list_skills "$CLAUDE_SKILLS")"
codex_list="$(list_skills "$CODEX_SKILLS")"

only_claude="$(comm -23 <(printf '%s\n' "$claude_list") <(printf '%s\n' "$codex_list"))"
only_codex="$(comm -13 <(printf '%s\n' "$claude_list") <(printf '%s\n' "$codex_list"))"
shared="$(comm -12 <(printf '%s\n' "$claude_list") <(printf '%s\n' "$codex_list"))"

if [ -n "$only_claude" ]; then
  while IFS= read -r s; do
    [ -z "$s" ] && continue
    if is_platform_only claude skills "$s"; then
      echo "  OK (claude-only, declared in PLATFORM_ONLY.tsv): skills/$s"
    else
      echo "  ERROR: '$s' has no codex port (claude-only) -> port it into codex/skills/$s, or declare it claude-only in PLATFORM_ONLY.tsv"; errors=$((errors+1))
    fi
  done <<< "$only_claude"
fi
if [ -n "$only_codex" ]; then
  while IFS= read -r s; do
    [ -z "$s" ] && continue
    if is_platform_only codex skills "$s"; then
      echo "  OK (codex-only, declared in PLATFORM_ONLY.tsv): skills/$s"
    else
      echo "  ERROR: '$s' has no claude source (codex-only) -> add claude/skills/$s, or declare it codex-only in PLATFORM_ONLY.tsv"; errors=$((errors+1))
    fi
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
fi # FRONTMATTER_ONLY

echo
echo "== 3. Frontmatter (name: + description: in each SKILL.md) =="
while IFS= read -r md; do
  head -40 "$md" | grep -q '^name:'        || { echo "  ERROR: $md missing 'name:'"; errors=$((errors+1)); }
  head -40 "$md" | grep -q '^description:' || { echo "  ERROR: $md missing 'description:'"; errors=$((errors+1)); }
done < <(find "$CLAUDE_SKILLS" "$CODEX_SKILLS" -mindepth 2 -maxdepth 4 -name SKILL.md 2>/dev/null | sort)
echo "  checked $(find "$CLAUDE_SKILLS" "$CODEX_SKILLS" -mindepth 2 -maxdepth 4 -name SKILL.md 2>/dev/null | wc -l | tr -d ' ') SKILL.md files"

echo
echo "== 4. Optional primitive roots (agents/ + commands/) =="
if [ "$FRONTMATTER_ONLY" -eq 0 ]; then
for root in agents commands; do
  claude_root="$REPO_DIR/claude/$root"
  codex_root="$REPO_DIR/codex/$root"
  if [ -d "$claude_root" ] && [ ! -d "$codex_root" ]; then
    echo "  ERROR: claude/$root exists but codex/$root is missing"
    errors=$((errors+1))
  elif [ -d "$codex_root" ] && [ ! -d "$claude_root" ]; then
    echo "  ERROR: codex/$root exists but claude/$root is missing"
    errors=$((errors+1))
  elif [ -d "$claude_root" ] && [ -d "$codex_root" ]; then
    claude_items="$(find "$claude_root" -maxdepth 2 -type f -name '*.md' -exec basename {} \; | sort)"
    codex_items="$(find "$codex_root" -maxdepth 2 -type f -name '*.md' -exec basename {} \; | sort)"
    only_claude_items="$(comm -23 <(printf '%s\n' "$claude_items") <(printf '%s\n' "$codex_items"))"
    only_codex_items="$(comm -13 <(printf '%s\n' "$claude_items") <(printf '%s\n' "$codex_items"))"
    if [ -n "$only_claude_items" ]; then
      while IFS= read -r item; do
        [ -z "$item" ] && continue
        if is_platform_only claude "$root" "$item"; then
          echo "  OK (claude-only, declared in PLATFORM_ONLY.tsv): $root/$item"
        else
          echo "  ERROR: claude/$root/$item has no codex peer -> port it, or declare it claude-only in PLATFORM_ONLY.tsv"; errors=$((errors+1))
        fi
      done <<< "$only_claude_items"
    fi
    if [ -n "$only_codex_items" ]; then
      while IFS= read -r item; do
        [ -z "$item" ] && continue
        if is_platform_only codex "$root" "$item"; then
          echo "  OK (codex-only, declared in PLATFORM_ONLY.tsv): $root/$item"
        else
          echo "  ERROR: codex/$root/$item has no claude peer -> port it, or declare it codex-only in PLATFORM_ONLY.tsv"; errors=$((errors+1))
        fi
      done <<< "$only_codex_items"
    fi
    [ -z "$only_claude_items$only_codex_items" ] && echo "  OK: $root roots expose matching markdown payloads"
  else
    echo "  OK: $root roots absent in both platform trees"
  fi
done
fi # FRONTMATTER_ONLY

while IFS= read -r md; do
  rel="${md#$REPO_DIR/}"
  # Skip platform-only legacy/native payloads (imported as-is). rel = "<platform>/<root>/<file>.md".
  _p="${rel%%/*}"; _rest="${rel#*/}"; _r="${_rest%%/*}"
  if is_platform_only "$_p" "$_r" "$(basename "$rel")"; then continue; fi
  head -1 "$md" | grep -q '^---$' || { echo "  ERROR: $rel missing YAML frontmatter start"; errors=$((errors+1)); }
  case "$rel" in
    */agents/*) head -40 "$md" | grep -q '^name:' || { echo "  ERROR: $rel missing 'name:'"; errors=$((errors+1)); } ;;
  esac
  head -40 "$md" | grep -q '^description:' || { echo "  ERROR: $rel missing 'description:'"; errors=$((errors+1)); }
done < <(find "$REPO_DIR/claude/agents" "$REPO_DIR/claude/commands" "$REPO_DIR/codex/agents" "$REPO_DIR/codex/commands" -type f -name '*.md' 2>/dev/null | sort)

if [ "$FRONTMATTER_ONLY" -eq 0 ]; then
echo
echo "== 5. Codex tree deep checks (delegated) =="
if [ -x "$REPO_DIR/codex/scripts/validate-codex-skills.sh" ]; then
  "$REPO_DIR/codex/scripts/validate-codex-skills.sh" || errors=$((errors+1))
else
  echo "  SKIP: codex/scripts/validate-codex-skills.sh not executable"
fi
fi # FRONTMATTER_ONLY

echo
echo "== 6. Model table drift (claude/skills tables vs claude/MODELS.md) =="
# Two severities, on purpose. MODELS.md is a GUIDE, not a rule — it must never
# block what a skill does:
#   ERROR  score drift  — an inlined copy of the scores table that disagrees with
#                         the canonical one is simply wrong data; nobody chose it.
#                         Blocks a commit, like broken frontmatter.
#   WARN   unknown name — a skill naming a model the table doesn't list may be a
#                         half-finished rename or a deliberate call. Reported so a
#                         stalled rename is visible; never fails the gate.
if [ -x "$REPO_DIR/claude/scripts/models.sh" ]; then
  if out="$("$REPO_DIR/claude/scripts/models.sh" check)"; then
    if [ -n "$out" ]; then
      printf '%s\n' "$out"
      n=$(printf '%s\n' "$out" | /usr/bin/grep -c '  WARN ')
      echo "  -> $n name(s) outside claude/MODELS.md. Fine if deliberate; if this is a"
      echo "     half-finished rename, finish it or add the name to the models-allow line."
      warns=$((warns+n))
    else
      echo "  OK: every inline model table matches claude/MODELS.md"
    fi
  else
    printf '%s\n' "$out"
    echo "  -> edit the skill table to match claude/MODELS.md (the source of truth), or update MODELS.md"
    errors=$((errors+1))
  fi
else
  echo "  SKIP: claude/scripts/models.sh not executable"
fi

echo
echo "== 7. Meiyaku drift (dojo oath copies vs claude/DOJO.md canon) =="
# Runs in every mode: every prompt a dojo blade emits to a thrown agent opens with
# the Meiyaku oath block, byte-for-byte (leading indentation aside — a copy inside an
# indented fence keeps its fence's indent). A drifted copy ships a drifted oath.
DOJO_MD="$REPO_DIR/claude/DOJO.md"
canon="$(awk '/^盟約 MEIYAKU/{f=1} f{print} f&&/^Break a law and the clan falls\. Execute\.$/{exit}' "$DOJO_MD" 2>/dev/null)"
if [ -z "$canon" ]; then
  echo "  SKIP: no canonical Meiyaku block found in claude/DOJO.md"
else
  oath_lines="$(printf '%s\n' "$canon" | wc -l | tr -d ' ')"
  oath_errs=0; oath_copies=0
  while IFS= read -r md; do
    [ -z "$md" ] && continue
    while IFS= read -r ln; do
      [ -z "$ln" ] && continue
      oath_copies=$((oath_copies+1))
      blk="$(sed -n "${ln},$((ln+oath_lines-1))p" "$md" | sed 's/^[[:space:]]*//')"
      if [ "$blk" != "$canon" ]; then
        echo "  ERROR: ${md#$REPO_DIR/}:$ln oath copy drifted from the DOJO.md canon -> paste the canonical block from claude/DOJO.md"
        errors=$((errors+1)); oath_errs=$((oath_errs+1))
      fi
    done < <(grep -n '^[[:space:]]*盟約 MEIYAKU' "$md" | cut -d: -f1)
  done < <(grep -rl '盟約 MEIYAKU' "$CLAUDE_SKILLS" --include=SKILL.md 2>/dev/null | sort)
  [ "$oath_errs" -eq 0 ] && echo "  OK: $oath_copies oath copies match the DOJO.md canon"
fi

echo
echo "== Summary: $errors error(s), $warns staleness warning(s) =="
[ "$errors" -eq 0 ] && { [ "$STRICT_STALENESS" -eq 0 ] || [ "$warns" -eq 0 ]; }
