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

    # --- review round: accepted findings -----------------------------------

    def test_narrow_fetch_refspec_still_sees_remote_branch(self):
        paths = self.seed("origin", "gitea")
        self.git("config", "remote.origin.fetch", "+refs/heads/main:refs/remotes/origin/main")
        self.git("checkout", "-q", "-b", "feature")
        self.commit("local feature")
        other = self.other_clone(paths["origin"])
        self.git("checkout", "-q", "-b", "feature", cwd=other)
        self.commit("remote feature", repo=other)
        self.git("push", "-q", "origin", "feature", cwd=other)
        r = self.ship("--remote", "gitea", "--remote", "origin")
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIsNone(self.remote_head(paths["gitea"], "feature"), "pushed before the behind check")

    def test_replace_objects_cannot_hide_a_foreign_commit(self):
        paths = self.seed("origin")
        self.commit("sneaky", GIT_AUTHOR_NAME="Someone Else", GIT_AUTHOR_EMAIL="else@example.com")
        foreign = self.head()
        self.git("checkout", "-q", "--detach", "HEAD~1")
        self.commit("sneaky")
        twin = self.head()
        self.git("checkout", "-q", "main")
        self.git("replace", foreign, twin)
        r = self.ship()
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("Someone Else", r.stdout + r.stderr)
        self.assertNotEqual(self.remote_head(paths["origin"]), foreign)

    def test_branch_tip_is_snapshotted_before_pushing(self):
        paths = self.seed("origin", "gitea")
        self.commit("second")
        orig = self.head()
        hooks = self.tmp / "prepush"
        hooks.mkdir()
        marker = (self.tmp / "hook-ran").as_posix()
        hook = hooks / "pre-push"
        hook.write_text(
            "#!/bin/sh" + chr(10) + f"[ -e '{marker}' ] && exit 0" + chr(10) + f"touch '{marker}'" + chr(10)
            + "git commit -q --allow-empty -m hooked --author='Evil <evil@example.com>'" + chr(10) + "exit 0" + chr(10),
            encoding="utf-8")
        hook.chmod(0o755)
        self.git("config", "--local", "core.hooksPath", str(hooks))
        r = self.ship("--remote", "origin", "--remote", "gitea")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.remote_head(paths["origin"]), orig)
        self.assertEqual(self.remote_head(paths["gitea"]), orig)
        self.assertIn(orig[:7], r.stdout)

    def test_pushurl_differing_from_url_refuses(self):
        paths = self.seed("origin")
        other = self.bare("elsewhere")
        self.git("config", "remote.origin.pushurl", str(other))
        self.commit("second")
        r = self.ship()
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertIn("pushurl", r.stdout + r.stderr)
        self.assertNotEqual(self.remote_head(paths["origin"]), self.head())
        self.assertIsNone(self.remote_head(other))

    def test_included_identity_override_refuses(self):
        paths = self.seed("origin")
        self.commit("second")
        inc = self.tmp / "extra.cfg"
        inc.write_text("[user]" + chr(10) + chr(9) + "email = inc@elsewhere.example" + chr(10), encoding="utf-8")
        self.git("config", "--local", "include.path", inc.as_posix())
        r = self.ship()
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("user.email", r.stdout + r.stderr)
        self.assertNotEqual(self.remote_head(paths["origin"]), self.head())

    # --- review round: pinned behaviour ------------------------------------

    def test_audit_covers_commits_missing_from_any_destination(self):
        backup = self.seed("backup")["backup"]  # backup at P
        self.commit("foreign", GIT_AUTHOR_NAME="Someone Else", GIT_AUTHOR_EMAIL="else@example.com")
        foreign = self.git("rev-parse", "--short", "HEAD").stdout.strip()
        self.bare("origin")
        self.git("push", "-q", "origin", "main")  # origin at F
        self.commit("clean G")
        r = self.ship("--remote", "origin", "--remote", "backup")
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn(foreign, r.stdout + r.stderr)
        self.assertNotEqual(self.remote_head(backup), self.head())

    def test_detached_head_with_explicit_branch_is_allowed(self):
        self.seed("origin")
        self.commit("second")
        self.git("checkout", "-q", "--detach")
        r = self.ship("--branch", "main", "--dry-run")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("dry run", r.stdout + r.stderr)

    # --- review round 2 -----------------------------------------------------

    def test_slash_named_remote_cannot_stand_in_for_its_prefix(self):
        other = self.bare("origin/other")
        self.commit("foreign", GIT_AUTHOR_NAME="Someone Else", GIT_AUTHOR_EMAIL="else@example.com")
        foreign = self.git("rev-parse", "--short", "HEAD").stdout.strip()
        self.git("push", "-q", "origin/other", "main")
        empty = self.bare("origin")
        self.git("config", "remote.origin.fetch", "+refs/heads/main:refs/remotes/origin/main")  # no prune of origin/other/*
        r = self.ship("--remote", "origin")
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn(foreign, r.stdout + r.stderr)
        self.assertIsNone(self.remote_head(empty))

    def test_selected_remote_with_two_pushurls_refuses(self):
        paths = self.seed("origin")
        self.git("config", "--add", "remote.origin.pushurl", str(paths["origin"]))
        self.git("config", "--add", "remote.origin.pushurl", str(paths["origin"]))
        self.commit("second")
        r = self.ship()
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertNotEqual(self.remote_head(paths["origin"]), self.head())

    def test_selected_remote_with_push_insteadof_refuses(self):
        paths = self.seed("origin")
        elsewhere = self.bare("rewritten")
        self.git("config", f"url.{elsewhere.as_posix()}/.pushInsteadOf", str(paths["origin"]))
        self.commit("second")
        r = self.ship()
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertNotEqual(self.remote_head(paths["origin"]), self.head())
        self.assertIsNone(self.remote_head(elsewhere))

    def test_selected_remote_with_two_urls_refuses(self):
        paths = self.seed("origin")
        other = self.bare("elsewhere")
        self.git("config", "--add", "remote.origin.url", str(other))
        self.commit("second")
        r = self.ship()
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertNotEqual(self.remote_head(paths["origin"]), self.head())
        self.assertIsNone(self.remote_head(other))

    def test_unselected_remote_with_pushurl_does_not_block(self):
        paths = self.seed("origin")
        side = self.bare("side")
        decoy = self.bare("decoy")
        self.git("config", "remote.side.pushurl", str(decoy))
        self.commit("second")
        r = self.ship()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.remote_head(paths["origin"]), self.head())
        self.assertIsNone(self.remote_head(side))

    def test_rev_list_failure_is_exit_two_with_no_push(self):
        import importlib.util
        from unittest import mock
        spec = importlib.util.spec_from_file_location("gitea_under_test", GITEA)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        paths = self.seed("origin")
        self.commit("second")
        real, pushed = mod.run, []

        def flaky(cmd, *a, **k):
            if "rev-list" in cmd and "--not" in cmd:
                return subprocess.CompletedProcess(cmd, 128, "", "fatal: injected rev-list failure")
            if "push" in cmd:
                pushed.append(cmd)
            return real(cmd, *a, **k)

        cwd = os.getcwd()
        os.chdir(self.repo)
        try:
            with mock.patch.dict(os.environ, self.env, clear=True), mock.patch.object(mod, "run", flaky):
                with self.assertRaises(SystemExit) as cm:
                    mod.main(["ship"])
        finally:
            os.chdir(cwd)
        self.assertEqual(cm.exception.code, 2)
        self.assertEqual(pushed, [])
        self.assertNotEqual(self.remote_head(paths["origin"]), self.head())

    def test_tag_named_like_the_branch_resolves_the_branch(self):
        paths = self.seed("origin")
        self.commit("second")
        self.git("tag", "main", "HEAD~1")
        r = self.ship()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.remote_head(paths["origin"]), self.head())

    def test_revision_expression_is_not_a_branch(self):
        paths = self.seed("origin")
        self.commit("second")
        r = self.ship("--branch", "main~0")
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertNotEqual(self.remote_head(paths["origin"]), self.head())

    def test_tab_in_identity_and_show_signature_parse(self):
        name = "Tes" + chr(9) + "ter"
        self.gcfg.write_text(self.gcfg.read_text(encoding="utf-8").replace(
            "name = Tester", 'name = "Tes' + chr(92) + 'tter"'), encoding="utf-8")
        paths = self.seed("origin")
        self.git("config", "--local", "log.showSignature", "true")
        self.commit("second")
        who = self.git("log", "-1", "--format=%an", "HEAD").stdout.strip()
        self.assertEqual(who, name)
        r = self.ship()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.remote_head(paths["origin"]), self.head())

    def test_suffix_match_does_not_count_as_holding_the_branch(self):
        path = self.bare("origin")
        self.git("push", "-q", "origin", "main:refs/heads/extra/refs/heads/main")
        self.commit("second")
        r = self.ship()
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("no remote has", r.stdout + r.stderr)
        self.assertIsNone(self.remote_head(path))

    # --- review round 3 -----------------------------------------------------

    def test_push_goes_to_the_url_validated_during_planning(self):
        paths = self.seed("origin", "gitea")
        decoy = self.bare("decoy")
        self.commit("second")
        orig = self.head()
        hooks = self.tmp / "retarget"
        hooks.mkdir()
        marker = (self.tmp / "retargeted").as_posix()
        hook = hooks / "pre-push"
        hook.write_text(
            "#!/bin/sh" + chr(10) + f"[ -e '{marker}' ] && exit 0" + chr(10) + f"touch '{marker}'" + chr(10)
            + f"git config remote.gitea.pushurl '{decoy.as_posix()}'" + chr(10) + "exit 0" + chr(10),
            encoding="utf-8")
        hook.chmod(0o755)
        self.git("config", "--local", "core.hooksPath", str(hooks))
        r = self.ship("--remote", "origin", "--remote", "gitea")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.remote_head(paths["origin"]), orig)
        self.assertEqual(self.remote_head(paths["gitea"]), orig)
        self.assertIsNone(self.remote_head(decoy))
        tracked = self.git("rev-parse", "refs/remotes/gitea/main").stdout.strip()
        self.assertEqual(tracked, orig)

    def test_fetch_failure_mentioning_missing_ref_is_not_absence(self):
        paths = self.seed("origin")
        self.git("remote", "add", "bad", str(self.tmp / "couldn't find remote ref nowhere"))
        self.commit("second")
        r = self.ship()
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertNotEqual(self.remote_head(paths["origin"]), self.head())

    def test_shallow_clone_refuses(self):
        paths = self.seed("origin")
        self.commit("second")
        self.git("push", "-q", "origin", "main")
        clone = self.tmp / "shallow"
        subprocess.run(["git", "clone", "-q", "--depth", "1", paths["origin"].as_uri(), str(clone)],
                       env=self.env, check=True)
        self.commit("third", repo=clone)
        before = self.remote_head(paths["origin"])
        self.repo = clone
        r = self.ship()
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertIn("unshallow", r.stdout + r.stderr)
        self.assertEqual(self.remote_head(paths["origin"]), before)

    def test_non_utf8_log_encoding_config_does_not_break_the_audit(self):
        paths = self.seed("origin")
        self.git("config", "--local", "i18n.logOutputEncoding", "UTF-16")
        self.commit("second")
        r = self.ship()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.remote_head(paths["origin"]), self.head())

    def test_empty_branch_name_is_a_usage_error(self):
        paths = self.seed("origin")
        self.commit("second")
        r = self.ship("--branch", "")
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertNotEqual(self.remote_head(paths["origin"]), self.head())

    # --- review round 4 -----------------------------------------------------

    def test_grafts_file_refuses(self):
        paths = self.seed("origin")
        self.commit("foreign", GIT_AUTHOR_NAME="Someone Else", GIT_AUTHOR_EMAIL="else@example.com")
        self.commit("clean G")
        g = self.head()
        grafts = self.repo / ".git" / "info" / "grafts"
        grafts.parent.mkdir(exist_ok=True)
        grafts.write_text(g + chr(10), encoding="utf-8")  # G becomes parentless: F is hidden
        r = self.ship()
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertNotEqual(self.remote_head(paths["origin"]), g)

    def test_chained_insteadof_rewrite_refuses(self):
        paths = self.seed("origin")
        y = self.bare("rewrite-y")
        z = self.bare("rewrite-z")
        self.git("config", f"url.{y}.insteadOf", str(paths["origin"]))
        self.git("config", f"url.{z}.insteadOf", str(y))
        self.commit("second")
        r = self.ship("--remote", "origin")
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        for bare in (y, z):
            self.assertIsNone(self.remote_head(bare))

    def test_symbolic_tracking_ref_refuses(self):
        paths = self.seed("origin")
        other = self.other_clone(paths["origin"])
        self.git("checkout", "-q", "-b", "feature", cwd=other)
        self.commit("remote feature", repo=other)
        self.git("push", "-q", "origin", "feature", cwd=other)
        self.git("checkout", "-q", "-b", "feature")
        self.commit("local feature")
        main_before = self.git("rev-parse", "refs/heads/main").stdout.strip()
        self.git("symbolic-ref", "refs/remotes/origin/feature", "refs/heads/main")
        r = self.ship("--remote", "origin")
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertEqual(self.git("rev-parse", "refs/heads/main").stdout.strip(), main_before)

    def test_destination_is_frozen_before_the_fetch(self):
        paths = self.seed("origin")
        decoy = self.bare("decoy")
        self.commit("second")
        orig = self.head()
        self.git("update-ref", "-d", "refs/remotes/origin/main")  # so the fetch has a ref to write
        hooks = self.tmp / "duringfetch"
        hooks.mkdir()
        hook = hooks / "reference-transaction"
        hook.write_text(
            "#!/bin/sh" + chr(10) + '[ "$1" = prepared ] || exit 0' + chr(10)
            + f"git config remote.origin.url '{decoy.as_posix()}'" + chr(10) + "exit 0" + chr(10),
            encoding="utf-8")
        hook.chmod(0o755)
        self.git("config", "--local", "core.hooksPath", str(hooks))
        r = self.ship("--remote", "origin")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.remote_head(paths["origin"]), orig)  # chosen behaviour: push to the frozen URL
        self.assertIsNone(self.remote_head(decoy))

    def test_url_terminator_removal_keeps_whitespace(self):
        import importlib.util
        from unittest import mock
        spec = importlib.util.spec_from_file_location("gitea_under_test2", GITEA)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        self.assertTrue(hasattr(mod, "_raw"), "no unstripped git reader")
        for out, want in (("/p/x.git \n", "/p/x.git "), ("/p/x.git \r\n", "/p/x.git "), (" /p/x.git", " /p/x.git")):
            done = subprocess.CompletedProcess([], 0, out, "")
            with mock.patch.object(mod, "_git", lambda *a, **k: done):
                self.assertEqual(mod._raw("remote", "get-url", "x"), want)

    @unittest.skipIf(os.name == "nt", "Windows cannot hold a directory whose name ends in a space")
    def test_url_with_trailing_space_is_pushed_exactly(self):
        paths = self.seed("origin")
        plain = paths["origin"]
        spaced = self.tmp / "origin.git "
        plain.rename(spaced)
        self.git("remote", "set-url", "origin", str(spaced))
        self.commit("second")
        log = self.tmp / "pushed-url"
        hooks = self.tmp / "recordurl"
        hooks.mkdir()
        hook = hooks / "pre-push"
        hook.write_text("#!/bin/sh" + chr(10) + "printf %s \"$2\" > " + chr(39) + log.as_posix() + chr(39)
                        + chr(10) + "exit 0" + chr(10), encoding="utf-8")
        hook.chmod(0o755)
        self.git("config", "--local", "core.hooksPath", str(hooks))
        r = self.ship("--remote", "origin")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(log.read_text(encoding="utf-8"), str(spaced))

    def test_embedded_diagnostic_line_is_not_absence(self):
        paths = self.seed("origin")
        weird = (self.tmp / "nowhere").as_uri() + chr(10) + "fatal: couldn't find remote ref refs/heads/main" + chr(10) + "tail"
        self.git("remote", "add", "bad", weird)
        self.commit("second")
        r = self.ship()
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertNotEqual(self.remote_head(paths["origin"]), self.head())

    # --- review round 5 -----------------------------------------------------

    def test_push_recurse_submodules_only_still_pushes_the_superproject(self):
        paths = self.seed("origin")
        self.git("config", "--local", "push.recurseSubmodules", "only")
        self.commit("second")
        r = self.ship()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.remote_head(paths["origin"]), self.head())

    def test_explicit_remote_is_validated_before_any_fetch(self):
        self.seed("origin")
        backup = self.seed("backup")["backup"]
        decoy = self.bare("decoy")
        self.git("config", "remote.backup.pushurl", str(decoy))
        self.git("update-ref", "-d", "refs/remotes/backup/main")
        self.commit("second")
        r = self.ship("--remote", "backup")
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        gone = self.git("rev-parse", "--verify", "-q", "refs/remotes/backup/main", check=False)
        self.assertNotEqual(gone.returncode, 0, "the tracking ref was fetched before validation")
        self.assertIsNone(self.remote_head(decoy))

    def test_grafts_in_the_common_dir_refuse_from_a_linked_worktree(self):
        self.seed("origin")
        wt = self.tmp / "wt"
        self.git("worktree", "add", "-q", str(wt), "-b", "wtbranch")
        grafts = self.repo / ".git" / "info" / "grafts"
        grafts.parent.mkdir(exist_ok=True)
        grafts.write_text(self.head() + chr(10), encoding="utf-8")
        self.repo = wt
        r = self.ship("--remote", "origin")
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)

    def test_inherited_graft_file_env_refuses(self):
        paths = self.seed("origin")
        self.commit("second")
        graft = self.tmp / "grafts-elsewhere"
        graft.write_text(self.head() + chr(10), encoding="utf-8")
        self.env["GIT_GRAFT_FILE"] = str(graft)
        r = self.ship()
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertNotEqual(self.remote_head(paths["origin"]), self.head())


if __name__ == "__main__":
    unittest.main()
