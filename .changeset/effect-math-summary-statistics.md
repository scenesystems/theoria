---
"effect-math": patch
---

Adds `Statistics.summaryStatistics(values)` for non-empty chunks.

- returns the existing `SummaryStatistics` tagged class in one pass
- treats singleton chunks deterministically with zero variance and standard deviation
- includes tests to keep its results aligned with the validated and runtime-policy variants
