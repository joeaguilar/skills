#!/usr/bin/env bash
# test-install-config.sh — checks that the installer's `config` primitive links the
# Codex global rules (codex/global-AGENTS.md -> <codex home>/AGENTS.md), against a
# throwaway Codex home, so the real ~/.codex is never touched.
#   claude/scripts/test-install-config.sh [REPO_ROOT]   (default: this checkout)
set -u
repo="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
home="$(mktemp -d)"
trap 'rm -rf "$home"' EXIT
fail=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi; }

plan="$(bash "$repo/install.sh" codex --primitive config --codex-home "$home" 2>&1)"
check "dry run plans the AGENTS.md link" '[[ "$plan" == *"target: $home/AGENTS.md"* ]]'
check "dry run creates nothing" '[ ! -e "$home/AGENTS.md" ]'

bash "$repo/install.sh" codex --primitive config --codex-home "$home" --apply >/dev/null 2>&1
check "apply links AGENTS.md" '[ -e "$home/AGENTS.md" ]'
check "linked file is the repo copy" 'cmp -s "$home/AGENTS.md" "$repo/codex/global-AGENTS.md"'

again="$(bash "$repo/install.sh" codex --primitive config --codex-home "$home" 2>&1)"
check "second run sees it already linked" '[[ "$again" == *"already linked"* ]]'
exit $fail
