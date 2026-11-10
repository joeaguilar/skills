# Lean Codex fleet

The active fleet contains 30 local skills, five bundled system copies, no
standalone role agents, and one audit command: 36 primitives. The registry is
the source of truth for counts. Claude payloads and workflows are unchanged.

## Working defaults

Explicit user, global, and project rules take precedence over these defaults.
This machine's global rules require every build, test, and lint gate through
`gatr` when available, including short gates.

- Use `kgr` for supported structural questions; use `rg` for text and direct
  reads for known files. Do not scan the whole repository for a known-file edit.
- Use `gatr` for substantial/noisy gates and evidence that needs to survive a
  handoff. Short checks, servers, and interactive commands run directly.
- Use an established `itr` tracker for work spanning sessions, contributors, or
  dependencies. Read its skill for the entire lifecycle. Status questions are
  read-only; implementation of a tracked task includes routine state updates.
  Do not initialize tracking or file tickets just to make a workflow run.
- `mission` is the single substantive build workflow. It includes focused
  investigation and optional risk-based independent review. Routine edits do
  not need a named workflow. Commit only under the existing authorization policy.
- `blitz` is the single parallel executor. Use independent ownership, targeted
  worker checks, and one integrated gate after writers finish. `--commit-waves`
  requests coordinator commits explicitly. No nested executors or fixed scout
  counts. Scope, evidence, and bounded recovery survive consolidation.
- Planning, roadmap, review, and specialist resources are on demand. Ask only
  about material unresolved decisions. Preserve required human acceptance.

No invocation quota measures success. A tool earns its cost by answering a
specific unknown, catching a defect, preserving needed state, or avoiding repeat
setup. Minimal scope and useful verification belong in ordinary work.

## Consolidation and archive

| Former entry | Active replacement |
| --- | --- |
| feature-build, scout-strike, forge-change | mission; investigate/review/commit only as needed and authorized |
| overdrive, dual-blitz | blitz; one coordinator and optional wave commits |
| fastlane, run-the-rivers-dry | choose mission or blitz directly; normal persistence applies |
| story-style | itr's short issue template and existing project examples |
| bootstrap-project-docs | requested project docs; start with a concise AGENTS.md |
| ponytail, whetstone | proportional implementation and bounded revision in normal work |
| gauntlet | archived experiment; preserve measurement scripts for explicit future use |
| role agents | on-demand references in archived/agents, not installed workers |
| primitive-audit-summary | primitive-audit, with --detail for the full inventory |

Full retired payloads and their scripts remain in [archived/](archived/README.md).
They are not installed or registered. Consult an old role checklist only for a
specific missing detail; current active skills and project instructions govern.
Do not route current work to an archived workflow or copy its ceremony back in.

## Installation and existing state

The root installer and compatibility skill linkers reconcile archived payloads
before linking active ones. Node.js is required for that migration. Preview:

```text
./install.sh codex --all-primitives
node codex/scripts/retire-archived-primitives.js --home <codex-home>
```

`--apply` backs up only links to this checkout's retired paths or byte-identical
archived copies under `<codex-home>/primitive-backups/lean-fleet-*`. Modified
copies, unrelated links, and linked primitive roots are preserved and reported.
Restore a retired backup only after deciding whether it should be an active
custom skill; reinstalling archived workflows defeats the smaller fleet.

The migration does not rewrite project manifests, user customizations, Claude
homes, or product-owned `.system` skills. Old enablement/provider selections may
still name retired entries: review them with the audit command and select active
providers. Enabling a registry node is not installation or invocation policy.

Linked installed skills receive content changes immediately. Retired links are
cleaned by migration; copied installations need the install/update step. Restart
or refresh discovery in the client if its skill list still reflects an earlier
session. Specialized external/plugin skills are outside this repository's count.

## Platform divergence and verification

This consolidation is intentionally Codex-only. `PLATFORM_ONLY.tsv` declares
Claude counterparts that remain active after Codex retirement and removes dead
Codex-only declarations. Retired entries leave `codex/PARITY.tsv`; active source
baselines remain, so later Claude changes still trigger review. Do not restore
retired workflows or overwrite lean Codex behavior merely to achieve parity.

Validate the registry, frontmatter, archive isolation, migration behavior, and
both explorer platform modes. YAML and JSON describe the same registry. Preserve
specialist scripts and shared preflight detection; a smaller prompt is not a
reason to weaken actual correctness checks.
