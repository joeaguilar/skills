#!/usr/bin/env python3
"""gitea: helper CLI for a self-hosted Gitea.

Git traffic goes over SSH (no token needed); everything else uses the REST API.

Config (env var > KEY=VALUE line in ~/.config/gitea/config > derived default):
  GITEA_SSH_HOST  ~/.ssh/config alias for the server       default: gitea
  GITEA_URL       web/API base URL                         default: http://<alias HostName>:3000
  GITEA_OWNER     owner for bare repo names                default: token user, else SSH greeting
  GITEA_TOKEN     API token                                default: first line of ~/.config/gitea/token

Only `repos`, `create`, `pr` and `api` need a token. Stdlib only, Python 3.8+.
"""

import argparse
import fnmatch
import http.client
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

CONFIG_DIR = Path.home() / ".config" / "gitea"
PROTECTED = ("main", "master")

TOKEN_HELP = """no Gitea API token found (only repos/create/pr/api need one).
  1. Open {url}/user/settings/applications and generate a token with scopes:
     repository: read and write, user: read, issue: read and write, organization: read
  2. Save it as a single line in ~/.config/gitea/token (or export GITEA_TOKEN).
  3. Check it with: gitea doctor"""


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message

    def __str__(self):
        return f"HTTP {self.status}: {self.message}" if self.status else self.message


def note(msg):
    """Hint on stderr, after any stdout output it describes."""
    sys.stdout.flush()
    print(msg, file=sys.stderr)


def die(msg, code=1):
    print(f"gitea: {msg}", file=sys.stderr)
    sys.exit(code)


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")


def passthrough(cmd):
    note("+ " + " ".join(cmd))
    return subprocess.run(cmd).returncode


def table(rows, headers):
    rows = [tuple(str(c) for c in r) for r in rows]
    if not rows:
        return
    widths = [max(len(r[i]) for r in rows + [headers]) for i in range(len(headers))]
    for r in [headers] + rows:
        cells = [c.ljust(widths[i]) for i, c in enumerate(r[:-1])] + [r[-1]]
        print("  ".join(cells).rstrip())


def clip(text, n):
    text = (text or "").replace("\n", " ").strip()
    return text if len(text) <= n else text[: n - 1] + "…"


# --- config ------------------------------------------------------------------


class Config:
    def __init__(self):
        self._file = {}
        path = CONFIG_DIR / "config"
        if path.is_file():
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    self._file[key.strip()] = value.strip().strip("\"'")
        self.ssh_host = self._get("GITEA_SSH_HOST") or "gitea"
        self._ssh = None
        self._url = None
        self._token = None
        self.token_source = None
        self._owner = None
        self._me = None

    def _get(self, key):
        return os.environ.get(key) or self._file.get(key)

    @property
    def ssh(self):
        """Resolved `ssh -G <alias>` settings (hostname, port, user)."""
        if self._ssh is None:
            self._ssh = {}
            for line in run(["ssh", "-G", self.ssh_host]).stdout.splitlines():
                parts = line.split(None, 1)
                if len(parts) == 2:
                    self._ssh.setdefault(parts[0].lower(), parts[1])
        return self._ssh

    @property
    def url(self):
        if self._url is None:
            url = self._get("GITEA_URL")
            if not url:
                url = f"http://{self.ssh.get('hostname') or self.ssh_host}:3000"
            self._url = url.rstrip("/")
        return self._url

    @property
    def token(self):
        if self._token is None:
            self._token = os.environ.get("GITEA_TOKEN", "").strip()
            self.token_source = "GITEA_TOKEN" if self._token else None
            path = CONFIG_DIR / "token"
            if not self._token and path.is_file():
                lines = path.read_text(encoding="utf-8").strip().splitlines()
                self._token = lines[0].strip() if lines else ""
                self.token_source = str(path) if self._token else None
        return self._token

    def hosts(self):
        """Every hostname a remote URL may use to point at this server."""
        names = {self.ssh_host, self.ssh.get("hostname", ""), urllib.parse.urlparse(self.url).hostname or ""}
        return {n.lower() for n in names if n}

    def me(self):
        if self._me is None:
            self._me = api(self, "GET", "/user")["login"]
        return self._me

    def ssh_login(self):
        """Parse the user name out of Gitea's `ssh -T` greeting; None when auth fails."""
        r = run(["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", "-T", self.ssh_host])
        m = re.search(r"Hi there, ([^!\s]+)!", r.stdout + r.stderr)
        return m.group(1) if m else None

    @property
    def owner(self):
        if self._owner is None:
            owner = self._get("GITEA_OWNER")
            if not owner and self.token:
                try:
                    owner = self.me()
                except ApiError:
                    owner = None
            self._owner = owner or self.ssh_login()
            if not self._owner:
                die("cannot determine the repo owner; pass owner/name or set GITEA_OWNER")
        return self._owner


