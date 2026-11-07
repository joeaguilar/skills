#!/usr/bin/env python3
"""Tests for `gitea ship` (claude/skills/gitea/scripts/gitea.py). Stdlib only.

Every repo is built in a temp dir with bare-repo remotes. Git is isolated from the
real machine: GIT_CONFIG_GLOBAL points at a temp file holding the intended identity
and an empty core.hooksPath, and GIT_CONFIG_NOSYSTEM=1 hides the system config.
"""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

GITEA = Path(__file__).resolve().parent.parent / "skills" / "gitea" / "scripts" / "gitea.py"
NAME, EMAIL = "Tester", "tester@example.com"


class ShipCase(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="ship-test-"))
        hooks = self.tmp / "nohooks"
        hooks.mkdir()
        self.gcfg = self.tmp / "gitconfig"
        self.gcfg.write_text(
            f"[user]\n\tname = {NAME}\n\temail = {EMAIL}\n[core]\n\thooksPath = {hooks.as_posix()}\n"
            "[init]\n\tdefaultBranch = main\n[protocol \"file\"]\n\tallow = always\n",
            encoding="utf-8")
        self.env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
        self.env.update(GIT_CONFIG_GLOBAL=str(self.gcfg), GIT_CONFIG_NOSYSTEM="1",
                        GIT_TERMINAL_PROMPT="0")
        self.repo = self.tmp / "work"
        self.repo.mkdir()
        self.git("init", "-q")
        self.commit("first")

    def tearDown(self):
        def onerr(fn, path, _):
            os.chmod(path, 0o700)
            fn(path)
        shutil.rmtree(self.tmp, onerror=onerr)

    def git(self, *a, cwd=None, env=None, check=True):
        r = subprocess.run(["git", *a], cwd=cwd or self.repo, env=env or self.env,
                           capture_output=True, text=True)
        if check and r.returncode != 0:
            raise AssertionError(f"git {a} failed: {r.stderr}")
        return r

    def commit(self, msg, repo=None, **extra_env):
        repo = repo or self.repo
        f = repo / f"{msg.replace(' ', '_')}.txt"
        f.write_text(msg, encoding="utf-8")
        self.git("add", ".", cwd=repo)
        env = dict(self.env, **extra_env)
        self.git("commit", "-q", "-m", msg, cwd=repo, env=env)

    def bare(self, name):
        path = self.tmp / f"{name}.git"
        subprocess.run(["git", "init", "-q", "--bare", str(path)], env=self.env, check=True)
        self.git("remote", "add", name, str(path))
        return path

    def head(self, repo=None):
        return self.git("rev-parse", "HEAD", cwd=repo).stdout.strip()

    def remote_head(self, bare, branch="main"):
        r = subprocess.run(["git", "rev-parse", f"refs/heads/{branch}"], cwd=bare, env=self.env,
                           capture_output=True, text=True)
        return r.stdout.strip() if r.returncode == 0 else None

    def seed(self, *names):
        """Create bare remotes that already hold main at the current HEAD."""
        paths = {}
        for n in names:
            paths[n] = self.bare(n)
            self.git("push", "-q", n, "main")
        return paths

    def ship(self, *args):
        return subprocess.run([sys.executable, str(GITEA), "ship", *args], cwd=self.repo,
                              env=self.env, capture_output=True, text=True)

    def other_clone(self, bare, name="other"):
        """A second clone of `bare`, used to advance the remote behind our back."""
        path = self.tmp / name
        subprocess.run(["git", "clone", "-q", str(bare), str(path)], env=self.env, check=True)
        return path


class TestShip(ShipCase):
    def test_pushes_to_both_remotes(self):
        paths = self.seed("origin", "gitea")
        self.commit("second")
        r = self.ship()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        for p in paths.values():
            self.assertEqual(self.remote_head(p), self.head())
        self.assertIn("origin", r.stdout)
        self.assertIn("gitea", r.stdout)
        self.assertIn("..", r.stdout)

    def test_behind_one_remote_refuses_and_pushes_nothing(self):
        paths = self.seed("origin", "gitea")
        other = self.other_clone(paths["gitea"])
        self.commit("remote-only", repo=other)
        # gitea moves ahead of us; origin stays level
        self.git("push", "-q", "origin", "HEAD:main", cwd=other)
        self.commit("local-new")
        before = {k: self.remote_head(v) for k, v in paths.items()}
        r = self.ship()
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("behind", r.stdout + r.stderr)
        self.assertIn("git merge gitea/main", r.stdout + r.stderr)
        self.assertEqual({k: self.remote_head(v) for k, v in paths.items()}, before)

    def test_foreign_author_refuses_and_lists_commit(self):
        paths = self.seed("origin")
        self.commit("sneaky", GIT_AUTHOR_NAME="Someone Else", GIT_AUTHOR_EMAIL="else@example.com")
        short = self.git("rev-parse", "--short", "HEAD").stdout.strip()
        r = self.ship()
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        out = r.stdout + r.stderr
        self.assertIn(short, out)
        self.assertIn("Someone Else", out)
        self.assertIn("sneaky", out)
        self.assertNotEqual(self.remote_head(paths["origin"]), self.head())

    def test_local_identity_override_refuses(self):
        paths = self.seed("origin")
        self.commit("second")
        self.git("config", "--local", "user.email", "me@elsewhere.example")
        r = self.ship()
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("user.email", r.stdout + r.stderr)
        self.assertNotEqual(self.remote_head(paths["origin"]), self.head())

    def test_nothing_outgoing_exits_zero(self):
        self.seed("origin", "gitea")
        r = self.ship()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("nothing to push", r.stdout + r.stderr)

    def test_dry_run_pushes_nothing(self):
        paths = self.seed("origin", "gitea")
        before = {k: self.remote_head(v) for k, v in paths.items()}
        self.commit("second")
        r = self.ship("--dry-run")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("dry run", r.stdout + r.stderr)
        self.assertIn("origin", r.stdout)
        self.assertEqual({k: self.remote_head(v) for k, v in paths.items()}, before)

    def test_remote_flag_pushes_new_branch(self):
        paths = self.seed("origin", "gitea")
        self.git("checkout", "-q", "-b", "feature")
        self.commit("feature work")
        r = self.ship()  # no remote has it
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("--remote", r.stdout + r.stderr)
        self.assertIsNone(self.remote_head(paths["gitea"], "feature"))
        r = self.ship("--remote", "gitea")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.remote_head(paths["gitea"], "feature"), self.head())
        self.assertIsNone(self.remote_head(paths["origin"], "feature"))

    def test_one_push_failure_continues_and_exits_two(self):
        paths = self.seed("origin", "gitea")
        hook = paths["origin"] / "hooks" / "pre-receive"
        hook.write_text("#!/bin/sh\necho rejected-by-test >&2\nexit 1\n", encoding="utf-8")
        hook.chmod(0o755)
        # the global config's empty hooksPath would shadow the bare repo's hooks
        subprocess.run(["git", "config", "core.hooksPath", str(hook.parent)], cwd=paths["origin"],
                       env=self.env, check=True)
        self.commit("second")
        r = self.ship()
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertEqual(self.remote_head(paths["gitea"]), self.head())
        self.assertNotEqual(self.remote_head(paths["origin"]), self.head())
        self.assertIn("origin", r.stdout + r.stderr)

    def test_detached_head_is_usage_error(self):
        self.seed("origin")
        self.git("checkout", "-q", "--detach")
        r = self.ship()
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)


if __name__ == "__main__":
    unittest.main()
