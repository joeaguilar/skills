#!/usr/bin/env python3
"""Count the most common words in a text file."""
import argparse
import re
import sys
from collections import Counter

WORD_RE = re.compile(r"[a-z0-9]+(?:'[a-z0-9]+)*")


def extract_words(text):
    return WORD_RE.findall(text.lower())


def top_words(text, n):
    counts = Counter(extract_words(text))
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:n]


def parse_args(argv):
    parser = argparse.ArgumentParser(
        prog="wordfreq.py",
        description="Show the N most common words in a file.",
    )
    parser.add_argument("file", help="path to the text file")
    parser.add_argument(
        "--top", type=int, required=True, metavar="N",
        help="number of most common words to show (must be a positive integer)",
    )
    args = parser.parse_args(argv)
    if args.top <= 0:
        parser.error(f"--top must be a positive integer, got {args.top}")
    return args


def main(argv=None):
    args = parse_args(argv)

    try:
        with open(args.file, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except FileNotFoundError:
        print(f"Error: file not found: {args.file}", file=sys.stderr)
        return 1
    except OSError as e:
        print(f"Error: could not read {args.file}: {e.strerror}", file=sys.stderr)
        return 1

    for word, count in top_words(text, args.top):
        print(f"{word}\t{count}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
