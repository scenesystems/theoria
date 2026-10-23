---
name: writing-contributions
description: Drafts clear pull request descriptions and issues. Use when writing or reviewing PR titles, PR bodies, bug reports, or feature requests.
---

# Writing contributions

Read [CONTRIBUTING.md](../../../CONTRIBUTING.md) for tracking, issue references,
and verification requirements, and inspect the relevant diff or evidence. Use a
specific, behavior-oriented title and the shortest complete explanation. Omit
unnecessary checklists.

## Pull requests

Use the [PR template](../../../.github/pull_request_template.md), including through
CLI or API paths that may not load it automatically. Keep its required headings
and use a short paragraph or a few useful bullets in each. Replace placeholders
with the actual issue and execution-thread links, and remove author prompts.

Read the complete current diff and synthesize a description for its reviewer.
Name the concrete change in the title. Describe the result rather than giving
instructions to perform the work.

Keep necessary technical detail and caller impact. Omit file inventories, agent
handoffs, work chronology, and delivery-status narration. Keep raw logs and
test-result dumps out of the body. Link or attach detailed evidence when useful, and preserve
evidence the user explicitly requires; brevity does not override that requirement.

When scope changes, rewrite the description around the complete diff. Replace
outdated explanations instead of appending investigation, review, or verification
updates as progress sections.

## Issues

For bugs, state observed and expected behavior, a minimal reproduction, impact,
and available evidence. Distinguish observations from suspected causes.

For features, state what users cannot do, why it matters, and what should become
possible. Add acceptance criteria or constraints only when they clarify completion
or materially restrict the solution. Do not prescribe machinery before establishing
the need. Split unrelated problems.

Before posting, check technical claims and remove repetition, filler, and private
context. A drafting-only request does not authorize remote changes; follow the
[delivery authority](../../../AGENTS.md#documentation-and-delivery) for
implementation requests.
