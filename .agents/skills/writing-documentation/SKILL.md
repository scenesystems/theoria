---
name: writing-documentation
description: Writes reader-focused technical documentation. Use for substantial README, guide, reference, or API documentation changes.
---

# Writing documentation

- Identify the reader and their question. A README explains purpose, useful
  starting steps, and where to go next. A guide helps complete a task; reference
  describes exact public behavior; architecture explains boundaries and tradeoffs.
  Choose the job before choosing headings.
- Read the owning documentation and implementation. Update canonical material
  and link to it instead of duplicating policy, API catalogs, or setup instructions.
  Package READMEs explain public usage, not repository-wide development procedures.
- Lead with useful information. Use concrete nouns, active voice, short paragraphs,
  and prose for explanations. Use lists for actual lists and headings for navigation.
  Omit filler, promotional claims, empty sections, and narration of the work.
- Use the smallest complete example with current public APIs. Keep examples
  deterministic and bounded. Consult `researching-effect` for uncertain Effect
  semantics; do not turn implementation details into public guarantees.
- Check changed commands, links, and examples. Use the repository's existing
  documentation validation when applicable; do not build new validation machinery
  for prose. Inspect rendered output when changing presentation.
- Before finishing, remove anything that can disappear without losing useful
  information. Keep necessary explanation; brevity is not a reason to omit meaning.
