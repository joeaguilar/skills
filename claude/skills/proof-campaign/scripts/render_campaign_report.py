#!/usr/bin/env python3
"""Render proof-campaign HTML reports from campaign JSON state.

Reads campaign.json + sibling queue.json / evidence.json / ledger.json from the
same directory and emits four standalone HTML files into --out.

Stdlib-only on purpose: this runs wherever Python 3.8+ is installed.
See SCHEMA.md for the expected JSON shape.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

REPORTS = ("changelog", "smoke-test", "roadmap-update", "retro")

LANE_BADGE = {
    "verified":      ("VERIFIED",     "ok"),
    "blocked":       ("BLOCKED",      "danger"),
    "parked":        ("PARKED",       "muted"),
    "next_campaign": ("NEXT C+1",     "info"),
    "quarantined":   ("QUARANTINED",  "warn"),
    "ready":         ("READY",        "muted"),
    "active":        ("ACTIVE",       "info"),
}
STATUS_BADGE = {
    "complete":    ("COMPLETE",    "ok"),
    "in_progress": ("IN PROGRESS", "info"),
    "blocked":     ("BLOCKED",     "danger"),
    "aborted":     ("ABORTED",     "warn"),
}
RESULT_BADGE = {
    "pass":    ("PASS",    "ok"),
    "fail":    ("FAIL",    "danger"),
    "partial": ("PARTIAL", "warn"),
    "not_run": ("NOT RUN", "muted"),
}
VERIFY_BADGE = {
    "green":   ("GREEN",   "ok"),
    "red":     ("RED",     "danger"),
    "partial": ("PARTIAL", "warn"),
}


def e(value: Any) -> str:
    """HTML-escape after coercing to string. None becomes empty string."""
    if value is None:
        return ""
    return html.escape(str(value), quote=True)


def badge(text: str, kind: str = "muted") -> str:
    return f'<span class="badge {e(kind)}">{e(text)}</span>'


def lane_badge(lane: Optional[str]) -> str:
    if not lane:
        return badge("—", "muted")
    label, kind = LANE_BADGE.get(lane, (lane.upper(), "muted"))
    return badge(label, kind)


def status_badge(status: Optional[str]) -> str:
    if not status:
        return badge("—", "muted")
    label, kind = STATUS_BADGE.get(status, (status.upper(), "muted"))
    return badge(label, kind)


def result_badge(result: Optional[str]) -> str:
    if not result:
        return badge("—", "muted")
    label, kind = RESULT_BADGE.get(result, (result.upper(), "muted"))
    return badge(label, kind)


def verify_badge(result: Optional[str]) -> str:
    if not result:
        return badge("—", "muted")
    label, kind = VERIFY_BADGE.get(result, (result.upper(), "muted"))
    return badge(label, kind)


def empty(msg: str) -> str:
    return f'<div class="empty">{e(msg)}</div>'


def tile(n: Any, label: str) -> str:
    return f'<div class="tile"><div class="n">{e(n)}</div><div class="k">{e(label)}</div></div>'


def table(headers: Sequence[str], rows: Sequence[Sequence[str]], empty_msg: str) -> str:
    if not rows:
        return empty(empty_msg)
    head = "".join(f"<th>{e(h)}</th>" for h in headers)
    body = "".join("<tr>" + "".join(f"<td>{cell}</td>" for cell in row) + "</tr>" for row in rows)
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def ul(items: Iterable[str], empty_msg: str) -> str:
    items = list(items)
    if not items:
        return empty(empty_msg)
    li = "".join(f"<li>{item}</li>" for item in items)
    return f"<ul>{li}</ul>"


def files_chips(paths: Sequence[str]) -> str:
    if not paths:
        return '<span class="files" style="color: var(--fg-dim);">—</span>'
    return '<span class="files">' + "".join(f"<span>{e(p)}</span>" for p in paths) + "</span>"


def fmt_int(value: Any) -> str:
    try:
        return f"{int(value):,}"
    except (TypeError, ValueError):
        return e(value)


def fmt_ts(value: Optional[str]) -> str:
    if not value:
        return "—"
    return e(value).replace("T", " ").replace("Z", " UTC")


def load_json(path: Path) -> Optional[dict]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        sys.stderr.write(f"warning: {path} is malformed JSON: {exc}\n")
        return None


def header_meta(campaign: dict) -> str:
    started = (campaign.get("window") or {}).get("started_at")
    ended = (campaign.get("window") or {}).get("ended_at")
    pairs: List[Tuple[str, str]] = []
    pairs.append(("Status", status_badge(campaign.get("status"))))
    if started or ended:
        pairs.append(("Window", f"{fmt_ts(started)} → {fmt_ts(ended) if ended else '<em>in flight</em>'}"))
    scope = campaign.get("scope") or {}
    rows = scope.get("roadmap_rows") or []
    if rows:
        pairs.append(("Roadmap rows", ", ".join(e(r) for r in rows)))
    out_of = scope.get("out_of_scope") or []
    if out_of:
        pairs.append(("Out of scope", ", ".join(e(r) for r in out_of)))
    if campaign.get("verify_gate"):
        pairs.append(("Verify gate", f"<code>{e(campaign['verify_gate'])}</code>"))
    cap = campaign.get("work_cap_tokens")
    used = campaign.get("work_used_tokens")
    if cap or used:
        cap_s = fmt_int(cap or 0)
        used_s = fmt_int(used or 0)
        pairs.append(("Orchestrator tokens", f"{used_s} / {cap_s}"))
    if campaign.get("roadmap_path"):
        pairs.append(("Roadmap source", f"<code>{e(campaign['roadmap_path'])}</code>"))
    if campaign.get("tracker"):
        pairs.append(("Tracker", e(campaign["tracker"])))
    dts = "".join(f"<dt>{k}</dt><dd>{v}</dd>" for k, v in pairs)
    return f'<dl class="meta">{dts}</dl>'


def totals_tiles(campaign: dict) -> str:
    totals = campaign.get("totals") or {}
    keys = ("verified", "blocked", "parked", "next_campaign", "quarantined")
    labels = {
        "verified": "Verified",
        "blocked": "Blocked",
        "parked": "Parked",
        "next_campaign": "Next campaign",
        "quarantined": "Quarantined",
    }
    parts = [tile(totals.get(k, 0), labels[k]) for k in keys]
    return "".join(parts)


def evidence_by_item(evidence: List[dict]) -> Dict[str, List[dict]]:
    out: Dict[str, List[dict]] = {}
    for ev in evidence:
        item_id = ev.get("item_id")
        if not item_id:
            continue
        out.setdefault(item_id, []).append(ev)
    return out


def evidence_index(evidence: List[dict]) -> Dict[str, dict]:
    return {ev.get("id"): ev for ev in evidence if ev.get("id")}


def render_evidence_list(refs: Sequence[str], index: Dict[str, dict]) -> str:
    if not refs:
        return '<span class="files" style="color: var(--fg-dim);">—</span>'
    parts = []
    for ref in refs:
        ev = index.get(ref)
        if not ev:
            parts.append(f'<li>{e(ref)} <span style="color: var(--fg-dim);">(missing)</span></li>')
            continue
        kind = e(ev.get("kind", "?"))
        label = e(ev.get("label") or ref)
        result = result_badge(ev.get("result"))
        path = ev.get("artifact_path")
        link = f' <a href="{e(path)}">{e(path)}</a>' if path else ""
        parts.append(f"<li><strong>{kind}</strong> · {label} {result}{link}</li>")
    return f'<ul class="evidence-list">{"".join(parts)}</ul>'


def status_banner(campaign: dict) -> str:
    status = campaign.get("status")
    if status == "complete":
        return ""
    if status == "in_progress":
        return '<div class="banner info">Campaign still in flight. Counts reflect work completed so far.</div>'
    if status == "blocked":
        return '<div class="banner warn">Campaign halted on a blocker. See blocked table for details.</div>'
    if status == "aborted":
        return '<div class="banner warn">Campaign was aborted before finishing. Partial state recorded.</div>'
    return ""


# ----- per-report builders -------------------------------------------------

def build_changelog(campaign, queue, evidence, ledger):
    items = queue.get("items") or []
    by_item_ev = evidence_by_item(evidence.get("evidence") or [])
    ev_index = evidence_index(evidence.get("evidence") or [])

    verified_rows = []
    for it in items:
        if it.get("lane") != "verified":
            continue
        ev_refs = it.get("evidence_refs") or [ev.get("id") for ev in by_item_ev.get(it.get("id"), [])]
        verified_rows.append([
            f'<strong>{e(it.get("id"))}</strong><br><span style="color: var(--fg-dim);">{e(it.get("title"))}</span>',
            e(it.get("source") or "—"),
            e(it.get("user_visible_change") or "—"),
            render_evidence_list(ev_refs, ev_index),
            files_chips(it.get("owned_files") or []),
        ])

    blocked_rows = []
    for it in items:
        if it.get("lane") not in ("blocked", "parked", "quarantined"):
            continue
        blocked_rows.append([
            f'<strong>{e(it.get("id"))}</strong><br><span style="color: var(--fg-dim);">{e(it.get("title"))}</span>',
            lane_badge(it.get("lane")),
            e(it.get("notes") or it.get("user_visible_change") or "—"),
            e(it.get("source") or "—"),
        ])

    next_rows = []
    for it in items:
        if it.get("lane") != "next_campaign":
            continue
        next_rows.append([
            f'<strong>{e(it.get("id"))}</strong><br><span style="color: var(--fg-dim);">{e(it.get("title"))}</span>',
            e(it.get("source") or "—"),
            ", ".join(e(r) for r in (it.get("roadmap_rows") or [])) or "—",
            e(it.get("notes") or "—"),
        ])

    wave_rows = []
    for wave in (ledger.get("waves") or []):
        wave_rows.append([
            f'<strong>W{e(wave.get("n"))}</strong>',
            f'{fmt_ts(wave.get("started_at"))} → {fmt_ts(wave.get("ended_at"))}',
            e(wave.get("bundles_run") or "—"),
            verify_badge(wave.get("verify_result")),
            f'{e(wave.get("retries") or 0)} retries, {e(len(wave.get("quarantines") or []))} quarantines',
            fmt_int(wave.get("tokens_used") or 0),
            e(wave.get("notes") or "—"),
        ])

    return {
        "TITLE": f"Changelog — {campaign.get('id', 'campaign')}",
        "CAMPAIGN_ID": e(campaign.get("id") or "(no id)"),
        "CAMPAIGN_GOAL": e(campaign.get("goal") or "(no goal stated)"),
        "HEADER_META": header_meta(campaign),
        "TOTALS_TILES": totals_tiles(campaign),
        "STATUS_BANNER": status_banner(campaign),
        "VERIFIED_TABLE": table(
            ["Item", "Source", "User-visible change", "Evidence", "Files"],
            verified_rows,
            "No verified items yet.",
        ),
        "BLOCKED_TABLE": table(
            ["Item", "Lane", "Notes", "Source"],
            blocked_rows,
            "No blocked or parked items.",
        ),
        "NEXT_CAMPAIGN_TABLE": table(
            ["Item", "Source", "Roadmap rows", "Notes"],
            next_rows,
            "No items drafted into a next campaign.",
        ),
        "WAVES_TABLE": table(
            ["Wave", "Window", "Bundles", "Verify", "Friction", "Tokens", "Notes"],
            wave_rows,
            "No waves recorded.",
        ),
    }


def build_smoke_test(campaign, queue, evidence, ledger):
    smoke = ledger.get("smoke_test") or {}
    ev_index = evidence_index(evidence.get("evidence") or [])
    queue_index = {it.get("id"): it for it in (queue.get("items") or []) if it.get("id")}

    how_to_run = smoke.get("how_to_run") or []
    if how_to_run:
        how_html = "<pre>" + "\n".join(e(line) for line in how_to_run) + "</pre>"
    else:
        how_html = empty("No run instructions recorded.")

    items = smoke.get("items") or []
    rows_html_parts = []
    for s in items:
        sid = s.get("id") or ""
        label = s.get("label") or "(no label)"
        ev_refs = s.get("evidence_refs") or []
        source_items = s.get("source_items") or []

        sub_parts = []
        if ev_refs:
            ev_links = []
            for ref in ev_refs:
                ev = ev_index.get(ref)
                if not ev:
                    ev_links.append(f"{e(ref)} (missing)")
                    continue
                path = ev.get("artifact_path")
                kind = e(ev.get("kind", "?"))
                if path:
                    ev_links.append(f'{kind}: <a href="{e(path)}">{e(ev.get("label") or path)}</a>')
                else:
                    ev_links.append(f'{kind}: {e(ev.get("label") or ref)}')
            sub_parts.append("Evidence — " + " · ".join(ev_links))
        if source_items:
            srcs = []
            for q_id in source_items:
                q = queue_index.get(q_id)
                if q:
                    srcs.append(f'{e(q_id)} <span style="color: var(--fg-dim);">({e(q.get("title") or "")})</span>')
                else:
                    srcs.append(e(q_id))
            sub_parts.append("Source — " + " · ".join(srcs))
        sub_html = ""
        if sub_parts:
            sub_html = '<div class="sub">' + "<br>".join(sub_parts) + "</div>"

        rows_html_parts.append(
            f'<div class="checkbox-row" data-id="{e(sid)}">'
            f'<input type="checkbox" id="cb-{e(sid)}">'
            f'<div>'
            f'<div class="label"><label for="cb-{e(sid)}">{e(label)}</label>'
            f'<button type="button" class="fail-btn" title="Mark failed">fail</button></div>'
            f'{sub_html}'
            f'</div></div>'
        )
    checklist_html = "".join(rows_html_parts) or empty("No smoke-test items recorded.")

    questions = smoke.get("questions_for_po") or []
    questions_html = ul((e(q) for q in questions), "No questions for the PO.")
    non_goals = smoke.get("non_goals") or []
    non_goals_html = ul((e(g) for g in non_goals), "No non-goals recorded.")

    return {
        "TITLE": f"Smoke test — {campaign.get('id', 'campaign')}",
        "CAMPAIGN_ID": e(campaign.get("id") or "(no id)"),
        "CAMPAIGN_GOAL": e(campaign.get("goal") or "(no goal stated)"),
        "HEADER_META": header_meta(campaign),
        "HOW_TO_RUN": how_html,
        "CHECKLIST_ROWS": checklist_html,
        "QUESTIONS_LIST": questions_html,
        "NON_GOALS_LIST": non_goals_html,
        "TOTAL_ITEMS": str(len(items)),
    }


def build_roadmap_update(campaign, queue, evidence, ledger):
    pkt = ledger.get("roadmap_update") or {}
    section_updates = pkt.get("section_updates") or []
    new_coverage = pkt.get("new_coverage") or []
    ambiguous = pkt.get("po_owned_or_ambiguous") or []
    cmd = pkt.get("suggested_command") or "/roadmap --update"

    section_rows = []
    for su in section_updates:
        proposed = su.get("proposed") or "—"
        if proposed == "✅":
            kind = "ok"
        elif proposed == "🟡":
            kind = "info"
        else:
            kind = "muted"
        section_rows.append([
            f'<strong>{e(su.get("section"))}</strong>',
            e(su.get("current") or "—"),
            badge(proposed, kind),
            e(su.get("evidence") or "—"),
            ", ".join(e(w) for w in (su.get("linked_work") or [])) or "—",
        ])

    coverage_rows = []
    for nc in new_coverage:
        coverage_rows.append([
            f'<strong>{e(nc.get("section"))}</strong>',
            e(nc.get("issue") or "—"),
            e(nc.get("status") or "—"),
            e(nc.get("notes") or "—"),
        ])

    divergence = campaign.get("divergence_note")
    divergence_banner = ""
    if divergence:
        divergence_banner = f'<div class="banner warn"><strong>Divergence from roadmap suggestion:</strong> {e(divergence)}</div>'

    return {
        "TITLE": f"Roadmap update — {campaign.get('id', 'campaign')}",
        "CAMPAIGN_ID": e(campaign.get("id") or "(no id)"),
        "CAMPAIGN_GOAL": e(campaign.get("goal") or "(no goal stated)"),
        "HEADER_META": header_meta(campaign),
        "SUGGESTED_COMMAND": e(cmd),
        "DIVERGENCE_BANNER": divergence_banner,
        "SECTION_UPDATES_TABLE": table(
            ["Section", "Current", "Proposed", "Evidence", "Linked work"],
            section_rows,
            "No section updates proposed.",
        ),
        "NEW_COVERAGE_TABLE": table(
            ["Section", "Issue", "Status", "Notes"],
            coverage_rows,
            "No new backlog coverage filed.",
        ),
        "AMBIGUOUS_LIST": ul((e(a) for a in ambiguous), "No PO-owned cells flagged."),
    }


def build_retro(campaign, queue, evidence, ledger):
    signals = ledger.get("signals") or {}
    retro = ledger.get("retro") or {}

    friction = (
        (signals.get("retries") or 0)
        + (signals.get("quarantines") or 0)
        + (signals.get("verify_failures") or 0)
    )
    if (signals.get("total_waves") or 0) == 0:
        depth_banner = '<div class="banner muted">No waves recorded. Retro skipped.</div>'
    elif friction == 0:
        depth_banner = '<div class="banner muted">Clean run — no retries, quarantines, or verify failures. Retro kept short.</div>'
    else:
        depth_banner = '<div class="banner warn">Friction signals fired — full retro below.</div>'

    signal_tiles = "".join([
        tile(signals.get("total_waves", 0), "Waves"),
        tile(signals.get("retries", 0), "Retries"),
        tile(signals.get("quarantines", 0), "Quarantines"),
        tile(signals.get("verify_failures", 0), "Verify failures"),
        tile(signals.get("scout_tickets_accepted", 0), "Scout accepted"),
        tile(signals.get("scout_tickets_next_campaign", 0), "Scout → next"),
    ])

    return {
        "TITLE": f"Retro — {campaign.get('id', 'campaign')}",
        "CAMPAIGN_ID": e(campaign.get("id") or "(no id)"),
        "CAMPAIGN_GOAL": e(campaign.get("goal") or "(no goal stated)"),
        "HEADER_META": header_meta(campaign),
        "DEPTH_BANNER": depth_banner,
        "SIGNAL_TILES": signal_tiles,
        "WHAT_SLOWED_LIST": ul((e(x) for x in (retro.get("what_slowed") or [])), "Nothing slowed the agents."),
        "PROCESS_FIXES_LIST": ul((e(x) for x in (retro.get("process_fixes") or [])), "No process fixes recorded."),
        "FOLLOWUPS_LIST": ul((e(x) for x in (retro.get("followups") or [])), "No follow-up tickets."),
    }


BUILDERS = {
    "changelog": build_changelog,
    "smoke-test": build_smoke_test,
    "roadmap-update": build_roadmap_update,
    "retro": build_retro,
}


def substitute(template: str, vars: Dict[str, str]) -> str:
    out = template
    for k, v in vars.items():
        out = out.replace("{{ " + k + " }}", v)
    return out


def render_report(name: str, templates_dir: Path, styles: str, vars: Dict[str, str]) -> str:
    template_path = templates_dir / f"{name}.html"
    template = template_path.read_text(encoding="utf-8")
    vars = dict(vars)
    vars["STYLES"] = styles
    vars["GENERATED_AT"] = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return substitute(template, vars)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("campaign_json", type=Path, help="Path to campaign.json")
    parser.add_argument("--out", type=Path, default=None, help="Output directory (default: <campaign-dir>/reports)")
    parser.add_argument(
        "--report",
        choices=("all",) + REPORTS,
        default="all",
        help="Render only one report (default: all four)",
    )
    parser.add_argument("--templates", type=Path, default=None, help="Override templates dir")
    args = parser.parse_args(argv)

    campaign_path: Path = args.campaign_json.resolve()
    if not campaign_path.exists():
        parser.error(f"{campaign_path} not found")

    campaign_dir = campaign_path.parent
    out_dir: Path = (args.out or (campaign_dir / "reports")).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    script_dir = Path(__file__).resolve().parent
    templates_dir: Path = (args.templates or (script_dir.parent / "templates")).resolve()
    if not templates_dir.exists():
        parser.error(f"templates dir not found: {templates_dir}")

    css = (templates_dir / "_base.css").read_text(encoding="utf-8")
    styles = f"<style>\n{css}\n</style>"

    campaign = load_json(campaign_path) or {}
    queue = load_json(campaign_dir / "queue.json") or {"items": []}
    evidence = load_json(campaign_dir / "evidence.json") or {"evidence": []}
    ledger = load_json(campaign_dir / "ledger.json") or {}

    targets = REPORTS if args.report == "all" else (args.report,)
    written = []
    for name in targets:
        builder = BUILDERS[name]
        vars = builder(campaign, queue, evidence, ledger)
        vars = {k: ("" if v is None else str(v)) for k, v in vars.items()}
        html_out = render_report(name, templates_dir, styles, vars)
        out_path = out_dir / f"{name}.html"
        out_path.write_text(html_out, encoding="utf-8")
        written.append(out_path)

    for p in written:
        print(p)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
