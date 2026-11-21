#!/usr/bin/env bash
# preflight.sh — the facts a backlog or sprint orchestrator needs before it plans.
#
# One read-only pass over a repo. It prints `key: value` lines; a key that can hold
# several values repeats, one value per line. Nothing is written, staged, stashed,
# initialised or fixed: the caller decides what to do with what it reads.
#
# The orchestrator skills read these lines instead of re-deriving them from prose
# tables. The tables were copied between skills and drifted: one copy gained
# `--all-targets` on the clippy gate after a lint in a test file shipped, and four
# others kept the bare form.
#
# Usage: preflight.sh [--gate] [--since DAYS] [ROOT]
#        preflight.sh --waves [--concurrency N] [--tag TAG] [--parent ID] [--own ID=path[,path...]]...
#                     [--also ID=path[,path...]]... [ROOT]
#   --gate        print only the verify-gate command; exit 1 when none is detected
#   --since DAYS  how far back the stale-ticket sweep reads git history (default 30)
#   --waves       print only the conflict-free execution waves computed from the itr backlog;
#                 exit 1 when no itr database resolves
#   --concurrency N  with --waves: most tasks in one wave (a whole number >= 1; default 5)
#   --tag TAG, --parent ID
#                 with --waves: scope the backlog, passed to `itr list`
#   --own ID=path[,path...]
#                 with --waves, repeatable: replace the file claims of issue ID for this run
#                 (files a planner inferred); repeats for one ID add up
#   --also ID=path[,path...]
#                 with --waves, repeatable: add claims to issue ID on top of its declared or
#                 --own ones (a doc or shared file the ticket did not list)
#   ROOT          repo to inspect (default: the current directory)
#
# Lines (in this order; `…` marks a key that repeats):
#   root                      absolute path inspected
#   git                       present | absent
#   branch                    branch name | detached | none
#   head                      short sha | none (no commits yet)
#   dirty                     count of uncommitted paths
#   dirty-path …              one uncommitted path, as `git status --porcelain` spells it
#   tracker                   itr (a database resolves) | itr-no-db | none
#   tracker-open              open issue count | unknown
#   kgr, gatr                 present | absent
#   verify-gate               the gate command | missing
#   verify-gate-source        the file that decided it | none
#   story-style               STORY_STYLE.md | absent
#   roadmap                   docs/ROADMAP.md | ROADMAP.md | absent
#   sprint-next               sprint-N, the next free sprint number
#   sprint-current            folder named by sprint/CURRENT | absent
#   sprint-current-valid      yes | no   (the folder exists)
#   sprint-current-reviewed   yes | no   (plan.md's Outcomes holds real content)
#   unfinished-wave-log …     a blitz wave log with no `Blitz complete` line
#   stale-ticket …            `#id sha subject`: a commit says it closed the ticket, itr says open
#
# Lines of --waves (in this order, and nothing else; each group sorted):
#   wave-concurrency          the cap on tasks per wave
#   wave-count                number of waves
#   wave-placed               number of tasks placed in a wave
#   wave …                    `N #a #b`: the tasks of wave N, ids ascending
#   wave-conflict …           `<claim> #a #b…`: tasks that contend for a claim and so never share a wave
#   wave-order …              `#T after #B`: T waits for B, which is placed earlier
#   wave-deferred …           `#T visual-gate-only`: left for a visual gate, never placed
#   wave-unowned …            `#T`: no file claims, never placed (--own can supply them)
#   wave-held …               `#T waits on #B (deferred|unowned|held|epic|out of scope|cycle)`
#   wave-path-absent …        `#T <path>`: a claim that matches no file (it may be one the task creates)
# Claims come from itr's `files` field. A path is normalised (`\` to `/`, no leading `./`, no
# repeated `/`); one that does not exist is tried without the repo-name prefix, then as the one
# tracked file it is the tail of. A directory claim covers everything beneath it. Tasks that
# conflict, and tasks ordered by `blocked_by` or a non-epic parent, land in different waves; a
# task whose open blocker is not placed is held. A path holding a comma cannot be claimed, and
# spaces at either end of a claim are dropped (itr trims its own lists the same way).
set -u

