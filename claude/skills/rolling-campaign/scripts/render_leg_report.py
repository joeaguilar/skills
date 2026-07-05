#!/usr/bin/env python3
"""Render a rolling-campaign LEG's PO HTML reports.

A chain leg writes the same compact JSON state a single proof-campaign does
(campaign.json + sibling queue.json / evidence.json / ledger.json), so this is a
thin SHARED wrapper over proof-campaign's renderer — one engine, no fork, no
drift. Usage mirrors the campaign renderer exactly:

    render_leg_report.py chain/<leg>/campaign.json [--out DIR] [--report NAME]

The shared engine is located in this order:
  1. $ROLLING_CAMPAIGN_RENDERER — explicit path to render_campaign_report.py
  2. ../../proof-campaign/scripts/render_campaign_report.py — the sibling skill

HTML templates resolve relative to the engine's own file, so leg reports look
identical to campaign reports. Stdlib-only, Python 3.8+.
"""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path


def _find_engine() -> Path:
    candidates = []
    override = os.environ.get("ROLLING_CAMPAIGN_RENDERER")
    if override:
        candidates.append(Path(override))
    here = Path(__file__).resolve()
    candidates.append(
        here.parent.parent.parent / "proof-campaign" / "scripts" / "render_campaign_report.py"
    )
    for c in candidates:
        if c and c.is_file():
            return c
    tried = "\n    ".join(str(c) for c in candidates)
    sys.exit(
        "render_leg_report: shared proof-campaign renderer not found.\n"
        f"  looked in:\n    {tried}\n"
        "  Fix: install the proof-campaign skill alongside rolling-campaign, or set\n"
        "  ROLLING_CAMPAIGN_RENDERER to the path of render_campaign_report.py."
    )


def _load_engine(path: Path):
    spec = importlib.util.spec_from_file_location("_rolling_campaign_engine", path)
    if spec is None or spec.loader is None:  # pragma: no cover - defensive
        sys.exit(f"render_leg_report: could not load engine at {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main(argv=None) -> int:
    engine = _load_engine(_find_engine())
    return engine.main(sys.argv[1:] if argv is None else argv)


if __name__ == "__main__":
    raise SystemExit(main())
