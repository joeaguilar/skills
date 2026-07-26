import io
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr

import wordfreq

WORDFREQ_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wordfreq.py")


class ExtractWordsTests(unittest.TestCase):
    def test_lowercases_and_strips_punctuation(self):
        text = "The Quick, Brown Fox! Jumps: over-the lazy_dog?"
        self.assertEqual(
            wordfreq.extract_words(text),
            ["the", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog"],
        )

    def test_empty_text(self):
        self.assertEqual(wordfreq.extract_words(""), [])

    def test_ignores_quote_marks_around_words(self):
        text = "he said 'hello' to 'the' world don't can't 80's ''' ''"
        self.assertEqual(
            wordfreq.extract_words(text),
            ["he", "said", "hello", "to", "the", "world", "don't", "can't", "80's"],
        )


class TopWordsTests(unittest.TestCase):
    def test_sorts_by_count_desc_then_word_asc(self):
        text = "b b a a c"
        self.assertEqual(wordfreq.top_words(text, 10), [("a", 2), ("b", 2), ("c", 1)])

    def test_respects_top_n(self):
        text = "one two two three three three"
        self.assertEqual(wordfreq.top_words(text, 1), [("three", 3)])

    def test_case_insensitive(self):
        text = "Fox fox FOX"
        self.assertEqual(wordfreq.top_words(text, 5), [("fox", 3)])


class ParseArgsTests(unittest.TestCase):
    def test_rejects_zero_top(self):
        with self.assertRaises(SystemExit) as ctx:
            with redirect_stderr(io.StringIO()):
                wordfreq.parse_args(["file.txt", "--top", "0"])
        self.assertEqual(ctx.exception.code, 2)

    def test_rejects_negative_top(self):
        with self.assertRaises(SystemExit) as ctx:
            with redirect_stderr(io.StringIO()):
                wordfreq.parse_args(["file.txt", "--top", "-3"])
        self.assertEqual(ctx.exception.code, 2)

    def test_rejects_non_integer_top(self):
        with self.assertRaises(SystemExit) as ctx:
            with redirect_stderr(io.StringIO()):
                wordfreq.parse_args(["file.txt", "--top", "abc"])
        self.assertEqual(ctx.exception.code, 2)

    def test_accepts_positive_top(self):
        args = wordfreq.parse_args(["file.txt", "--top", "5"])
        self.assertEqual(args.top, 5)
        self.assertEqual(args.file, "file.txt")


class MainTests(unittest.TestCase):
    def test_missing_file_returns_error(self):
        stderr = io.StringIO()
        with redirect_stderr(stderr):
            code = wordfreq.main(["/no/such/file.txt", "--top", "3"])
        self.assertEqual(code, 1)
        self.assertIn("file not found", stderr.getvalue())

    def test_unreadable_file_returns_error(self):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            path = f.name
        try:
            os.chmod(path, 0)
            stderr = io.StringIO()
            with redirect_stderr(stderr):
                code = wordfreq.main([path, "--top", "3"])
            self.assertEqual(code, 1)
            self.assertIn("could not read", stderr.getvalue())
        finally:
            os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
            os.remove(path)

    def test_prints_top_words(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("fox fox fox quick quick the")
            path = f.name
        try:
            stdout = io.StringIO()
            import contextlib
            with contextlib.redirect_stdout(stdout):
                code = wordfreq.main([path, "--top", "2"])
            self.assertEqual(code, 0)
            self.assertEqual(stdout.getvalue(), "fox\t3\nquick\t2\n")
        finally:
            os.remove(path)


class CliSmokeTests(unittest.TestCase):
    def run_cli(self, args):
        return subprocess.run(
            [sys.executable, WORDFREQ_PATH] + args,
            capture_output=True, text=True,
        )

    def test_real_process_top_n(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("The quick brown fox. The Quick fox jumps! Fox, fox, fox.")
            path = f.name
        try:
            result = self.run_cli([path, "--top", "3"])
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "fox\t5\nquick\t2\nthe\t2\n")
        finally:
            os.remove(path)

    def test_real_process_missing_file(self):
        result = self.run_cli(["/no/such/file.txt", "--top", "3"])
        self.assertEqual(result.returncode, 1)
        self.assertIn("file not found", result.stderr)

    def test_real_process_invalid_top(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("a b c")
            path = f.name
        try:
            result = self.run_cli([path, "--top", "0"])
            self.assertEqual(result.returncode, 2)
            self.assertIn("--top must be a positive integer", result.stderr)
        finally:
            os.remove(path)


if __name__ == "__main__":
    unittest.main()
