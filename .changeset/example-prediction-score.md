---
"@scenesystems/effect-dsp": minor
---

Replace Example.output with optional raw labels and explicit or content-derived identity. Add Prediction and Module.call with invocation trace and usage. Metrics now receive the example, prediction, and phase context and return a finite Score with optional feedback. Add DSPy-normalized answer equality and token-boundary passage matching.

Breaking: `Metric.make`, `Metric.fromEffect`, `Metric.Result` and `Metric.PureFn` are removed. Use `Metric.fromSync` for synchronous label/output scorers and `Metric.withFeedback` for an effectful `Metric.Fn` over `(example, prediction, context)` returning `Metric.Score` (finite `value`, optional `feedback`). `Metric.Fn` keeps its name with that new signature. `Example.output` is replaced by optional raw `labels`. No aliases or adapters for the previous metric shape are provided.
