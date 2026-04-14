# README Rubric

A README is a front door, not a warehouse.

In this repository, READMEs exist to help a reader understand what something is,
why it matters, and how to get to a successful first step quickly. Theoria
already has full docstrings, runnable examples, and a docs surface in the app,
so READMEs should not compete with those layers.

## Core Test

A good README answers these questions in order:

1. What is this?
2. Why would I use it?
3. How do I start in under two minutes?
4. What are the main things I can do with it?
5. Where do I go deeper?

If a section does not help answer one of those questions, it probably belongs in
JSDoc, examples, AGENTS, specs, or dedicated docs.

## Repository Principles

- Lead with the promise, not taxonomy.
- Get to a successful path before variants and edge cases.
- Prefer one strong example over many partial ones.
- Link outward instead of duplicating API docs.
- Use headings as reader questions, not internal architecture labels.
- Keep package truth in code and docstrings; keep README truth in orientation and first use.

## Canonical Shapes

### Root README

Use this shape for the repository root:

1. One-sentence description.
2. Quick start.
3. Package map or product map.
4. Where to explore next.
5. Minimal development guidance.

### Package README

Use this shape for published packages:

1. One-sentence description with audience and job.
2. Why use it.
3. Installation.
4. Quick start.
5. Common tasks or capability overview.
6. Learn more.

### App README

Use this shape for applications:

1. What the app is for.
2. Getting started.
3. Core routes or capabilities.
4. Development workflow.
5. Optional high-level architecture note.

## What Belongs

- A sharp opening sentence.
- A short explanation of why the thing exists.
- One installation path.
- One copy-pasteable quick start.
- A small set of common tasks, examples, or decision guidance.
- Links to deeper docs, examples, or related packages.

## What Does Not Belong

- Full API reference for every export.
- Exhaustive module, schema, or export inventories.
- Large example catalogs.
- Release process details.
- AGENTS instructions or maintainer-only workflow rules.
- Long environment variable matrices unless they are required for first run.
- Roadmap dumps or "implemented today" ledgers.
- Internal architecture seam inventories that matter only to maintainers.
- Research bibliographies longer than a short further-reading section.

## Writing Rules

- Put the quick start within the first 80 lines.
- Prefer 2 to 4 top-level sections after the intro.
- Prefer 1 to 3 code blocks total.
- Keep lists short; no section should need more than 7 bullets.
- Use short paragraphs.
- Prefer plain language before project-specific nouns.
- Explain why, when, constraints, or tradeoffs; do not restate what names already say.

## Example Rules

- README snippets must import from the real published package names or public subpaths, never local source paths.
- Prefer one meaningful workflow over toy trivia. Examples should feel like real social, scientific, agent, or computational work.
- Use Hugging Face runtime examples when demonstrating routed inference unless provider interoperability is the point of the section.
- Do not center README examples on throwaway prompts such as capital-city trivia when the package is meant for richer workflows.
- Keep deeper variants in package-owned examples or docstrings rather than stacking multiple README snippets.

## Size Targets

- Root README: 80 to 140 lines.
- App README: 60 to 120 lines.
- Most package READMEs: 90 to 180 lines.
- Larger packages may go beyond that only when they still read like a guide rather than a catalog.

## Review Checklist

- A new reader can explain the project from the first screenful.
- The quick start is the fastest meaningful path, not the most complete path.
- The README highlights the main value without listing everything.
- The page links to deeper documentation instead of inlining it.
- A maintainer can remove a section and know exactly where that information belongs instead.
