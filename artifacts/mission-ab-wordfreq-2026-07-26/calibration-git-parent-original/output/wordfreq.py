#!/usr/bin/env python3
"""Count the most common words in a text file."""

import argparse
import re
import sys

WORD_RE = re.compile(r"[a-z0-9]+(?:'[a-z0-9]+)*")


def count_words(text):
    """Return a dict mapping lowercase word -> count, ignoring punctuation."""
    counts = {}
    for word in WORD_RE.findall(text.lower()):
        counts[word] = counts.get(word, 0) + 1
    return counts


def top_words(counts, n):
    """Return the top n (word, count) pairs sorted by count desc, word asc."""
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:n]


def parse_args(argv):
    parser = argparse.ArgumentParser(
        prog="wordfreq.py",
        description="Show the N most common words in FILE.",
    )
    parser.add_argument("file", metavar="FILE", help="path to the text file to analyze")
    parser.add_argument(
        "--top", type=int, required=True, metavar="N", help="number of top words to show"
    )
    args = parser.parse_args(argv)
    if args.top <= 0:
        parser.error("argument --top: must be a positive integer")
    return args


def read_file(path):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except FileNotFoundError:
        raise SystemExit(f"wordfreq.py: error: file not found: {path}")
    except IsADirectoryError:
        raise SystemExit(f"wordfreq.py: error: not a file: {path}")
    except PermissionError:
        raise SystemExit(f"wordfreq.py: error: permission denied: {path}")
    except OSError as e:
        raise SystemExit(f"wordfreq.py: error: could not read {path}: {e}")


def main(argv=None):
    args = parse_args(argv)
    text = read_file(args.file)
    counts = count_words(text)
    for word, count in top_words(counts, args.top):
        print(f"{word}\t{count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
