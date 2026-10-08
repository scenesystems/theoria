---
name: maintaining-fixtures
description: Maintains independent, reproducible reference data. Use when changing fixtures, conformance corpora, provenance, or generators.
---

# Maintaining fixtures

1. Read the affected package's scripts, fixture loader, and provenance documents.
   Identify the independent reference and how its output reaches the test.
2. Generate through the package's workflow with pinned dependencies. Python
   reference tools use `uv run`. Record source revisions, transformations, and
   dependency versions so another contributor can reproduce the result.
3. Review changed values before replacing expectations or updating hashes. Never
   derive expected results from the implementation under test or widen tolerances
   merely to accept regenerated output.
4. Run the applicable schema/provenance checks and affected behavioral tests.
   Distinguish checking file integrity from independently verifying an answer.
   Use exact comparisons for discrete results and mathematically justified
   absolute/relative tolerances for continuous results.

Extend the existing generator and test workflow rather than adding a parallel
acceptance harness or report. Keep provenance with the corpus; put work history
in commits, not package documentation.
