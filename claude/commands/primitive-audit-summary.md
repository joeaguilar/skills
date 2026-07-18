---
description: Summarize primitive registry provider choices, install scopes, and dependency health.
argument-hint: [project-path]
---

# Primitive Audit Summary

Summarize the selected project's primitive graph and manifest health.

Report:

- enabled primitives by type
- selected providers for capabilities with multiple candidates
- missing providers
- stale ports
- global versus local manifest differences

Rules:

- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. (A summary run that changes no files has nothing to commit.)

