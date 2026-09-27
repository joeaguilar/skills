---
name: changelog
description: "Use to write release notes or changelogs from a specified commit range, release, or development period. Adapt to the intended audience and distinguish shipped changes from pending work."
---

# Changelog

Resolve the requested release/range and audience from context. Read existing
release-note conventions, git history, and available PR/issue evidence. If the
base is ambiguous, state the proposed range or ask before describing a release
as shipped. An issue's closed state alone does not prove inclusion in a release.

Group related commits by user-visible change. Remove duplicate merge/revert noise;
check the resulting diff when a commit title does not establish actual behavior.
Use only categories that have content. Lead with breaking changes and material
security fixes, then features and fixes. Include migration steps only when the
change provides enough evidence to describe them accurately.

For developers, preserve affected interfaces and compatibility detail. For users,
explain what they can now do and known limitations. Match project tone; do not
invent business impact, performance gains, or version numbers. A SemVer proposal
is a recommendation unless the release version is already settled.

Return notes in conversation or update the requested changelog/release document.
Preserve manual content and existing history when editing. Drafting notes does
not itself publish a release, create a tag, or send a stakeholder message.

The `changelog-curator` agent is the delegation entry point for this same
capability; use these instructions rather than maintaining two checklists.
