---
"effect-text": minor
---

Strengthens the experimental calibration lane in `effect-text`.

- adds explicit calibration objective metadata, search descriptors, study artifact schemas, and optimization reports
- integrates seeded `effect-search` studies with `StudySnapshot` artifacts and ordered `StudyEvent` logs for fresh calibration runs
- routes calibration scoring through internal `effect-math` adapters for weighted loss aggregation and per-case loss summaries without leaking `effect-math` types into the public package surface
- expands the experimental calibration contract suite to cover exact-line corpora, snapshot resume parity, and effect-math boundary governance
- updates the calibration example, package scripts, and README so the `effect-search` and `effect-math` relationships are concrete and test-backed
