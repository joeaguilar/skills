#!/usr/bin/env bash
set -uo pipefail
#
# models.sh — canonical model-table tool. Single parser, two uses:
#
#   models.sh table   Print the canonical Scores markdown table from claude/MODELS.md.
#                     This is the injection primitive: a skill can pull the live table
#                     into context with  !`<repo>/claude/scripts/models.sh table`  (see
#                     "Inject dynamic context" in the Claude Code skills docs). Because
#                     it re-reads MODELS.md every run, the injected table can never drift.
#
#   models.sh check   Scan every claude/skills/**/SKILL.md for Markdown table rows whose
#                     first cell names a model in MODELS.md and whose next three cells are
#                     integers, and error on any that disagree with the canonical scores.
#                     Partial tables are fine — only rows that exist are compared. Wired
#                     into ./validate-skills.sh (§6). Exit 1 on drift, 0 when clean.
#
# MODELS.md is the source of truth; edit it, then run this (or ./validate-skills.sh).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
MODELS_MD="$SCRIPT_DIR/../MODELS.md"
SKILLS_DIR="$SCRIPT_DIR/../skills"

[ -f "$MODELS_MD" ] || { echo "models.sh: canonical $MODELS_MD not found" >&2; exit 2; }

cmd="${1:-}"
case "$cmd" in
  table)
    # Print the Scores table block: header row through the blank line that ends it.
    awk '
      /^\|[[:space:]]*Model[[:space:]]*\|[[:space:]]*Cost[[:space:]]*\|/ { p=1 }
      p { if ($0 ~ /^[[:space:]]*$/) exit; print }
    ' "$MODELS_MD"
    ;;

  check)
    # First file (MODELS.md) seeds canonical scores; the rest are scanned for drift.
    files=$(find "$SKILLS_DIR" -mindepth 2 -maxdepth 4 -name SKILL.md 2>/dev/null | sort)
    # shellcheck disable=SC2086
    awk '
      function trim(s){ gsub(/^[[:space:]]+|[[:space:]]+$/,"",s); return s }
      # A scores row: leading "|" -> f[1] empty, name in f[2], ints in f[3..5].
      function row(f, n,   name,c,i,t) {
        n=split($0, f, "|")
        if (n < 5) return 0
        name=trim(f[2]); c=trim(f[3]); i=trim(f[4]); t=trim(f[5])
        if (name=="" || c !~ /^[0-9]+$/ || i !~ /^[0-9]+$/ || t !~ /^[0-9]+$/) return 0
        R_name=name; R_c=c; R_i=i; R_t=t; return 1
      }
      NR==FNR {                       # canonical pass over MODELS.md
        if (row()) { C[R_name]=R_c; I[R_name]=R_i; T[R_name]=R_t }
        next
      }
      {                               # drift pass over each SKILL.md
        if (row() && (R_name in C)) {
          if (R_c!=C[R_name] || R_i!=I[R_name] || R_t!=T[R_name]) {
            printf "  DRIFT %s:%d  %s = %s/%s/%s  (canonical %s/%s/%s)\n", \
                   FILENAME, FNR, R_name, R_c,R_i,R_t, C[R_name],I[R_name],T[R_name]
            bad++
          }
        }
      }
      END { exit (bad>0 ? 1 : 0) }
    ' "$MODELS_MD" $files
    ;;

  *)
    echo "usage: models.sh {table|check}" >&2
    exit 2
    ;;
esac
