import os
import stat
import subprocess
import sys
import tempfile
import unittest

import wordfreq


class CountWordsTests(unittest.TestCase):
    def test_case_insensitive(self):
        counts = wordfreq.count_words("The the THE cat")
        self.assertEqual(counts["the"], 3)
        self.assertEqual(counts["cat"], 1)

    def test_ignores_punctuation(self):
        counts = wordfreq.count_words("Hello, world! Hello... world?")
        self.assertEqual(counts["hello"], 2)
        self.assertEqual(counts["world"], 2)
        self.assertNotIn(",", counts)

    def test_apostrophes_kept_within_words(self):
        counts = wordfreq.count_words("don't don't do")
        self.assertEqual(counts["don't"], 2)
        self.assertEqual(counts["do"], 1)

    def test_numbers_counted(self):
        counts = wordfreq.count_words("2024 is 2024")
        self.assertEqual(counts["2024"], 2)

    def test_empty_text(self):
        self.assertEqual(wordfreq.count_words(""), {})


class TopWordsTests(unittest.TestCase):
    def test_sorted_by_count_desc_then_word_asc(self):
        counts = {"b": 2, "a": 2, "c": 3, "d": 1}
        self.assertEqual(
            wordfreq.top_words(counts, 4),
            [("c", 3), ("a", 2), ("b", 2), ("d", 1)],
        )

    def test_limits_to_n(self):
        counts = {"a": 1, "b": 2, "c": 3}
        self.assertEqual(wordfreq.top_words(counts, 2), [("c", 3), ("b", 2)])

    def test_n_larger_than_available(self):
        counts = {"a": 1}
        self.assertEqual(wordfreq.top_words(counts, 5), [("a", 1)])


class ParseArgsTests(unittest.TestCase):
    def test_valid_args(self):
        args = wordfreq.parse_args(["myfile.txt", "--top", "5"])
        self.assertEqual(args.file, "myfile.txt")
        self.assertEqual(args.top, 5)

    def test_top_zero_rejected(self):
        with self.assertRaises(SystemExit):
            wordfreq.parse_args(["myfile.txt", "--top", "0"])

    def test_top_negative_rejected(self):
        with self.assertRaises(SystemExit):
            wordfreq.parse_args(["myfile.txt", "--top", "-3"])

    def test_top_non_integer_rejected(self):
        with self.assertRaises(SystemExit):
            wordfreq.parse_args(["myfile.txt", "--top", "abc"])

    def test_missing_top_rejected(self):
        with self.assertRaises(SystemExit):
            wordfreq.parse_args(["myfile.txt"])


class ReadFileTests(unittest.TestCase):
    def test_missing_file_raises_system_exit(self):
        with self.assertRaises(SystemExit):
            wordfreq.read_file("/no/such/file/exists.txt")

    def test_reads_existing_file(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("hello world")
            path = f.name
        try:
            self.assertEqual(wordfreq.read_file(path), "hello world")
        finally:
            os.remove(path)

    def test_unreadable_file_raises_system_exit(self):
        if os.name != "posix" or os.geteuid() == 0:
            self.skipTest("permission test requires non-root POSIX user")
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("hello world")
            path = f.name
        try:
            os.chmod(path, 0)
            with self.assertRaises(SystemExit):
                wordfreq.read_file(path)
        finally:
            os.chmod(path, stat.S_IWUSR | stat.S_IRUSR)
            os.remove(path)


class CliSmokeTests(unittest.TestCase):
    def run_cli(self, args):
        script = os.path.join(os.path.dirname(__file__), "wordfreq.py")
        return subprocess.run(
            [sys.executable, script] + args,
            capture_output=True,
            text=True,
        )

    def test_top_words_output(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("apple banana apple cherry banana apple")
            path = f.name
        try:
            result = self.run_cli([path, "--top", "2"])
            self.assertEqual(result.returncode, 0)
            lines = result.stdout.strip().splitlines()
            self.assertEqual(lines, ["apple\t3", "banana\t2"])
        finally:
            os.remove(path)

    def test_missing_file_error(self):
        result = self.run_cli(["/no/such/file.txt", "--top", "3"])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("file not found", result.stderr)

    def test_invalid_top_error(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("hello world")
            path = f.name
        try:
            result = self.run_cli([path, "--top", "0"])
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("--top", result.stderr)
        finally:
            os.remove(path)

    def test_invalid_top_non_integer_error(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("hello world")
            path = f.name
        try:
            result = self.run_cli([path, "--top", "abc"])
            self.assertNotEqual(result.returncode, 0)
        finally:
            os.remove(path)


if __name__ == "__main__":
    unittest.main()
