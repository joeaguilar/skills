"""Offline behavior tests; all git writes are confined to disposable repositories."""

import subprocess
import tempfile
import unittest
from pathlib import Path

from plan_version import classify, plan


class VersionPlanningTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="codex-version-test-")
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git("init", "--initial-branch=main")
        self.git("config", "user.name", "Version Test")
        self.git("config", "user.email", "version-test@example.invalid")
        self.git("config", "commit.gpgsign", "false")
        self.git("config", "tag.gpgsign", "false")
        self.git("config", "core.hooksPath", str(self.repo / "no-hooks"))
        self.commit("chore: initialize")

    def git(self, *args):
        return subprocess.run(["git", "-C", str(self.repo), *args], check=True,
                              capture_output=True, text=True).stdout.strip()

    def commit(self, message):
        self.git("commit", "--allow-empty", "-m", message)

    def test_classification(self):
        cases = {
            "feat(ui): add panel": "minor", "fix: repair": "patch",
            "perf(io): reduce copying": "patch", "feat!: remove API": "major",
            "chore: change\n\nBREAKING CHANGE: old clients fail": "major",
            "fix: change\n\nBREAKING-CHANGE: old clients fail": "major",
            "feature: not conventional feat": "none", "fixup: cleanup": "none",
            "docs: mention feat: new API": "none", "feat:no space": "none",
            "docs: example BREAKING CHANGE: inline only": "none",
        }
        for message, expected in cases.items():
            with self.subTest(message=message):
                self.assertEqual(classify(message), expected)

    def test_tagged_head_is_noop(self):
        self.git("tag", "v1.2.3")
        result = plan(self.repo)
        self.assertEqual(result["commits"], 0)
        self.assertIsNone(result["next_tag"])

    def test_highest_change_wins_and_is_read_only(self):
        self.git("tag", "-a", "v1.2.3", "-m", "release")
        self.commit("fix: first")
        self.commit("feat(ui): panel")
        (self.repo / "user.txt").write_text("keep me", encoding="utf-8")
        before = self.git("status", "--porcelain"), self.git("show-ref"), self.git("rev-parse", "HEAD")
        result = plan(self.repo)
        self.assertEqual(result["next_tag"], "v1.3.0")
        self.assertEqual(result, plan(self.repo))
        self.assertEqual(before, (self.git("status", "--porcelain"), self.git("show-ref"), self.git("rev-parse", "HEAD")))
        self.assertEqual((self.repo / "user.txt").read_text(), "keep me")

    def test_breaking_footer_and_initial_version(self):
        self.commit("refactor: replace protocol\n\nBREAKING CHANGE: old protocol removed")
        self.assertEqual(plan(self.repo, initial_version="2.4.6")["next_version"], "3.0.0")

    def test_unreachable_version_does_not_win(self):
        self.git("tag", "v1.0.0")
        self.git("checkout", "-b", "unrelated")
        self.commit("feat: elsewhere")
        self.git("tag", "v9.0.0")
        self.git("checkout", "main")
        self.commit("fix: current branch")
        self.assertEqual(plan(self.repo)["next_tag"], "v1.0.1")
        with self.assertRaises(ValueError):
            plan(self.repo, base="v9.0.0")

    def test_explicit_base_and_unsupported_prerelease(self):
        self.git("tag", "v1.0.0")
        self.commit("feat: preview")
        self.git("tag", "v1.1.0-beta.1")
        with self.assertRaises(ValueError):
            plan(self.repo)
        self.assertEqual(plan(self.repo, base="v1.0.0")["next_tag"], "v1.1.0")
        with self.assertRaises(ValueError):
            plan(self.repo, base="--all")
        with self.assertRaises(ValueError):
            plan(self.repo, initial_version="01.0.0")

    def test_shallow_history_rejected(self):
        destination = self.repo / "shallow-clone"
        subprocess.run(["git", "clone", "--depth=1", self.repo.as_uri(), str(destination)],
                       check=True, capture_output=True)
        with self.assertRaisesRegex(ValueError, "Shallow"):
            plan(destination)


if __name__ == "__main__":
    unittest.main()
