---
description: Rules for ephemeral PR-scoped spec tracking documents
globs: "**/*.md"
alwaysApply: true
---

# PR Spec Tracking

These specs live only as long as the PR they track. They are gitignored and never committed.

## Rules

1. **Task lists, not prose.** Every spec is a checklist of concrete work items with clear done criteria. No background essays, no architecture philosophy.

2. **Target-state TDD.** Define what the code looks like when finished — test names, function signatures, behavioral contracts — then track progress toward that target. Red tests first, green tests as proof of completion.

3. **Goal-oriented.** Every task answers "what ships?" not "what do we understand?" Understanding is a means, not a deliverable. If a task doesn't produce a committed artifact, it doesn't belong here.

4. **No proprietary context.** Theoria is MIT-licensed open source. Never reference proprietary codebases, internal architecture, internal research documents, or any private infrastructure. Reconstruct from understanding, never copy or cite proprietary sources.

5. **Session traceability is allowed.** Thread IDs, Amp URLs, agent names, and other session-specific identifiers may be included when they improve execution traceability, handoff clarity, or completion auditing. Keep them additive to the checklist rather than replacing concrete shipping details.

6. **Definition of done is a command.** Every spec ends with the exact shell commands that prove completion. If you can't run it, it's not done.

7. **One spec per wave.** Each wave file tracks one package or one cross-cutting concern. No mega-specs that track everything.
