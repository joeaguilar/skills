---
description: Audit installable primitive registry, install scopes, and dependency graph.
argument-hint: [project-path] [--detail]
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

Also report enabled primitives by type, selected capability providers, missing
providers, and differences between global and project manifests. Use the registry
CLI and installed-skill audit rather than reconstructing their checks manually.
Report findings first; `--detail` includes the complete inventory and routing.

Include the retirement dry run when inspecting an installed Codex home:
`node codex/scripts/retire-archived-primitives.js --home <codex-home>`.
The archive is reference material, never an active provider. An audit alone does
not authorize applying migration, changing manifests, or installing primitives.

