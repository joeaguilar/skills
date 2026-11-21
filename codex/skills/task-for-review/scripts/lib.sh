#!/usr/bin/env bash
# lib.sh — what the task-for-review scripts agree on. Source it; it prints nothing.
#
# One copy of: which host a remote is on, where that host's web pages live, which
# branch is main, and which remote is the default. Test hooks: TFR_GITEA names the
# gitea helper, TFR_GITEA_HOST the Gitea server's hostname.

TFR_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

# The line that opts a project in. seed.sh writes it; preflight.sh looks for it.
TFR_OPT_IN_LINE='This project works in task-for-review mode: load the task-for-review skill before changing any tracked file.'

tfr_has_opt_in() { # file... -> 0 when one of them holds the whole opt-in sentence
  grep -qsF -- "$TFR_OPT_IN_LINE" "$@"
}

tfr_url_host() { # remote url -> lower-case hostname; empty for a local path
  local u="$1"
  case "$u" in
    file://*|/*|./*|../*|'~'*) u="" ;;                               # a path, whatever it contains
    [A-Za-z]:[/\\]*) u="" ;;                                         # C:/path or C:\path: a drive, not a host
    *://*) u="${u#*://}"; u="${u%%/*}"; u="${u##*@}"; u="${u%%:*}" ;;
    *:*)   u="${u%%:*}"                                               # scp style host:path, unless…
           case "$u" in */*) u="" ;; esac                            # …a slash comes first: git reads that as a path
           u="${u##*@}" ;;
    *)     u="" ;;
  esac
  printf '%s' "$u" | tr '[:upper:]' '[:lower:]'
}

tfr_url_path() { # remote url -> owner/repo: no scheme, host, port, leading or trailing slash, or .git
  local p="$1"
  case "$p" in
    *://*) p="${p#*://}"; case "$p" in */*) p="${p#*/}" ;; *) p="" ;; esac ;;   # drop user@host:port
    *:*)   p="${p#*:}" ;;                                                       # scp style host:path
  esac
  while [ "${p%/}" != "$p" ]; do p="${p%/}"; done
  p="${p%.git}"
  while [ "${p#/}" != "$p" ]; do p="${p#/}"; done
  printf '%s' "$p"
}

tfr_urlencode_path() { # path -> the same path with every byte a URL could misread percent-encoded
  local LC_ALL=C s="$1" out="" c i
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9._~/-]) out="$out$c" ;;
      *) out="$out$(printf '%%%02X' "'$c")" ;;
    esac
  done
  printf '%s' "$out"
}

tfr_gitea_host() { # hostname behind the `gitea` SSH alias
  if [ -z "${TFR_GITEA_HOST_CACHE+x}" ]; then
    TFR_GITEA_HOST_CACHE="${TFR_GITEA_HOST:-}"
    if [ -z "$TFR_GITEA_HOST_CACHE" ] && command -v ssh >/dev/null 2>&1; then
      TFR_GITEA_HOST_CACHE="$(ssh -G gitea 2>/dev/null | awk '$1 == "hostname" { print $2; exit }')"
    fi
  fi
  printf '%s' "$TFR_GITEA_HOST_CACHE"
}

tfr_remote_kind() { # remote url -> github | gitea | other | local
  local host gitea_host
  host="$(tfr_url_host "$1")"
  tfr_gitea_host >/dev/null   # fill the cache in this shell, not in a subshell
  gitea_host="$TFR_GITEA_HOST_CACHE"
  if [ -z "$host" ]; then echo local
  elif [ "$host" = "github.com" ]; then echo github
  elif [ "$host" = "gitea" ] || { [ -n "$gitea_host" ] && [ "$host" = "$gitea_host" ]; }; then echo gitea
  else echo other
  fi
}

tfr_gitea_bin() { printf '%s' "${TFR_GITEA:-$TFR_LIB_DIR/../../gitea/scripts/gitea}"; }
tfr_have_gitea_bin() {
  local bin
  bin="$(tfr_gitea_bin)"
  [ -f "$bin" ] || command -v "$bin" >/dev/null 2>&1
}

tfr_web_base() { # remote url -> https://host/owner/repo; empty when the host has no known web UI
  local url="$1" slug web
  case "$(tfr_remote_kind "$url")" in
    github)
      slug="$(tfr_url_path "$url")"
      [ -n "$slug" ] && printf 'https://github.com/%s' "$slug"
      ;;
    gitea)
      if tfr_have_gitea_bin; then
        web="$("$(tfr_gitea_bin)" url "$url" --web 2>/dev/null | head -1 || true)"
        case "$web" in http*) printf '%s' "${web%/}" ;; esac
      fi
      ;;
  esac
}

tfr_main_branch() { # the branch reviewed PRs merge into; empty when it cannot be told
  local b
  b="$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')"
  if [ -z "$b" ]; then
    if git show-ref --verify -q refs/heads/main; then b="main"
    elif git show-ref --verify -q refs/heads/master; then b="master"
    fi
  fi
  printf '%s' "$b"
}

tfr_default_remote() { # origin when it exists, else the first remote, else empty
  if git remote 2>/dev/null | grep -qxF origin; then echo origin; else git remote 2>/dev/null | head -1; fi
}