GATE_ONLY=0
SINCE_DAYS=30
WAVES=0
WAVE_OPTS=0
CONCURRENCY=5
SCOPE_TAG=""
SCOPE_PARENT=""
OWN_CLAIMS=""
ALSO_CLAIMS=""
wave_arg() { # option: it must carry a value
  [ "$2" -ge 2 ] && return 0
  printf 'preflight: %s needs a value\n' "$1" >&2
  exit 2
}
ROOT="."
while [ $# -gt 0 ]; do
  case "$1" in
    --gate) GATE_ONLY=1; shift ;;
    --since) SINCE_DAYS="${2:?--since needs a number of days}"; shift 2 ;;
    --waves) WAVES=1; shift ;;
    --concurrency) wave_arg "$1" $#; CONCURRENCY="$2"; WAVE_OPTS=1; shift 2 ;;
    --tag) wave_arg "$1" $#; SCOPE_TAG="$2"; WAVE_OPTS=1; shift 2 ;;
    --parent) wave_arg "$1" $#; SCOPE_PARENT="$2"; WAVE_OPTS=1; shift 2 ;;
    --own|--also)
      wave_arg "$1" $#
      own_id="${2%%=*}"
      own_paths="${2#*=}"
      case "$2" in *=*) ;; *) own_id="" ;; esac
      case "$own_id" in ''|*[!0-9]*) printf 'preflight: %s takes ID=path[,path...], got %s\n' "$1" "$2" >&2; exit 2 ;; esac
      case "$own_paths" in *[!,\ ]*) ;; *) printf 'preflight: %s %s names no path\n' "$1" "$2" >&2; exit 2 ;; esac
      case "$own_paths" in ,*|*,|*,,*) printf 'preflight: %s %s has an empty path in its list\n' "$1" "$2" >&2; exit 2 ;; esac
      if [ "$1" = "--own" ]; then
        OWN_CLAIMS="$OWN_CLAIMS$own_id	$own_paths
"
      else
        ALSO_CLAIMS="$ALSO_CLAIMS$own_id	$own_paths
"
      fi
      WAVE_OPTS=1; shift 2 ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
    -*) printf 'preflight: unknown option %s\n' "$1" >&2; exit 2 ;;
    *) ROOT="$1"; shift ;;
  esac
done
case "$SINCE_DAYS" in
  ''|*[!0-9]*) printf 'preflight: --since takes a whole number of days\n' >&2; exit 2 ;;
esac
if [ "$WAVES" -eq 0 ] && [ "$WAVE_OPTS" -eq 1 ]; then
  printf 'preflight: --concurrency, --tag, --parent, --own and --also need --waves\n' >&2
  exit 2
fi
if [ "$WAVES" -eq 1 ] && [ "$GATE_ONLY" -eq 1 ]; then
  printf 'preflight: --waves and --gate are separate modes\n' >&2
  exit 2
fi
case "$CONCURRENCY" in
  ''|*[!0-9]*) printf 'preflight: --concurrency takes a whole number >= 1\n' >&2; exit 2 ;;
esac
CONCURRENCY="${CONCURRENCY#"${CONCURRENCY%%[!0]*}"}"   # drop leading zeros
if [ -z "$CONCURRENCY" ]; then
  printf 'preflight: --concurrency takes a whole number >= 1\n' >&2
  exit 2
fi

if ! cd "$ROOT" 2>/dev/null; then
  printf 'preflight: cannot enter %s\n' "$ROOT" >&2
  exit 2
fi
ROOT="$(pwd -P)"

have() { command -v "$1" >/dev/null 2>&1; }

