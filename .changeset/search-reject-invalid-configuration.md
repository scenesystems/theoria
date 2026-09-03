---
"@scenesystems/effect-search": minor
---

Reject configurations that previously passed validation:

- `Study.optimize` requires `trials` and `concurrency` to be integers, rejects a non-zero `epsilon` for single-objective studies, and rejects `targetValue` and `noImprovementWindow` for multi-objective studies.
- Single-objective `tell` fails with `InvalidObjectiveValue` for non-finite numbers.
- `Scheduler.hyperband` and `Scheduler.bohb` reject non-finite `maxResource`, `reductionFactor`, and `explorationRatio`.
- The TPE sampler requires `nStartupTrials` and `nEiCandidates` to be finite integers.
- The experimental scenario schemas declare `maxDepth`, `minSamplesLeaf`, `depth`, and `batchSize` as `Schema.Int`.
