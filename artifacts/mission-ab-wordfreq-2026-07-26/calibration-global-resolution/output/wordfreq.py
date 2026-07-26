#!/usr/bin/env python3
"""Count the most common words in a text file."""

import argparse
import re
import sys
from collections import Counter

WORD_RE = re.compile(r"[a-z0-9]+(?:'[a-z0-9]+)*")


def count_words(text):
    """Return a Counter of lowercase words with punctuation stripped."""
    return Counter(WORD_RE.findall(text.lower()))


def top_words(counts, n):
    """Return the top-n (word, count) pairs sorted by count desc, word asc."""
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:n]


def parse_args(argv):
    parser = argparse.ArgumentParser(
        prog="wordfreq.py",
        description="Show the N most common words in FILE.",
    )
    parser.add_argument("file", metavar="FILE", help="path to a text file")
    parser.add_argument(
        "--top", type=int, required=True, metavar="N", help="number of words to show"
    )
    args = parser.parse_args(argv)
    if args.top <= 0:
        parser.error("--top must be a positive integer")
    return args


def main(argv=None):
    args = parse_args(argv)

    try:
        with open(args.file, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except FileNotFoundError:
        print(f"wordfreq.py: error: file not found: {args.file}", file=sys.stderr)
        return 1
    except IsADirectoryError:
        print(f"wordfreq.py: error: not a file: {args.file}", file=sys.stderr)
        return 1
    except OSError as e:
        print(f"wordfreq.py: error: cannot read {args.file}: {e.strerror}", file=sys.stderr)
        return 1

    counts = count_words(text)
    for word, count in top_words(counts, args.top):
        print(f"{word}\t{count}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
