---
name: scout-strike
description: "Scout first: map unfamiliar code/system before focused fix; recon, survey, inspect strange repo; not routine edits."
metadata:
  short-description: Scout unfamiliar code before acting
---

# Scout Strike

Use this skill when the key risk is unfamiliar terrain. First build a read-only
map of the code or system, then make one focused change using that map. The
protocol adds value only when the map changes how the edit should land.

## Trigger Boundary

Use `scout-strike` when both are true:

- The user wants action, not just research.
- The target area is unfamiliar, broad, coupled, or risky enough that a blind edit
  could damage nearby behavior.

Do not use it for ordinary inspect-edit-test work in a known file. Do not use it
as a generic approval gate. If the scout phase does not produce a usable map,
stop and report the fog instead of making an uninformed change.

## Workflow

1. **Frame the strike.** Restate the intended action, the acceptance bar, and the
   unknowns that must be resolved before editing.
2. **Split the scout work.** Pick 2-4 read-only scout slices by subsystem, layer,
   question, or entry point. Fewer real slices are better than filler.
3. **Scout read-only.** Use `kgr`, `rg`, file reads, docs, and safe inspection
   commands. Do not edit, format, generate files, commit, or run commands that
   intentionally mutate project state. If independent subagents are available,
   send each a slice; otherwise perform separated scout passes yourself.
4. **Fuse the map.** Produce one terrain map with concrete paths, conventions,
   coupling, hazards, and unresolved unknowns. Reconcile conflicting scout
   findings instead of passing contradictions downstream.
5. **Strike from the map.** Make the focused change only where the map says it
   belongs. If multiple strikers are used, assign disjoint file sets. Keep edits
   scoped to the mapped target.
6. **Verify.** Run the narrowest meaningful checks first, then the repo's normal
   gate when practical. If verification exposes unmapped terrain, return to the
   map before widening the edit.
7. **Deliver.** Summarize the terrain that mattered, the change made, verification
   evidence, and any dark areas left unstruck.

## Scout Output Shape

For each scout slice, capture:

- **Terrain:** paths, entry points, call paths, data flow, conventions, and tests.
- **Strike-relevant:** the 1-3 facts that should shape the edit.
- **Hazards:** coupling, generated files, ownership boundaries, migrations, or
  surprising side effects.
- **Unknowns:** what the slice did not resolve.
- **Confidence:** high, medium, or low, with a short reason.

## Strike Rules

- Scouts are always read-only.
- A usable map is required before editing.
- The strike should be narrower than the scout phase.
- Do not let scout findings become a transcript. The final answer should be the
  change and the terrain facts that justified it.
