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
#   models.sh check   Two checks over every claude/skills/**/SKILL.md. Wired into
#                     ./validate-skills.sh (§6). Exit 1 on either failure, 0 when clean.
#
#                     (a) SCORE DRIFT — Markdown table rows whose first cell names a model
#                         in MODELS.md and whose next three cells are integers must match
#                         the canonical scores. Partial tables are fine; only rows that
#                         exist are compared.
#
#                     (b) UNKNOWN MODEL NAMES — every model-shaped token in a skill must
#                         appear somewhere in MODELS.md. Without this, a *rename* is
#                         invisible: check (a) skips rows whose name isn't canonical, so
#                         renaming opus-4.8 -> opus-5 in MODELS.md would leave every
#                         stale `opus-4.8` in the skills silently unvalidated. MODELS.md
#                         is the vocabulary — mention a model anywhere in it (including
#                         in a prose note, e.g. a retired model kept as a fallback) to
#                         make it legal in skills.
#
#                     NOT covered: scores quoted in prose ("opus-5 (intelligence 8)") are
#                     not table cells, so no checker sees them. Grep for those by hand
#                     when scores move:  grep -rnE '\((intelligence|taste) [0-9]' claude/
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
      # Harvest every model-shaped token on the line into arr[].
      function names(arr,   s, m) {
        s = $0
        while (match(s, /(opus|sonnet|haiku|fable|gpt)-[0-9]+(\.[0-9]+)?(-[a-z]+)?/)) {
          m = substr(s, RSTART, RLENGTH)
          arr[m] = 1
          s = substr(s, RSTART + RLENGTH)
        }
      }
      NR==FNR {                       # canonical pass over MODELS.md
        if (row()) { C[R_name]=R_c; I[R_name]=R_i; T[R_name]=R_t; KNOWN[R_name]=1 }
        # Legality comes from the Scores table plus an explicit allowlist ONLY.
        # Prose mentions must NOT grant it: a historical note about a retired
        # model would otherwise silently re-legalize every stale reference to it
        # — the exact rename blind spot this check exists to close.
        if ($0 ~ /<!--[[:space:]]*models-allow:/) names(KNOWN)
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
        delete seen; names(seen)
        for (n in seen) {
          if (!(n in KNOWN)) {
            # WARN, never an error. MODELS.md is a guide, not a rule: a name it
            # does not list may be a half-finished rename, or a deliberate call.
            # This tool cannot tell them apart, so it reports and gets out of the
            # way. It must never fail a commit.
            # (No apostrophes in this awk block — it is single-quoted in sh.)
            printf "  WARN %s:%d  \"%s\" is not in the MODELS.md Scores table or its models-allow list\n", \
                   FILENAME, FNR, n
          }
        }
      }
      # Only score drift is an error: an inlined copy that disagrees with the
      # canonical table is simply wrong data, and nobody chose it.
      END { exit (bad>0 ? 1 : 0) }
    ' "$MODELS_MD" $files
    ;;

  *)
    echo "usage: models.sh {table|check}" >&2
    exit 2
    ;;
esac
