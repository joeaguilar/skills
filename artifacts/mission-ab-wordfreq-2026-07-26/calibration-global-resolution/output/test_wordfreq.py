import os
import subprocess
import sys
import tempfile
import unittest

import wordfreq

PYTHON = sys.executable
SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wordfreq.py")


class CountWordsTests(unittest.TestCase):
    def test_case_insensitive(self):
        counts = wordfreq.count_words("The the THE")
        self.assertEqual(counts["the"], 3)

    def test_strips_punctuation(self):
        counts = wordfreq.count_words("Hello, world! Hello... world?")
        self.assertEqual(counts["hello"], 2)
        self.assertEqual(counts["world"], 2)
        self.assertNotIn("hello,", counts)

    def test_keeps_apostrophes_in_contractions(self):
        counts = wordfreq.count_words("don't don't can't")
        self.assertEqual(counts["don't"], 2)
        self.assertEqual(counts["can't"], 1)


class TopWordsTests(unittest.TestCase):
    def test_sorted_by_count_desc(self):
        counts = wordfreq.count_words("a a a b b c")
        self.assertEqual(wordfreq.top_words(counts, 3), [("a", 3), ("b", 2), ("c", 1)])

    def test_ties_sorted_alphabetically(self):
        counts = wordfreq.count_words("zebra apple mango")
        self.assertEqual(
            wordfreq.top_words(counts, 3), [("apple", 1), ("mango", 1), ("zebra", 1)]
        )

    def test_n_larger_than_vocabulary(self):
        counts = wordfreq.count_words("one two")
        self.assertEqual(len(wordfreq.top_words(counts, 10)), 2)


class ParseArgsTests(unittest.TestCase):
    def test_rejects_zero(self):
        with self.assertRaises(SystemExit):
            wordfreq.parse_args(["file.txt", "--top", "0"])

    def test_rejects_negative(self):
        with self.assertRaises(SystemExit):
            wordfreq.parse_args(["file.txt", "--top", "-1"])

    def test_accepts_positive(self):
        args = wordfreq.parse_args(["file.txt", "--top", "5"])
        self.assertEqual(args.top, 5)


class MainTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False
        )
        self.tmp.write("apple Apple banana banana banana cherry")
        self.tmp.close()

    def tearDown(self):
        os.unlink(self.tmp.name)

    def test_missing_file_returns_error(self):
        rc = wordfreq.main(["/no/such/file.txt", "--top", "3"])
        self.assertEqual(rc, 1)

    def test_prints_top_words(self):
        import io
        from contextlib import redirect_stdout

        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = wordfreq.main([self.tmp.name, "--top", "2"])
        self.assertEqual(rc, 0)
        self.assertEqual(buf.getvalue(), "banana\t3\napple\t2\n")


class CliSmokeTests(unittest.TestCase):
    """Real subprocess invocations of wordfreq.py as a CLI."""

    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False
        )
        self.tmp.write("dog dog dog fox fox the")
        self.tmp.close()

    def tearDown(self):
        os.unlink(self.tmp.name)

    def run_cli(self, *args):
        return subprocess.run(
            [PYTHON, SCRIPT, *args], capture_output=True, text=True
        )

    def test_smoke_top_n(self):
        result = self.run_cli(self.tmp.name, "--top", "2")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "dog\t3\nfox\t2\n")

    def test_smoke_missing_file(self):
        result = self.run_cli("/no/such/file.txt", "--top", "2")
        self.assertEqual(result.returncode, 1)
        self.assertIn("file not found", result.stderr)

    def test_smoke_invalid_top(self):
        result = self.run_cli(self.tmp.name, "--top", "0")
        self.assertEqual(result.returncode, 2)
        self.assertIn("must be a positive integer", result.stderr)

    def test_smoke_directory_as_file(self):
        result = self.run_cli(tempfile.gettempdir(), "--top", "2")
        self.assertEqual(result.returncode, 1)
        self.assertIn("not a file", result.stderr)

    def test_smoke_unreadable_file(self):
        os.chmod(self.tmp.name, 0o000)
        try:
            if os.access(self.tmp.name, os.R_OK):
                self.skipTest("running as a user that bypasses file permissions")
            result = self.run_cli(self.tmp.name, "--top", "2")
            self.assertEqual(result.returncode, 1)
            self.assertIn("cannot read", result.stderr)
        finally:
            os.chmod(self.tmp.name, 0o644)


if __name__ == "__main__":
    unittest.main()
