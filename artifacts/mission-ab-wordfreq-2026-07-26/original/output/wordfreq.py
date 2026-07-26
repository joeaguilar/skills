#!/usr/bin/env python3
"""Print the N most common words in a text file."""

import argparse
import re
import sys
from collections import Counter

WORD_RE = re.compile(r"\w+")


def count_words(text):
    words = WORD_RE.findall(text.lower())
    return Counter(words)


def top_words(counts, n):
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:n]


def parse_args(argv):
    parser = argparse.ArgumentParser(
        prog="wordfreq.py",
        description="Show the N most common words in a file.",
    )
    parser.add_argument("file", help="path to the text file to analyze")
    parser.add_argument(
        "--top", type=int, required=True, help="number of top words to show (must be positive)"
    )
    args = parser.parse_args(argv)
    if args.top <= 0:
        parser.error("--top must be a positive integer")
    return args


def read_file(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print(f"Error: file not found: {path}", file=sys.stderr)
        sys.exit(1)
    except (PermissionError, IsADirectoryError, OSError):
        print(f"Error: cannot read file: {path}", file=sys.stderr)
        sys.exit(1)


def main(argv=None):
    args = parse_args(argv)
    text = read_file(args.file)
    counts = count_words(text)
    for word, count in top_words(counts, args.top):
        print(f"{word}: {count}")


if __name__ == "__main__":
    main()