# --- verify gate -------------------------------------------------------------
# First match wins, in this order. This is the only copy of the table.
GATE=""
GATE_SOURCE="none"
detect_verify_gate() {
  if [ -f Cargo.toml ]; then
    # --all-targets is not optional: bare `cargo clippy` lints only the default
    # targets, so a lint in a test file passes the gate and ships.
    GATE='cargo test && cargo clippy --all-targets -- -D warnings && cargo fmt --check'
    GATE_SOURCE="Cargo.toml"
    return 0
  fi

  if [ -f package.json ]; then
    npm_gate=""
    if have node; then
      npm_gate="$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync("package.json","utf8")); const s=p.scripts||{}; const cmds=[]; if(s.test)cmds.push("npm test"); if(s.lint)cmds.push("npm run lint"); if(s.typecheck)cmds.push("npm run typecheck"); if(s["format:check"])cmds.push("npm run format:check"); process.stdout.write(cmds.join(" && "));' 2>/dev/null)"
    elif grep -q '"test"[[:space:]]*:' package.json 2>/dev/null; then
      npm_gate='npm test'
    fi
    if [ -n "$npm_gate" ]; then
      GATE="$npm_gate"
      GATE_SOURCE="package.json"
      return 0
    fi
  fi

  if [ -f pyproject.toml ]; then
    GATE='pytest && ruff check . && ruff format --check .'
    GATE_SOURCE="pyproject.toml"
    return 0
  fi

  if [ -f go.mod ]; then
    GATE='go test ./... && go vet ./... && test -z "$(gofmt -l .)"'
    GATE_SOURCE="go.mod"
    return 0
  fi

  if [ -f Makefile ] && grep -Eq '^test:' Makefile 2>/dev/null; then
    GATE='make test'
    grep -Eq '^lint:' Makefile 2>/dev/null && GATE="$GATE && make lint"
    grep -Eq '^check:' Makefile 2>/dev/null && GATE="$GATE && make check"
    grep -Eq '^verify:' Makefile 2>/dev/null && GATE="$GATE && make verify"
    GATE_SOURCE="Makefile"
    return 0
  fi

  for jf in justfile Justfile; do
    [ -f "$jf" ] || continue
    if grep -Eq '^verify:' "$jf" 2>/dev/null; then GATE='just verify'
    elif grep -Eq '^check:' "$jf" 2>/dev/null; then GATE='just check'
    elif grep -Eq '^test:' "$jf" 2>/dev/null; then GATE='just test'
    else continue
    fi
    GATE_SOURCE="$jf"
    return 0
  done

  return 1
}

if [ "$GATE_ONLY" -eq 1 ]; then
  detect_verify_gate || exit 1
  printf '%s\n' "$GATE"
  exit 0
fi

# --- waves -------------------------------------------------------------------
# Conflict-free execution waves from the itr backlog. Read-only: itr is only
# listed, and the claims are checked against the working tree and `git ls-files`.
ITR_FIELDS="id,kind,priority,status,parent_id,blocked_by,tags,files"

