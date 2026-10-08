---
"@scenesystems/effect-dsp": minor
---

GEPA uses training examples for reflection and validation examples to select its best program, following the recorded DSPy 3.4.0 / GEPA 0.1.4 behavior. It checks the metric budget at iteration boundaries, so a run can exceed that budget. Reports count targeted feedback calls separately. Reflection uses critic settings and retains the predictor's actual input and raw output when reporting format failures.

Serializable checkpoints let `GEPA.resume` reproduce an uninterrupted Theoria run with the same module, datasets, options, metric and model responses. Invalid checkpoints fail with `GEPAError` before restoring randomness or evaluating examples. Custom `componentSelector`s that return unknown or frozen predictor paths also fail with `GEPAError`.

Checkpoint and proposer types are public GEPA models: `ProgramCandidate`, `PredictorInstruction`, `ParetoSnapshot`, `ExampleFrontierHolding`, `ParentSelectionWeight`, `BatchState` and `ReflectiveExample` replace internal-path schemas in `GEPA.State` and in the `instructionProposer` signature, so custom proposers and checkpoint tooling can name them.

Breaking: GEPA requires exactly one of `auto`, `maxMetricCalls` or `maxFullEvals`; `maxIterations` is now an optional absolute iteration boundary rather than the required budget. Defaults follow DSPy 3.4.0's GEPA signature (seed 0, merges enabled with 5 invocations, skipPerfectScore, failure/perfect scores 0/1).

Aggregate selection and acceptance decisions use CPython-compatible compensated sums so accumulation errors do not turn equal scores into improvements. Weighted random selection retains Python's ordinary cumulative addition.

Instruction extraction handles multiple or incomplete fences, Python whitespace and empty replies. Empty proposals no longer fall back to the original instruction. Structured and ReAct format failures produce targeted reflective samples. Feedback-metric, critic and custom-proposer failures abort without retry or parameter mutation; upstream skips failed proposals. Reflection prompts use Theoria's representation and are not byte-identical to Python's.
