---
"@scenesystems/effect-dsp": minor
---

Return immutable optimized programs, predictor parameter snapshots, and serializable algorithm reports from all optimizers. Candidate evaluation and Refine retries use fiber-local overlays; caller parameters remain unchanged on success, failure, and interruption. Use Module.install for explicit installation.

SavedState now carries leaf-predictor ParameterSet entries with optional metadata. Loading validates canonical paths and all demonstrations before installation. Composed roots and wrapper parameters are not persisted. Refine feedback now reaches every executed leaf of composed programs; per-predictor advice dictionaries remain planned.