# claim_of PATH — normalise one claim. Sets WC (the claim) and WA (1 when no file matches it).
claim_of() {
  WA=0
  WC="${1//\\//}"
  while :; do case "$WC" in *//*) WC="${WC//\/\///}" ;; *) break ;; esac; done
  while :; do case "$WC" in ./*) WC="${WC#./}" ;; *) break ;; esac; done
  wc_dir=0
  case "$WC" in */) wc_dir=1 ;; esac
  while :; do case "$WC" in */) WC="${WC%/}" ;; *) break ;; esac; done
  if [ -z "$WC" ] || [ "$WC" = "." ]; then WC="./"; return 0; fi
  if [ -d "$WC" ]; then
    wc_dir=1
  elif [ ! -e "$WC" ]; then
    wc_found=0
    wc_base="${ROOT##*/}"
    case "$WC" in
      "$wc_base"/*)
        wc_rest="${WC#"$wc_base"/}"
        if [ -e "$wc_rest" ]; then WC="$wc_rest"; wc_found=1; [ -d "$WC" ] && wc_dir=1; fi ;;
    esac
    if [ "$wc_found" -eq 0 ] && [ "$wc_dir" -eq 0 ]; then
      wc_hit="$(printf '%s\n' "$WAVE_TRACKED" | awk -v p="$WC" '
        $0 == p || (length($0) > length(p) + 1 && substr($0, length($0) - length(p)) == "/" p) { n++; m = $0 }
        END { if (n == 1) print m }')"
      if [ -n "$wc_hit" ]; then WC="$wc_hit"; wc_found=1; fi
    fi
    [ "$wc_found" -eq 0 ] && WA=1
  fi
  [ "$wc_dir" -eq 1 ] && WC="$WC/"
  return 0
}

waves() {
  if ! have itr || ! itr stats >/dev/null 2>&1; then
    printf 'preflight: --waves needs an itr database, and none resolves here\n' >&2
    return 1
  fi
  # shellcheck disable=SC2086
  if ! w_scoped="$(itr list --sort id -f oneline --fields "$ITR_FIELDS" ${SCOPE_TAG:+--tag "$SCOPE_TAG"} ${SCOPE_PARENT:+--parent "$SCOPE_PARENT"} 2>/dev/null)" \
     || ! w_open="$(itr list --sort id -f oneline --fields id,kind 2>/dev/null)"; then
    printf 'preflight: itr list failed\n' >&2
    return 1
  fi
  w_scoped="$(printf '%s\n' "$w_scoped" | tr -d '\r')"
  w_open="$(printf '%s\n' "$w_open" | tr -d '\r')"
  WAVE_TRACKED=""
  # -z: without it git C-quotes a name holding a quote or a backslash, and the tail match misses it.
  [ "$git_state" = "present" ] && WAVE_TRACKED="$(git ls-files -z 2>/dev/null | tr '\0' '\n')"

  # Claims per task: the `files` field, or the --own paths when given. Epics and
  # visual-gate-only tasks claim nothing.
  w_raw="$({
    printf '%s' "$OWN_CLAIMS" | awk 'NF { print "W\t" $0 }'
    printf '%s' "$ALSO_CLAIMS" | awk 'NF { print "A\t" $0 }'
    printf '%s\n' "$w_scoped" | awk 'NF { print "L\t" $0 }'
  } | awk '
    /^W\t/ {
      s = substr($0, 3); i = index(s, "\t"); id = substr(s, 1, i - 1)
      own[id] = (id in own ? own[id] "," : "") substr(s, i + 1)
      next
    }
    /^A\t/ {
      s = substr($0, 3); i = index(s, "\t"); id = substr(s, 1, i - 1)
      also[id] = (id in also ? also[id] "," : "") substr(s, i + 1)
      next
    }
    /^L\t/ { n++; row[n] = substr($0, 3) }
    END {
      for (r = 1; r <= n; r++) {
        split(row[r], f, "\t")
        id = f[1]
        if (id == "" || f[2] == "epic") continue
        skip = 0; m = split(f[7], tg, ",")
        for (j = 1; j <= m; j++) if (tg[j] == "visual-gate-only") skip = 1
        if (skip) continue
        c = (id in own) ? own[id] : f[8]
        if (id in also) c = c "," also[id]
        m = split(c, p, ",")
        for (j = 1; j <= m; j++) {
          x = p[j]; sub(/^[ \t]+/, "", x); sub(/[ \t]+$/, "", x)
          if (x != "") printf "%s\t%s\n", id, x
        }
      }
    }')"
  w_claims=""
  while IFS="$(printf '\t')" read -r w_id w_path; do
    [ -n "$w_id" ] || continue
    claim_of "$w_path"
    w_claims="$w_claims$w_id	$WC	$WA
"
  done <<EOF_RAW
$w_raw
EOF_RAW

  {
    printf '%s\n' "$w_scoped" | awk 'NF { print "L\t" $0 }'
    printf '%s\n' "$w_open" | awk 'NF { print "O\t" $0 }'
    printf '%s' "$w_claims" | awk 'NF { print "C\t" $0 }'
  } | LC_ALL=C awk -v conc="$CONCURRENCY" '
    function sortnum(a, n,   i, j, t) {
      for (i = 2; i <= n; i++) {
        t = a[i]
        for (j = i - 1; j >= 1 && a[j] + 0 > t + 0; j--) a[j + 1] = a[j]
        a[j + 1] = t
      }
    }
    function sortstr(a, n,   i, j, t) {
      for (i = 2; i <= n; i++) {
        t = a[i]
        for (j = i - 1; j >= 1 && (a[j] "") > (t "") ; j--) a[j + 1] = a[j]
        a[j + 1] = t
      }
    }
    function rank(p) {
      if (p == "critical") return 0
      if (p == "high") return 1
      if (p == "medium") return 2
      if (p == "low") return 3
      return 4
    }
    function before(a, b) { return prio[a] < prio[b] || (prio[a] == prio[b] && a + 0 < b + 0) }
    function covers(c, e) {
      # "" forces a string comparison: split() hands back strnums, and as numbers `01` == `1`.
      if ((c "") == (e "")) return 1
      if (substr(c, length(c)) != "/") return 0
      return (c "") == "./" || substr(e, 1, length(c)) == (c "")
    }
    function clash(a, b,   i, j) {
      for (i = 1; i <= nc[a]; i++)
        for (j = 1; j <= nc[b]; j++)
          if (covers(claim[a, i], claim[b, j]) || covers(claim[b, j], claim[a, i])) return 1
      return 0
    }
    /^L\t/ {
      split(substr($0, 3), f, "\t")
      if (f[1] == "" || f[2] == "epic") next
      nt++; tid[nt] = f[1]; intask[f[1]] = 1
      prio[f[1]] = rank(f[3]); parent[f[1]] = f[5]; blocked[f[1]] = f[6]; tags[f[1]] = f[7]
      next
    }
    /^O\t/ {
      split(substr($0, 3), f, "\t")
      isopen[f[1]] = 1
      if (f[2] == "epic") isepic[f[1]] = 1
      next
    }
    /^C\t/ {
      split(substr($0, 3), f, "\t")
      if ((f[1], f[2]) in seen) next
      seen[f[1], f[2]] = 1
      nc[f[1]]++; claim[f[1], nc[f[1]]] = f[2]
      if (f[3] == 1) { na[f[1]]++; ab[f[1], na[f[1]]] = f[2] }
      next
    }
    END {
      sortnum(tid, nt)
      # state: cand (may be placed) | deferred | unowned | held
      for (i = 1; i <= nt; i++) {
        t = tid[i]; st[t] = "cand"
        m = split(tags[t], tg, ",")
        for (j = 1; j <= m; j++) if (tg[j] == "visual-gate-only") st[t] = "deferred"
        if (st[t] == "cand" && nc[t] + 0 == 0) st[t] = "unowned"
      }
      # open dependencies: blocked_by, and a parent that is not an epic
      for (i = 1; i <= nt; i++) {
        t = tid[i]
        if (st[t] != "cand") continue
        m = split(blocked[t], bl, ",")
        if (parent[t] != "" && !(parent[t] in isepic)) { m++; bl[m] = parent[t] }
        k = 0
        for (j = 1; j <= m; j++) {
          b = bl[j]
          if (b == "" || b == t || !(b in isopen) || ((t, b) in dseen)) continue
          dseen[t, b] = 1; k++; dl[t, k] = b
        }
        dn[t] = k
        for (j = 1; j <= k; j++) dtmp[j] = dl[t, j]
        sortnum(dtmp, k)
        for (j = 1; j <= k; j++) dl[t, j] = dtmp[j]
      }
      # on or behind a dependency cycle: what a topological peel cannot remove. Found before the
      # other holds, so a cycle keeps its reason when one of its tasks also waits on something else.
      do {
        ch = 0
        for (i = 1; i <= nt; i++) {
          t = tid[i]
          if (t in peeled) continue
          ok = 1
          for (j = 1; j <= dn[t]; j++) if ((dl[t, j] in intask) && !(dl[t, j] in peeled)) { ok = 0; break }
          if (ok) { peeled[t] = 1; ch = 1 }
        }
      } while (ch)
      for (i = 1; i <= nt; i++) if (!(tid[i] in peeled)) { knot[tid[i]] = 1; st[tid[i]] = "held" }
      # hold whatever waits on an open task that will not be placed, transitively
      do {
        ch = 0
        for (i = 1; i <= nt; i++) {
          t = tid[i]
          if (st[t] != "cand") continue
          for (j = 1; j <= dn[t]; j++) {
            b = dl[t, j]
            if (!(b in intask) || st[b] != "cand") { st[t] = "held"; ch = 1; break }
          }
        }
      } while (ch)
      for (i = 1; i <= nt; i++) {
        t = tid[i]
        if (st[t] != "held") continue
        for (j = 1; j <= dn[t]; j++) {
          b = dl[t, j]
          if ((t in knot) && (b in knot)) { hr[t, b] = "cycle"; continue }
          if (b in intask && st[b] == "cand") continue
          if (b in isepic) why = "epic"
          else if (!(b in intask)) why = "out of scope"
          else why = st[b]
          hr[t, b] = why
        }
      }
      # packing order: priority, then id; a task waits until its dependencies are placed
      no = 0
      for (i = 1; i <= nt; i++) {
        t = tid[i]
        if (st[t] != "cand") continue
        for (j = ++no; j > 1 && before(t, ord[j - 1]); j--) ord[j] = ord[j - 1]
        ord[j] = t
      }
      for (;;) {
        pick = ""
        for (i = 1; i <= no && pick == ""; i++) {
          t = ord[i]
          if (t in wave) continue
          ok = 1
          for (j = 1; j <= dn[t]; j++) if (!(dl[t, j] in wave)) { ok = 0; break }
          if (ok) pick = t
        }
        if (pick == "") break
        minw = 1
        for (j = 1; j <= dn[pick]; j++) if (wave[dl[pick, j]] + 1 > minw) minw = wave[dl[pick, j]] + 1
        for (w = minw; ; w++) {
          if (wn[w] + 0 >= conc + 0) continue
          hit = 0
          for (j = 1; j <= wn[w] + 0; j++) if (clash(pick, wm[w, j])) { hit = 1; break }
          if (!hit) break
        }
        wave[pick] = w; wn[w]++; wm[w, wn[w]] = pick; np++
        if (w > maxw) maxw = w
      }
      # what is left waits on a cycle
      for (i = 1; i <= no; i++) if (!(ord[i] in wave)) left[ord[i]] = 1
      for (i = 1; i <= no; i++) {
        t = ord[i]
        if (!(t in left)) continue
        for (j = 1; j <= dn[t]; j++) if (dl[t, j] in left) hr[t, dl[t, j]] = "cycle"
      }
      for (t in left) st[t] = "held"

      printf "wave-concurrency: %s\n", conc
      printf "wave-count: %d\n", maxw + 0
      printf "wave-placed: %d\n", np + 0
      for (w = 1; w <= maxw; w++) {
        for (j = 1; j <= wn[w]; j++) mem[j] = wm[w, j]
        sortnum(mem, wn[w])
        line = ""
        for (j = 1; j <= wn[w]; j++) line = line " #" mem[j]
        printf "wave: %d%s\n", w, line
      }
      # contended claims, among placed tasks; a directory claim names its whole subtree
      nd = 0
      for (i = 1; i <= nt; i++) {
        t = tid[i]
        if (!(t in wave)) continue
        for (j = 1; j <= nc[t]; j++) if (!(claim[t, j] in dseenc)) { dseenc[claim[t, j]] = 1; dc[++nd] = claim[t, j] }
      }
      sortstr(dc, nd)
      for (d = 1; d <= nd; d++) {
        cnt = 0; line = ""
        for (i = 1; i <= nt; i++) {
          t = tid[i]
          if (!(t in wave)) continue
          for (j = 1; j <= nc[t]; j++) if (covers(dc[d], claim[t, j])) { cnt++; line = line " #" t; break }
        }
        if (cnt >= 2) printf "wave-conflict: %s%s\n", dc[d], line
      }
      for (i = 1; i <= nt; i++) {
        t = tid[i]
        if (!(t in wave)) continue
        for (j = 1; j <= dn[t]; j++) printf "wave-order: #%s after #%s\n", t, dl[t, j]
      }
      for (i = 1; i <= nt; i++) if (st[tid[i]] == "deferred") printf "wave-deferred: #%s visual-gate-only\n", tid[i]
      for (i = 1; i <= nt; i++) if (st[tid[i]] == "unowned") printf "wave-unowned: #%s\n", tid[i]
      for (i = 1; i <= nt; i++) {
        t = tid[i]
        if (st[t] != "held") continue
        for (j = 1; j <= dn[t]; j++) if ((t, dl[t, j]) in hr) printf "wave-held: #%s waits on #%s (%s)\n", t, dl[t, j], hr[t, dl[t, j]]
      }
      for (i = 1; i <= nt; i++) {
        t = tid[i]
        for (j = 1; j <= na[t] + 0; j++) tmp[j] = ab[t, j]
        sortstr(tmp, na[t] + 0)
        for (j = 1; j <= na[t] + 0; j++) printf "wave-path-absent: #%s %s\n", t, tmp[j]
      }
    }'
}

if [ "$WAVES" -eq 1 ]; then
  git_state="absent"
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git_state="present"
  waves
  exit $?
fi

printf 'root: %s\n' "$ROOT"

# --- git ---------------------------------------------------------------------
git_state="absent"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_state="present"
fi
printf 'git: %s\n' "$git_state"

head_sha="none"
if [ "$git_state" = "present" ]; then
  branch="$(git branch --show-current 2>/dev/null)"
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    head_sha="$(git rev-parse --short HEAD 2>/dev/null)"
    [ -z "$branch" ] && branch="detached"
  fi
  [ -z "$branch" ] && branch="none"
  printf 'branch: %s\n' "$branch"
  printf 'head: %s\n' "$head_sha"
  status_text="$(git status --porcelain 2>/dev/null || true)"
  if [ -z "$status_text" ]; then
    printf 'dirty: 0\n'
  else
    printf 'dirty: %s\n' "$(printf '%s\n' "$status_text" | wc -l | tr -d ' ')"
    printf '%s\n' "$status_text" | while IFS= read -r line; do
      printf 'dirty-path: %s\n' "${line:3}"
    done
  fi
else
  printf 'branch: none\nhead: none\ndirty: 0\n'
fi

# --- tracker and tools -------------------------------------------------------
tracker="none"
tracker_open="unknown"
if have itr; then
  # `itr stats` walks up to the database the way every other itr command does.
  if itr_stats="$(itr stats 2>/dev/null)"; then
    tracker="itr"
    parsed="$(printf '%s\n' "$itr_stats" | sed -n 's/^BY_STATUS:.*[[:space:]]open=\([0-9][0-9]*\).*/\1/p' | head -1)"
    [ -n "$parsed" ] && tracker_open="$parsed"
  else
    tracker="itr-no-db"
  fi
