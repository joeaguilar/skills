import os
import subprocess
import sys
import tempfile
import unittest

import wordfreq


class CountWordsTests(unittest.TestCase):
    def test_case_insensitive(self):
        counts = wordfreq.count_words("The the THE")
        self.assertEqual(counts["the"], 3)

    def test_punctuation_ignored(self):
        counts = wordfreq.count_words("fox! fox, fox. fox?")
        self.assertEqual(counts["fox"], 4)
        self.assertNotIn("fox!", counts)


class TopWordsTests(unittest.TestCase):
    def test_sort_count_desc_then_word_asc(self):
        counts = wordfreq.count_words("b b a a c")
        result = wordfreq.top_words(counts, 3)
        self.assertEqual(result, [("a", 2), ("b", 2), ("c", 1)])

    def test_truncates_to_n(self):
        counts = wordfreq.count_words("a b c d e")
        result = wordfreq.top_words(counts, 2)
        self.assertEqual(len(result), 2)


class ParseArgsTests(unittest.TestCase):
    def test_valid_args(self):
        args = wordfreq.parse_args(["file.txt", "--top", "5"])
        self.assertEqual(args.file, "file.txt")
        self.assertEqual(args.top, 5)

    def test_top_zero_rejected(self):
        with self.assertRaises(SystemExit):
            wordfreq.parse_args(["file.txt", "--top", "0"])

    def test_top_negative_rejected(self):
        with self.assertRaises(SystemExit):
            wordfreq.parse_args(["file.txt", "--top", "-1"])

    def test_top_non_integer_rejected(self):
        with self.assertRaises(SystemExit):
            wordfreq.parse_args(["file.txt", "--top", "abc"])


class ReadFileTests(unittest.TestCase):
    def test_missing_file_exits(self):
        with self.assertRaises(SystemExit) as cm:
            wordfreq.read_file("/no/such/path/does-not-exist.txt")
        self.assertEqual(cm.exception.code, 1)

    def test_unreadable_file_exits(self):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            path = f.name
        try:
            os.chmod(path, 0o000)
            if os.access(path, os.R_OK):
                self.skipTest("running as a user that bypasses file permissions")
            with self.assertRaises(SystemExit) as cm:
                wordfreq.read_file(path)
            self.assertEqual(cm.exception.code, 1)
        finally:
            os.chmod(path, 0o600)
            os.remove(path)


class CliSmokeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False
        )
        self.tmp.write("The quick brown fox. The Fox jumps! quick, quick fox-fox.")
        self.tmp.close()

    def tearDown(self):
        os.remove(self.tmp.name)

    def run_cli(self, *args):
        return subprocess.run(
            [sys.executable, "wordfreq.py", *args],
            capture_output=True,
            text=True,
        )

    def test_top_n_output(self):
        result = self.run_cli(self.tmp.name, "--top", "3")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(
            result.stdout.strip().splitlines(),
            ["fox: 4", "quick: 3", "the: 2"],
        )

    def test_missing_file_message(self):
        result = self.run_cli("/no/such/file.txt", "--top", "3")
        self.assertEqual(result.returncode, 1)
        self.assertIn("Error: file not found", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_invalid_top_message(self):
        result = self.run_cli(self.tmp.name, "--top", "0")
        self.assertEqual(result.returncode, 2)
        self.assertIn("--top must be a positive integer", result.stderr)
        self.assertNotIn("Traceback", result.stderr)


if __name__ == "__main__":
    unittest.main()
