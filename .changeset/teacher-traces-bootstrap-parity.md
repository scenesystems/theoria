---
"@scenesystems/effect-dsp": minor
---

`TeacherTrace` runs a teacher program and records its predictions for demonstration selection. It checks signature compatibility, supports acceptance thresholds and error budgets, and exposes execution events through callbacks or a stream. Teacher execution leaves the caller's parameters unchanged. `Signature.digest` includes instruction and field overrides when identifying compatible teachers and cached predictions.

LabeledFewShot, BootstrapFewShot and BootstrapRS return bound programs with parameter snapshots and reports. LabeledFewShot resets demonstrations and samples independently per trainable predictor. BootstrapFewShot retains cross-example trace duplicates, prepares uncompiled teachers with labeled examples, and fills remaining labeled capacity from rows that did not produce bootstrapped demonstrations. Bound teachers retain their compiled demonstrations.

BootstrapRS evaluates zero-shot, labeled, unshuffled bootstrap and seeded shuffled candidates in that order. It averages the full validation set, including failed examples, and keeps the earliest winner on ties. Reports retain each candidate's parameters and evaluation, plus `winnerSeed`.

Ranking and `stopAtScore` use unrounded fractions in [0, 1]. DSPy's rounded percentages can select a different winner when unequal fractions round to the same value, or stop sooner near a threshold. An absent or none `maxErrors` defaults to 10 for each bootstrap compilation and validation pass.

Update callers for these breaking option and report changes; the previous names have no aliases:

- Rename `threshold` to `metricThreshold`. Pass a Module as `teacher` instead of a `LanguageModel` Layer; `teacherSettings` are routed through `ModelBinder`.
- Remove `fallbackToLabeledFewShot` and `fallbackLabeledDemoCount`. Synthetic teacher instruction changes and labeled-fallback switches and events are removed.
- Check demonstration budgets: BootstrapFewShot defaults to 4 bootstrapped demos, 16 labeled slots and 1 round.
- Rename BootstrapRS `numCandidates` to `numCandidatePrograms` (default 16). Remove explicit `seeds` lists and read seed-based candidate history instead of label/index-based reports.
- Run the returned bound program, or call `Module.install` explicitly to install its parameters in the original module.

Breaking: BootstrapRS no longer runs candidates through effect-search `Optimization.maximize`. It evaluates the seed catalog directly, as DSPy does, so a provided `OptimizationStorage`, `ObjectiveCache` or optimization event stream no longer applies: BootstrapRS candidates are not persisted, cached as objectives, or resumable through effect-search storage. Its report retains every candidate's parameters and evaluation report instead.

`Evaluate.maxErrors` aborts when the failure count reaches the limit. Study's `maxFailures` continues to count allowed failures and stops only when that count is exceeded.

LabeledFewShot, bootstrap labeled fill and BootstrapRS use CPython-compatible seeded sampling. LabeledFewShot defaults to seed 0. Successive predictor samples share a stream in stable predictor-path order, so differently ordered DSPy declarations can produce different samples. BootstrapRS shuffle and cap draws use separate streams with the same candidate seed, matching DSPy's call order.

Interruption after an accepted trace retains partial events and emits no completion. TeacherTrace retains every invocation; BootstrapFewShot selects the first invocation per predictor per example. DSPy's selection uses a seed derived from Python pickle bytes and can choose a different invocation.

BootstrapFewShot retries an example before moving to the next. It preserves existing default-teacher demonstrations when no preparation is requested and treats a zero acceptance threshold as absent. Teacher role, settings and retry rollout affect cache identity. `RoundStarted` fires when an example first reaches that round; `RoundCompleted` follows traversal and includes cumulative counts through that round. Conditional programs stop when every trainable predictor has enough demonstrations, which can collect more examples than DSPy's accepted-example limit.