fi
printf 'tracker: %s\n' "$tracker"
printf 'tracker-open: %s\n' "$tracker_open"

if have kgr; then printf 'kgr: present\n'; else printf 'kgr: absent\n'; fi
if have gatr; then printf 'gatr: present\n'; else printf 'gatr: absent\n'; fi

if detect_verify_gate; then
  printf 'verify-gate: %s\n' "$GATE"
else
  printf 'verify-gate: missing\n'
fi
printf 'verify-gate-source: %s\n' "$GATE_SOURCE"

# --- project conventions -----------------------------------------------------
if [ -f STORY_STYLE.md ]; then printf 'story-style: STORY_STYLE.md\n'; else printf 'story-style: absent\n'; fi
if [ -f docs/ROADMAP.md ]; then printf 'roadmap: docs/ROADMAP.md\n'
elif [ -f ROADMAP.md ]; then printf 'roadmap: ROADMAP.md\n'
else printf 'roadmap: absent\n'
fi

# --- sprint state ------------------------------------------------------------
# Next number: the filesystem first (sprint/sprint-N-*), then the tracker's
# sprint-N tags, else sprint-1.
max_sprint=0
if [ -d sprint ]; then
  for d in sprint/sprint-*/; do
    [ -d "$d" ] || continue
    n="$(basename "$d" | sed -n 's/^sprint-\([0-9][0-9]*\).*/\1/p')"
    [ -n "$n" ] && [ "$n" -gt "$max_sprint" ] && max_sprint="$n"
  done
