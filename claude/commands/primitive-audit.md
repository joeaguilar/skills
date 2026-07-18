---
description: Audit installable primitive registry, install scopes, and dependency graph.
argument-hint: [project-path]
---

# Primitive Audit

Audit the primitive registry and installer behavior for the selected project.

Check:

- global and local install targets for Claude and Codex
- missing primitive paths
- unknown required capabilities
- cross-type dependency chains
- dependency cycles
- stale Claude-to-Codex ports

Rules:

- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. (An audit run that changes no files has nothing to commit.)

