#!/usr/bin/env python3
"""Run identical black-box checks against both preserved Mission outputs."""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(command: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=cwd, capture_output=True, text=True)


def parse_counts(output: str) -> list[tuple[str, int]]:
    parsed: list[tuple[str, int]] = []
    for line in output.strip().splitlines():
        match = re.fullmatch(r"([^\s:]+)(?::\s*|\t)(\d+)", line.strip())
        if not match:
            raise ValueError(f"unrecognized output line: {line!r}")
        parsed.append((match.group(1), int(match.group(2))))
    return parsed


def verify_arm(name: str) -> dict[str, object]:
    cwd = ROOT / name / "output"
    tests = run([sys.executable, "-m", "unittest", "-v"], cwd)

    with tempfile.TemporaryDirectory() as tmp:
        sample = Path(tmp) / "sample.txt"
        sample.write_text("Red red BLUE blue alpha_beta.", encoding="utf-8")
        cli = run(
            [sys.executable, "wordfreq.py", str(sample), "--top", "5"],
            cwd,
        )
        missing = run(
            [sys.executable, "wordfreq.py", str(Path(tmp) / "missing"), "--top", "2"],
            cwd,
        )
        invalid_top = run(
            [sys.executable, "wordfreq.py", str(sample), "--top", "0"],
            cwd,
        )

    expected = [("blue", 2), ("red", 2), ("alpha", 1), ("beta", 1)]
    try:
        counts = parse_counts(cli.stdout)
        punctuation_ok = counts == expected
        parse_error = None
    except ValueError as error:
        counts = []
        punctuation_ok = False
        parse_error = str(error)

    checks = {
        "own_unittests_pass": tests.returncode == 0,
        "public_cli_exits_zero": cli.returncode == 0,
        "case_count_sort_and_punctuation": punctuation_ok,
        "missing_file_helpful": (
            missing.returncode != 0
            and bool(missing.stderr.strip())
            and "Traceback" not in missing.stderr
        ),
        "invalid_top_helpful": (
            invalid_top.returncode != 0
            and bool(invalid_top.stderr.strip())
            and "Traceback" not in invalid_top.stderr
        ),
    }
    return {
        "arm": name,
        "checks": checks,
        "all_requirement_checks_passed": all(checks.values()),
        "observed_counts": counts,
        "expected_counts": expected,
        "parse_error": parse_error,
        "unittest_summary_tail": tests.stderr.strip().splitlines()[-4:],
        "cli_stdout": cli.stdout,
        "cli_stderr": cli.stderr,
    }


def main() -> int:
    results = [verify_arm("original"), verify_arm("rewrite")]
    print(json.dumps(results, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