fi
if [ "$max_sprint" -eq 0 ] && [ "$tracker" = "itr" ]; then
  for n in $(itr search "sprint-" -f json --fields tags 2>/dev/null | grep -oE 'sprint-[0-9]+' | sed 's/^sprint-//' | sort -u); do
    [ "$n" -gt "$max_sprint" ] && max_sprint="$n"
  done
fi
printf 'sprint-next: sprint-%s\n' "$((max_sprint + 1))"

sprint_current=""
if [ -f sprint/CURRENT ]; then
  sprint_current="$(sed -n '1p' sprint/CURRENT 2>/dev/null | tr -d '\r')"
fi
if [ -n "$sprint_current" ]; then
  printf 'sprint-current: %s\n' "$sprint_current"
  if [ -d "sprint/$sprint_current" ]; then printf 'sprint-current-valid: yes\n'; else printf 'sprint-current-valid: no\n'; fi
  # Reviewed = the Outcomes section holds a line that is not the placeholder
  # /sprint writes. No plan.md is treated as not reviewed (still in flight).
  reviewed="no"
  plan="sprint/$sprint_current/plan.md"
  if [ -f "$plan" ]; then
    body="$(tr -d '\r' < "$plan" | awk '
      /^## Outcomes[[:space:]]*$/ { inside = 1; next }
      inside && /^## / { inside = 0 }
      inside && $0 !~ /^[[:space:]]*$/ && $0 != "<!-- Populated by /sprint-review after /blitz runs. -->" { print }
    ')"
    [ -n "$body" ] && reviewed="yes"
  fi
  printf 'sprint-current-reviewed: %s\n' "$reviewed"
