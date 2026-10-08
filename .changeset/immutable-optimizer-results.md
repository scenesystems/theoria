---
"@scenesystems/effect-dsp": minor
---

Return immutable optimized programs, predictor parameter snapshots, and serializable algorithm reports from all optimizers. Candidate evaluation and Refine retries use fiber-local overlays; caller parameters remain unchanged on success, failure, and interruption. Use Module.install for explicit installation.

SavedState now carries leaf-predictor ParameterSet entries with optional metadata. Loading validates canonical paths and all demonstrations before installation. Composed roots and wrapper parameters are not persisted. Refine feedback now reaches every executed leaf of composed programs; per-predictor advice dictionaries remain planned.

Breaking: optimizer summaries are algorithm reports on `Optimized.Result.report`. `BootstrapFewShot.EventSummary`, `MIPROv2.EventSummary` and `GEPA.EventSummary` are replaced by each module's `Report` (new schema identifiers); `summarizeEvents` folds events into that `Report`. `GEPA.OutcomeSummary`, `GEPA.summarizeOutcome`, `MIPROv2.OutcomeSummary` and `MIPROv2.summarizeOutcome` are removed. `DspError.BootstrapFailed` is removed: bootstrap collection reports `TeacherTrace.IncompatibleTeacher` and `TeacherTrace.TooManyErrors`, and checked module, metric and provider failures keep their own channels. Optimizers no longer leave the caller module in the winning state; install a result explicitly with `Module.install`. No aliases are provided.
