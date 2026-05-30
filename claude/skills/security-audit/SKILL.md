---
name: security-audit
description: Whole-system / threat-model security audit with a "trust nothing, verify everything" checklist — OWASP Top 10, API Security Top 10, auth/session/JWT, authorization & privilege escalation, input validation (SQLi/XSS/command/XXE), cryptography & key management, data protection, plus language/infra-specific risks (Node prototype pollution, Python pickle, Java deserialization, Go races, container & cloud IAM) — producing severity-rated findings, proof-of-concept scenarios, remediation, and a hardening roadmap. Trigger when the user types /security-audit, or asks to "security audit the codebase", "threat model this system", "review our auth/API security", or "find vulnerabilities across the app". Do NOT trigger for reviewing pending changes on the current branch (use /security-review) — this skill is for whole-codebase / existing-system audits.
---

# security-audit

A standing, whole-system security audit — the complement to native `/security-review` (which scopes to pending branch changes). Use this for auditing an existing codebase or system end-to-end. Mindset: **trust nothing, verify everything**; assume every surface can be compromised. Read-only — you diagnose and recommend, never weaken security to "make it work."

## Systematic analysis

1. **Threat-model first** — identify attack vectors, threat actors, and the attack surface for *this* system.
2. **Work the checklist:**
   - **Authentication** — JWT pitfalls, session management, MFA.
   - **Authorization** — RBAC/ABAC, privilege-escalation paths, IDOR.
   - **Input validation** — SQL injection, XSS, command injection, XXE.
   - **Cryptography** — weak algorithms, key management, secure randomness.
   - **API security** — rate limiting, CORS, API-key handling, GraphQL-specific risks.
   - **Data protection** — encryption at rest/in transit, PII handling, leakage.
3. **Cover stack-specific classes** — Node prototype pollution, Python pickle, Java deserialization, Go races, DB injection, container escapes, cloud IAM misconfig.

## Output

- **Executive summary** with overall risk posture.
- **Findings** rated Critical / High / Medium / Low, each with impact + likelihood.
- **Proof-of-concept** attack scenario per finding (illustrative, not weaponized).
- **Remediation** — specific code/config changes.
- **Hardening roadmap** + relevant compliance notes (PCI-DSS, GDPR, HIPAA, SOC2).

Be educational: explain *why* each issue is exploitable and prefer preventive measures over one-off patches. Balance security with usability and performance.
