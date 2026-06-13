---
name: analytics-events
description: "Design a product-analytics event taxonomy and tracking plan from business goals — consistent event naming, property schemas (user/event/super/group/computed), user-journey & funnel mapping, privacy-compliant collection (GDPR/CCPA, consent, minimization), for Amplitude/Mixpanel/Segment/GA4/PostHog — producing a tracking plan with implementation snippets and QA/validation rules. Interactive: asks about KPIs and key user journeys first. Trigger when the user types /analytics-events, or asks to \"design an analytics tracking plan\", \"what events should we track\", \"set up an event taxonomy\", or \"instrument our funnel\". Do NOT trigger for data-processing pipelines/ETL (use /data-pipeline), for backend metrics/observability, or for writing application code."
---

# analytics-events

Design event tracking that yields actionable insight while respecting privacy. Interactive — **start from the business goal**: KPIs, the user journeys that matter, and consent/compliance constraints.

## Method

1. **Business goals** — the metrics and KPIs the tracking must serve.
2. **Journey mapping** — critical paths, touchpoints, decision moments.
3. **Event taxonomy** — structured, consistently named events (one convention, all platforms).
4. **Properties** — meaningful user / event / super / group / computed properties with correct types.
5. **Privacy review** — consent, minimization, retention, deletion, cross-border handling.
6. **Implementation + QA** — tracking specs, SDK snippets, validation rules and test scenarios.

## Event categories

User lifecycle · engagement · commerce · performance · experimentation (A/B exposure) · attribution · custom business events.

## Principles

- **Every event ties to a business outcome** — no tracking for tracking's sake.
- **One naming convention** across all platforms; consistency over cleverness.
- **Privacy-first** — minimize, get consent, honor deletion.
- **Debuggable + future-proof** — easy to validate, extensible as needs evolve.