# --- HTTP API ----------------------------------------------------------------


def _request(cfg, method, path, data=None, accept="application/json"):
    msys_root = os.environ.get("GITEA_MSYS_ROOT", "").rstrip("/")
    if msys_root and path.lower().startswith(msys_root.lower() + "/"):
        path = path[len(msys_root):]
    path = urllib.parse.quote(re.sub(r"^/?(api/v1)?/?", "/", path), safe="/?&=%:,+@~")
    headers = {"Accept": accept, "User-Agent": "gitea-skill"}
    if cfg.token:
        headers["Authorization"] = "token " + cfg.token
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(cfg.url + "/api/v1" + path, data=body, method=method.upper(), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.headers, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", "replace")
        try:
            message = json.loads(text).get("message") or text
        except (ValueError, AttributeError):
            message = text
        message = message.strip() or str(e.reason)
        if e.code in (401, 403) and not cfg.token:
            message += "\n" + TOKEN_HELP.format(url=cfg.url)
        elif e.code == 404 and not cfg.token:
            message += " (private repos also look like 404 without a token)"
        raise ApiError(e.code, message)
    except urllib.error.URLError as e:
        raise ApiError(None, f"cannot reach {cfg.url} ({e.reason}); is the server up and are you on its network?")
    except (http.client.HTTPException, ValueError) as e:
        raise ApiError(None, f"bad request {method.upper()} {path}: {e}")


def api(cfg, method, path, data=None, need_token=True, raw=False):
    if need_token and not cfg.token:
        die(TOKEN_HELP.format(url=cfg.url))
    _, text = _request(cfg, method, path, data, accept="*/*" if raw else "application/json")
    if raw:
        return text
    return json.loads(text) if text.strip() else None


def api_pages(cfg, path, params=None, limit=50):
    if not cfg.token:
        die(TOKEN_HELP.format(url=cfg.url))
    items, page = [], 1
    while page <= 200:
        query = urllib.parse.urlencode(dict(params or {}, limit=limit, page=page))
        headers, text = _request(cfg, "GET", f"{path}?{query}")
        batch = json.loads(text) if text.strip() else []
        items.extend(batch)
        total = headers.get("X-Total-Count")
        done = int(total) <= len(items) if total else len(batch) < limit
        if not batch or done:
            break
        page += 1
    return items


# --- repos and remotes -------------------------------------------------------


def parse_remote_url(cfg, url):
    """(owner, name) when `url` points at this Gitea, else None."""
    m = re.match(r"^(?:ssh|git|https?)://(?:[^@/]+@)?([^/:]+)(?::\d+)?/(?:.*/)?([^/]+)/([^/]+?)(?:\.git)?/?$", url)
    if not m:
        m = re.match(r"^(?:[^@/]+@)?([^/:]+):(?!//)([^/]+)/([^/]+?)(?:\.git)?/?$", url)
    if m and m.group(1).lower() in cfg.hosts():
        return m.group(2), m.group(3)
    return None


def split_repo(cfg, spec):
    spec = spec.strip()
    parsed = parse_remote_url(cfg, spec)
    if parsed:
        return parsed
    spec = re.sub(r"\.git$", "", spec.strip("/"))
    if "/" in spec:
        owner, name = spec.split("/", 1)
        return owner, name
    return cfg.owner, spec


def ssh_url(cfg, owner, name):
    return f"{cfg.ssh_host}:{owner}/{name}.git"


def web_url(cfg, owner, name):
    return f"{cfg.url}/{owner}/{name}"


def local_remote(cfg, required=True):
    """(remote, owner, name) for the cwd repo's Gitea remote, preferring `origin`."""
    r = run(["git", "remote", "-v"])
    found = {}
    if r.returncode == 0:
        for line in r.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 2 and parts[0] not in found:
                parsed = parse_remote_url(cfg, parts[1])
                if parsed:
                    found[parts[0]] = parsed
    if not found:
        if required:
            die("not inside a git repo with a Gitea remote; cd into a clone or name the repo (pr: --repo owner/name)")
        return None
    remote = "origin" if "origin" in found else sorted(found)[0]
    return (remote,) + found[remote]


def repo_for_api(cfg, args):
    if getattr(args, "repo", None):
        return split_repo(cfg, args.repo)
    return local_remote(cfg)[1:]


def current_branch():
    r = run(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    if r.returncode != 0 or r.stdout.strip() == "HEAD":
        die("cannot tell the current branch (detached HEAD or not a git repo)")
    return r.stdout.strip()


def default_branch(remote):
    r = run(["git", "symbolic-ref", "--short", f"refs/remotes/{remote}/HEAD"])
    if r.returncode == 0 and r.stdout.strip():
        return r.stdout.strip().split("/", 1)[1]
    r = run(["git", "ls-remote", "--symref", remote, "HEAD"])
    m = re.search(r"^ref: refs/heads/(\S+)\s+HEAD", r.stdout, re.M)
    return m.group(1) if m else "main"


def add_remote(cfg, owner, name, remote=None):
    if run(["git", "rev-parse", "--git-dir"]).returncode != 0:
        die("not inside a git repo")
    existing = run(["git", "remote"]).stdout.split()
    url = ssh_url(cfg, owner, name)
    if not remote:
        for other in existing:
            parsed = parse_remote_url(cfg, run(["git", "remote", "get-url", other]).stdout.strip())
            if parsed and (parsed[0].lower(), parsed[1].lower()) == (owner.lower(), name.lower()):
                print(f"remote {other} already points at {owner}/{name}")
                return other
        remote = "gitea" if "origin" in existing else "origin"
    if remote in existing:
        current = run(["git", "remote", "get-url", remote]).stdout.strip()
        if current == url:
            print(f"remote {remote} already points at {url}")
            return remote
        die(f"remote {remote} already points at {current}; pass --name, or run: git remote set-url {remote} {url}")
    if run(["git", "remote", "add", remote, url]).returncode != 0:
        die(f"git remote add {remote} {url} failed")
    print(f"added remote {remote} -> {url}")
    return remote


def branch_report(remote, base):
    """Remote branches newest first, each with ahead/behind counts against `base`."""
    prefix = f"refs/remotes/{remote}/"
    fmt = "%(refname)%09%(objectname:short)%09%(committerdate:short)%09%(subject)"
    out = run(["git", "for-each-ref", "--sort=-committerdate", f"--format={fmt}", prefix.rstrip("/")]).stdout
    rows = []
    for line in out.splitlines():
        ref, sha, date, subject = (line.split("\t", 3) + [""] * 4)[:4]
        branch = ref[len(prefix):]
        if not ref.startswith(prefix) or branch == "HEAD":
            continue
        if branch == base:
            behind = ahead = 0
            status = "default"
        else:
            counts = run(["git", "rev-list", "--left-right", "--count", f"{prefix}{base}...{ref}"]).stdout.split()
            behind, ahead = (int(counts[0]), int(counts[1])) if len(counts) == 2 else (-1, -1)
            status = "merged" if ahead == 0 else "unmerged"
        rows.append({"branch": branch, "status": status, "ahead": ahead, "behind": behind,
                     "date": date, "sha": sha, "subject": subject})
    return rows


def fetch(remote):
    r = run(["git", "fetch", remote, "--prune", "--quiet"])
    if r.returncode != 0:
        note(f"gitea: warning: git fetch {remote} failed, using cached refs\n{r.stderr.strip()}")


# --- subcommands -------------------------------------------------------------


def cmd_doctor(cfg, args):
    ok = True
    ssh = cfg.ssh
    print(f"ssh alias   {cfg.ssh_host} -> {ssh.get('user', '?')}@{ssh.get('hostname', '?')}:{ssh.get('port', '22')}")
    login = cfg.ssh_login()
    print(f"ssh auth    {'ok, signed in as ' + login if login else 'FAILED (try: ssh -T ' + cfg.ssh_host + ')'}")
    ok &= bool(login)
    print(f"web/api     {cfg.url}")
    try:
        version = api(cfg, "GET", "/version", need_token=False)["version"]
        print(f"server      Gitea {version}")
    except ApiError as e:
        print(f"server      UNREACHABLE: {e}")
        ok = False
    if cfg.token:
        try:
            print(f"token       ok, user {cfg.me()} (from {cfg.token_source})")
        except ApiError as e:
            print(f"token       REJECTED from {cfg.token_source}: {e}")
            ok = False
    else:
        print("token       none; SSH commands work, API commands will not")
        print("            " + TOKEN_HELP.format(url=cfg.url).replace("\n", "\n            "))
    owner = cfg._get("GITEA_OWNER") or (cfg._me if cfg._me else login)
    print(f"owner       {owner or '?'} (default for bare repo names)")
    here = local_remote(cfg, required=False)
    if here:
        print(f"this repo   {here[1]}/{here[2]} via remote '{here[0]}'")
    return 0 if ok else 1


def cmd_repos(cfg, args):
    repos = api_pages(cfg, "/user/repos")
    if args.filter:
        needle = args.filter.lower()
        repos = [r for r in repos if needle in r["full_name"].lower() or needle in (r.get("description") or "").lower()]
    repos.sort(key=lambda r: r.get("updated_at") or "", reverse=True)
    if args.json:
        keys = ("full_name", "private", "default_branch", "updated_at", "description", "archived", "mirror", "fork")
        print(json.dumps([{k: r.get(k) for k in keys} for r in repos], indent=2))
        return 0
    rows = []
    for r in repos:
        flags = ["private" if r.get("private") else "public"] + [f for f in ("archived", "mirror", "fork") if r.get(f)]
        rows.append((r["full_name"], ",".join(flags), r.get("default_branch") or "",
                     (r.get("updated_at") or "")[:10], clip(r.get("description"), 60)))
    table(rows, ("REPO", "FLAGS", "DEFAULT", "UPDATED", "DESCRIPTION"))
    note(f"{len(rows)} repos")
    return 0


def cmd_exists(cfg, args):
    owner, name = split_repo(cfg, args.repo)
    r = run(["git", "ls-remote", "--heads", ssh_url(cfg, owner, name)])
    if r.returncode == 0:
        count = len(r.stdout.splitlines())
        print(f"{owner}/{name}: exists ({count} branch{'es' if count != 1 else ''})")
        return 0
    note(f"{owner}/{name}: not found, or no access ({clip(r.stderr, 200)})")
    return 1


def cmd_url(cfg, args):
    owner, name = split_repo(cfg, args.repo) if args.repo else local_remote(cfg)[1:]
    print(web_url(cfg, owner, name) if args.web else ssh_url(cfg, owner, name))
    return 0


def cmd_clone(cfg, args):
    owner, name = split_repo(cfg, args.repo)
    url = ssh_url(cfg, owner, name)
    probe = run(["git", "ls-remote", "--heads", url])
    if probe.returncode != 0:
        die(f"{owner}/{name} not found on {cfg.ssh_host}, or no access:\n{probe.stderr.strip()}")
    cmd = ["git", "clone"]
    if args.branch:
        cmd += ["--branch", args.branch]
    if args.depth:
        cmd += ["--depth", str(args.depth)]
    cmd.append(url)
    if args.dir:
        cmd.append(args.dir)
    return passthrough(cmd)


def cmd_remote(cfg, args):
    owner, name = split_repo(cfg, args.repo)
    add_remote(cfg, owner, name, args.name)
    return 0


def cmd_create(cfg, args):
    owner, name = split_repo(cfg, args.name)
    payload = {"name": name, "private": not args.public, "description": args.description or "", "auto_init": False}
    path = "/user/repos" if owner.lower() == cfg.me().lower() else f"/orgs/{owner}/repos"
    repo = api(cfg, "POST", path, payload)
    print(f"created {repo['full_name']} ({'private' if repo.get('private') else 'public'}) {repo['html_url']}")
    print(f"clone url: {ssh_url(cfg, owner, name)}")
    if args.remote or args.push:
        remote = add_remote(cfg, owner, name, args.remote_name)
        if args.push:
            return passthrough(["git", "push", "-u", remote, current_branch()])
    return 0


def cmd_branches(cfg, args):
    if args.repo:
        owner, name = split_repo(cfg, args.repo)
        r = run(["git", "ls-remote", "--symref", ssh_url(cfg, owner, name)])
        if r.returncode != 0:
            die(f"{owner}/{name} not found, or no access:\n{r.stderr.strip()}")
        m = re.search(r"^ref: refs/heads/(\S+)\s+HEAD", r.stdout, re.M)
        default = m.group(1) if m else None
        rows = []
        for line in r.stdout.splitlines():
            sha, _, ref = line.partition("\t")
            if ref.startswith("refs/heads/"):
                branch = ref[len("refs/heads/"):]
                rows.append((branch, "default" if branch == default else "", sha[:7]))
        table(rows, ("BRANCH", "NOTE", "SHA"))
        note("(dates and merge status need a clone: run `gitea branches` inside it)")
        return 0
    remote = local_remote(cfg)[0]
    fetch(remote)
    base = args.base or default_branch(remote)
    rows = branch_report(remote, base)
    if args.unmerged:
        rows = [r for r in rows if r["status"] == "unmerged"]
    if args.json:
        print(json.dumps({"remote": remote, "base": base, "branches": rows}, indent=2))
        return 0
    if not rows:
        print(f"no {'unmerged ' if args.unmerged else ''}branches on {remote} besides {base}")
        return 0
    table([(r["branch"], r["status"], r["ahead"], r["behind"], r["date"], r["sha"], clip(r["subject"], 70))
           for r in rows], ("BRANCH", "STATUS", "AHEAD", "BEHIND", "DATE", "SHA", "SUBJECT"))
    note(f"(ahead/behind vs {remote}/{base}; 'merged' = no commits missing from {base})")
    return 0


def cmd_prune_merged(cfg, args):
    remote, owner, name = local_remote(cfg)
    fetch(remote)
    base = args.base or default_branch(remote)
    keep = set(PROTECTED) | {base} | set(args.keep or [])
    candidates = [r["branch"] for r in branch_report(remote, base) if r["status"] == "merged"]
    candidates = [b for b in candidates if not any(fnmatch.fnmatch(b, k) for k in keep)]
    if args.match:
        candidates = [b for b in candidates if fnmatch.fnmatch(b, args.match)]
    if cfg.token:
        open_heads = {p["head"]["ref"] for p in api_pages(cfg, f"/repos/{owner}/{name}/pulls", {"state": "open"})}
        skipped = [b for b in candidates if b in open_heads]
        candidates = [b for b in candidates if b not in open_heads]
        for b in skipped:
            note(f"keeping {b}: it is the head of an open PR")
    else:
        note("(no token: cannot check for open PRs on these branches)")
    if not candidates:
        print(f"no merged branches to delete on {remote} (base {base})")
        return 0
    print(f"branches on {remote} fully merged into {base}:")
    for b in candidates:
        print(f"  {b}")
    if not args.apply:
        print(f"dry run; rerun with --apply to run: git push {remote} --delete {' '.join(candidates)}")
        return 0
    rc = passthrough(["git", "push", remote, "--delete"] + candidates)
    fetch(remote)
    return rc


def cmd_pr(cfg, args):
    owner, name = repo_for_api(cfg, args)
    base_path = f"/repos/{owner}/{name}/pulls"

    if args.pr_cmd == "list":
        prs = api_pages(cfg, base_path, {"state": args.state, "sort": "recentupdate"})
        rows = [("#%d" % p["number"], "merged" if p.get("merged") else p["state"],
                 f"{p['head']['ref']} -> {p['base']['ref']}", p["user"]["login"],
                 (p.get("updated_at") or "")[:10], clip(p["title"], 70)) for p in prs]
        table(rows, ("PR", "STATE", "BRANCHES", "AUTHOR", "UPDATED", "TITLE"))
        if not rows:
            print(f"no {'' if args.state == 'all' else args.state + ' '}PRs on {owner}/{name}")
        return 0

    if args.pr_cmd == "view":
        p = api(cfg, "GET", f"{base_path}/{args.number}")
        state = "merged" if p.get("merged") else p["state"]
        print(f"#{p['number']} {p['title']}")
        print(f"state      {state}{'' if p.get('mergeable', True) else ' (not mergeable: conflicts)'}")
        print(f"branches   {p['head']['label']} -> {p['base']['ref']}")
        print(f"author     {p['user']['login']}, opened {(p.get('created_at') or '')[:10]}")
        print(f"url        {p['html_url']}")
        if p.get("body"):
            print("\n" + p["body"])
        return 0

    if args.pr_cmd == "diff":
        sys.stdout.write(api(cfg, "GET", f"/repos/{owner}/{name}/pulls/{args.number}.diff", raw=True))
        return 0

    if args.pr_cmd == "create":
        here = local_remote(cfg, required=False)
        head = args.head or current_branch()
        if args.push:
            if not here:
                die("--push needs a local clone with a Gitea remote")
            if passthrough(["git", "push", "-u", here[0], head]) != 0:
                die(f"git push {here[0]} {head} failed")
        elif here and ":" not in head:
            if not run(["git", "ls-remote", "--heads", here[0], head]).stdout.strip():
                die(f"branch {head} is not on {here[0]}; push it first or pass --push")
        base = args.base or api(cfg, "GET", f"/repos/{owner}/{name}")["default_branch"]
        title = args.title
        if not title:
            r = run(["git", "log", "-1", "--format=%s", head])
            title = r.stdout.strip() if r.returncode == 0 else None
            if not title:
                die("pass --title (could not read the head branch's last commit subject)")
        body = args.body or ""
        if args.body_file:
            body = Path(args.body_file).read_text(encoding="utf-8")
        p = api(cfg, "POST", base_path, {"head": head, "base": base, "title": title, "body": body})
        print(f"opened #{p['number']} {head} -> {base}: {p['html_url']}")
        return 0

    if args.pr_cmd == "merge":
        payload = {"Do": args.style, "delete_branch_after_merge": args.delete_branch}
        if args.message:
            payload["MergeMessageField"] = args.message
        api(cfg, "POST", f"{base_path}/{args.number}/merge", payload)
        print(f"merged #{args.number} into {owner}/{name} ({args.style})"
              + (", head branch deleted" if args.delete_branch else ""))
        return 0
    return 2


def cmd_api(cfg, args):
    data = None
    if args.data:
        raw = Path(args.data[1:]).read_text(encoding="utf-8") if args.data.startswith("@") else args.data
        data = json.loads(raw)
    text = api(cfg, args.method, args.path, data, need_token=False, raw=True)
    try:
        print(json.dumps(json.loads(text), indent=2))
    except ValueError:
        sys.stdout.write(text)
    return 0


# --- CLI ---------------------------------------------------------------------


def build_parser():
    p = argparse.ArgumentParser(prog="gitea", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("doctor", help="check SSH, server, token, owner (run first)")

    s = sub.add_parser("repos", help="list repos you can access [token]")
    s.add_argument("filter", nargs="?", help="substring of name or description")
    s.add_argument("--json", action="store_true")

    s = sub.add_parser("exists", help="does the repo exist (exit 0) or not (exit 1)")
    s.add_argument("repo")

    s = sub.add_parser("url", help="print the SSH clone URL (or --web link)")
    s.add_argument("repo", nargs="?", help="default: this clone's Gitea remote")
    s.add_argument("--web", action="store_true")

    s = sub.add_parser("clone", help="clone a repo over SSH")
    s.add_argument("repo")
    s.add_argument("dir", nargs="?")
    s.add_argument("--branch", "-b")
    s.add_argument("--depth", type=int)

    s = sub.add_parser("remote", help="add a Gitea remote to the current repo")
    s.add_argument("repo")
    s.add_argument("--name", help="remote name (default: origin, or gitea if origin exists)")

    s = sub.add_parser("create", help="create a repo, optionally add it as a remote and push [token]")
    s.add_argument("name", help="name or owner/name (org owner creates under the org)")
    s.add_argument("--public", action="store_true", help="default is private")
    s.add_argument("--description", "-d")
    s.add_argument("--remote", action="store_true", help="add it as a remote of the current repo")
    s.add_argument("--remote-name")
    s.add_argument("--push", action="store_true", help="add the remote and push the current branch")

    s = sub.add_parser("branches", help="remote branches newest first, with merged/unmerged status")
    s.add_argument("repo", nargs="?", help="list a repo without cloning (names only)")
    s.add_argument("--base", help="compare against this branch (default: remote default)")
    s.add_argument("--unmerged", action="store_true", help="only branches with commits missing from base")
    s.add_argument("--json", action="store_true")

    s = sub.add_parser("prune-merged", help="delete remote branches already merged into base (dry run by default)")
    s.add_argument("--base")
    s.add_argument("--match", help="only branches matching this glob, e.g. 'worktree-agent-*'")
    s.add_argument("--keep", action="append", help="glob to never delete (repeatable)")
    s.add_argument("--apply", action="store_true", help="actually delete")

    s = sub.add_parser("pr", help="pull requests: list, view, diff, create, merge [token]")
    pr = s.add_subparsers(dest="pr_cmd", required=True)
    t = pr.add_parser("list")
    t.add_argument("--state", choices=("open", "closed", "all"), default="open")
    t = pr.add_parser("view")
    t.add_argument("number", type=int)
    t = pr.add_parser("diff")
    t.add_argument("number", type=int)
    t = pr.add_parser("create")
    t.add_argument("--title", "-t", help="default: head branch's last commit subject")
    t.add_argument("--body", "-b")
    t.add_argument("--body-file")
    t.add_argument("--head", help="default: current branch")
    t.add_argument("--base", help="default: repo default branch")
    t.add_argument("--push", action="store_true", help="push the head branch first")
    t = pr.add_parser("merge")
    t.add_argument("number", type=int)
    t.add_argument("--style", choices=("merge", "rebase", "rebase-merge", "squash", "fast-forward-only"), default="merge")
    t.add_argument("--delete-branch", action="store_true")
    t.add_argument("--message", "-m")
    for t in pr.choices.values():
        t.add_argument("--repo", help="owner/name (default: this clone's Gitea remote)")

    s = sub.add_parser("api", help="raw API call, e.g. api GET /repos/OWNER/NAME/issues")
    s.add_argument("method", type=str.upper, choices=("GET", "POST", "PATCH", "PUT", "DELETE"))
    s.add_argument("path", help="path under /api/v1")
    s.add_argument("--data", help="JSON body, or @file.json")
    return p


COMMANDS = {"doctor": cmd_doctor, "repos": cmd_repos, "exists": cmd_exists, "url": cmd_url,
            "clone": cmd_clone, "remote": cmd_remote, "create": cmd_create, "branches": cmd_branches,
            "prune-merged": cmd_prune_merged, "pr": cmd_pr, "api": cmd_api}


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    args = build_parser().parse_args(argv)
    try:
        return COMMANDS[args.cmd](Config(), args)
    except ApiError as e:
        die(str(e))
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
