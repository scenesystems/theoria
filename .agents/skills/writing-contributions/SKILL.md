---
name: writing-contributions
description: Drafts clear pull request descriptions and issues. Use when writing or reviewing PR titles, PR bodies, bug reports, or feature requests.
---

# Writing contributions

Read `CONTRIBUTING.md` and inspect the relevant diff or evidence. Use a specific,
behavior-oriented title and the shortest complete explanation. Omit unnecessary
checklists.

## Pull requests

Consult `.github/pull_request_template.md` when drafting, including through CLI
or API paths that may not load it automatically. Keep exactly these sections in
the submitted body, each with a short paragraph or a few useful bullets:

- `## Problem`: what is wrong or missing and why it matters.
- `## Change`: the resulting behavior and rationale useful to the reviewer.
- `## Verification`: decisive checks actually performed and material limitations.
  If no checks ran, state that and explain why.

Remove placeholder instructions, not the required headings.

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

Illustrative content using the required sections; do not reuse its verification claims:

> Title: Preserve Markdown warning emphasis and simplify package guides
>
> ## Problem
>
> Package READMEs mixed usage with implementation detail, and generated guides
> dropped emphasis from security warnings. Readers had to sift through internals
> and could miss important constraints.
>
> ## Change
>
> The guides now link to detailed API contracts, preserve nested Markdown emphasis,
> and omit empty introductory pages.
>
> ## Verification
>
> README examples typecheck, and generator and renderer tests pass. Inspected
> desktop and narrow-width guides retain readable warnings without clipping.
> GitHub rendering was not inspected live.

## Issues

For bugs, state observed and expected behavior, a minimal reproduction, impact,
and available evidence. Distinguish observations from suspected causes.

For features, state what users cannot do, why it matters, and what should become
possible. Add acceptance criteria or constraints only when they clarify completion
or materially restrict the solution. Do not prescribe machinery before establishing
the need. Split unrelated problems.

Before posting, check technical claims and remove repetition, filler, and private
context. Drafting does not authorize creating or editing an issue or PR remotely.
