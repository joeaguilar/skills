---
name: security-audit
description: "Use for a scoped system or codebase security audit and threat model, with reachable findings and practical remediation. Review only unless the user also requests fixes; not a mandatory checklist for ordinary coding."
---

# Security Audit

Identify assets, actors, trust boundaries, and sensitive data flows in the
system actually present. Establish whether the scope is source review, a local
test environment, or explicitly authorized live testing. An audit request does
not imply permission to attack a production service.

Trace likely attack paths through authentication, object/tenant authorization,
input handling, outbound requests, session/token handling, secrets, dependencies,
and deployment configuration as relevant to the stack. Check whether mitigations
already exist at another layer before reporting a bypass.

For each finding, provide the entry point and source/config location, attacker
prerequisites, reachable behavior, impact, confidence, and a specific remediation.
Use a bounded local reproduction or regression test where useful; distinguish a
confirmed exploit path from an unverified concern. Avoid copying real secrets
or sensitive records into the report.

Prioritize actionable findings by severity and likelihood. Record scope and
verification limits. Do not infer compliance certification or noncompliance
from a generic checklist, or recommend every control regardless of the threat
model. When current dependency or platform behavior matters, verify against
primary advisories and official documentation.

Return findings and focused remediation guidance. Apply fixes only when included
in the task; do not weaken controls to make a test pass. The existing
`backend-security-auditor` agent delegates backend portions using this method.
