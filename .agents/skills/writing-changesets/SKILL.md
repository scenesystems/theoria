---
name: writing-changesets
description: Writes consumer-facing release notes and selects package bumps. Use when assessing changeset requirements or adding or reviewing a changeset.
---

# Writing changesets

1. Read the release policy in `CONTRIBUTING.md`, `.changeset/config.json`, and the
   affected package manifests. Determine consumer impact and whether prepared
   package content requires a new version; an unchanged API does not imply that
   a refactor, performance fix, or packaging change needs no release.
2. Use `bun run changeset` to select affected published packages and bump types.
   Follow the repository's version policy, not the size of the diff. Do not edit
   generated changelogs or apply version bumps as part of writing a release note.
3. Lead with what consumers gain or what behavior is corrected. Explain why it
   matters and required caller changes when relevant. Use public API names and
   concrete behavior rather than implementation narration or architectural claims.
4. Keep one conceptual release note per changeset. Related packages may share it;
   independently meaningful changes may need separate notes. Check package names,
   bump types, and claims against the actual diff before finishing.

Do not create release notes for unpackaged tests or repository guidance with no
published impact. Do not include agent activity, work history, or a PR summary.
