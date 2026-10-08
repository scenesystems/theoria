---
"@scenesystems/effect-dsp": minor
---

Align GEPA's train/validation split, epoch-shuffled reflection batches, coverage-pruned parent choice, aggregate-best return, common-ancestor merges, and iteration-boundary metric ledger with pinned DSPy 3.4.0 / GEPA 0.1.4 execution. Expose targeted feedback calls separately from the metric budget, route reflection through critic settings, and retain actual predictor input/raw output for format-failure feedback.

Add serializable GEPA checkpoints and exact local continuation, including both CPython random streams and epoch/merge scheduler state. `GEPA.resume` validates a checkpoint against the module and datasets (nonempty unique candidates, the module's trainable predictor paths, earlier-candidate parents, one full validation score vector per candidate, in-range cursors, a coverage front derived from those scores, and a minibatch schedule for this trainset) and fails with a typed `GEPAError` before either stream is restored or any example is evaluated. Custom `componentSelector`s that return unknown or frozen predictor paths fail with a typed `GEPAError` instead of a defect.

Checkpoint and proposer types are public GEPA models: `ProgramCandidate`, `PredictorInstruction`, `ParetoSnapshot`, `ExampleFrontierHolding`, `ParentSelectionWeight`, `BatchState` and `ReflectiveExample` replace internal-path schemas in `GEPA.State` and in the `instructionProposer` signature, so custom proposers and checkpoint tooling can name them.

Breaking: GEPA requires exactly one of `auto`, `maxMetricCalls` or `maxFullEvals`; `maxIterations` is now an optional absolute iteration boundary rather than the required budget. Defaults follow DSPy 3.4.0's GEPA signature (seed 0, merges enabled with 5 invocations, skipPerfectScore, failure/perfect scores 0/1).

Use CPython-compatible compensated sums for aggregate selection, coverage tie-breaking, mutation/merge acceptance, and ancestor weights, so equal scores remain ties rather than improvements. Preserve the uncompensated cumulative-weight scan used by Python `random.choices`.

Match upstream instruction extraction across multiple/incomplete fences, Python whitespace and empty replies; empty proposals no longer fall back to the original instruction. Structured and ReAct format failures now produce targeted reflective samples. Feedback-metric, critic and custom-proposer typed failures still abort without retry or parameter mutation, deliberately unlike upstream proposal skipping. Native reflective prompt serialization remains bounded rather than byte-identical to Python.