else
  printf 'sprint-current: absent\nsprint-current-valid: no\nsprint-current-reviewed: no\n'
fi

# --- another blitz in this tree? ---------------------------------------------
# The signal is a wave log with no `Blitz complete` line. Outcomes fills wave by
# wave, so "Outcomes is empty" would miss almost every live run.
log_folder="$sprint_current"
if [ -z "$log_folder" ] && [ "$head_sha" != "none" ]; then
  # sprint/CURRENT deleted in the working tree: read the committed one.
  log_folder="$(git show HEAD:sprint/CURRENT 2>/dev/null | sed -n '1p' | tr -d '\r')"
fi
for f in ${log_folder:+"sprint/$log_folder/blitz"/wave-*.md} sprint/_unscoped/blitz-*.md; do
  [ -f "$f" ] || continue
  grep -q 'Blitz complete' "$f" 2>/dev/null || printf 'unfinished-wave-log: %s\n' "$f"
done

# --- stale tickets -----------------------------------------------------------
# A commit that says `closes #N` does not close N in itr. List every N a recent
# commit claims to have closed that the tracker still holds open.
if [ "$tracker" = "itr" ] && [ "$head_sha" != "none" ]; then
  seen=" "
  for sha in $(git log --since="$SINCE_DAYS days ago" --format='%h' -i -E \
      --grep='(closes?|fix(es)?|resolves?)[[:space:]]+#[0-9]+' 2>/dev/null); do
    subject="$(git log -1 --format='%s' "$sha" 2>/dev/null)"
    for id in $(git log -1 --format='%B' "$sha" 2>/dev/null \
        | grep -oiE '(closes?|fix(es)?|resolves?)[[:space:]]+#[0-9]+' | grep -oE '[0-9]+$'); do
      case "$seen" in *" $id "*) continue ;; esac
      seen="$seen$id "
      if itr get "$id" -f json --fields id,status 2>/dev/null | grep -Eq '"status"[[:space:]]*:[[:space:]]*"open"'; then
        printf 'stale-ticket: #%s %s %s\n' "$id" "$sha" "$subject"
      fi
    done
  done
fi

exit 0
