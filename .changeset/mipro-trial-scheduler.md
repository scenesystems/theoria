---
"@scenesystems/effect-dsp": minor
---

MIPROv2 follows DSPy 3.4.0's compile defaults, automatic budgets, validation split and seeded multivariate TPE scheduling. Budgets count sampled trials separately from the baseline and inserted full-validation rows. The optimizer selects checkpoints by mean minibatch score and returns the best full-validation program. Events and reports expose the trial results. Zero-shot optimization retains demonstrations for instruction proposals while searching only instructions. Invalid datasets, invalid options and exhausted checkpoint combinations fail with typed MIPROv2 errors.

Checkpoint means use the exact percentages supplied to TPE, computed in DSPy's multiply/divide/round order from CPython-compatible sums. This preserves equal-mean ties. Public evaluation scores remain fractions.

Evaluate report means, per-example metric means and Metric.compose use the same CPython-compatible reduction. Evaluate retains unrounded fractions; MIPRO separately applies the upstream percentage operation order.

An absent or none `maxErrors` resolves to DSPy's default of 10 for bootstrap and search evaluations in both MIPROv2 and MIPROv2Search. An evaluation that reaches the limit is logged with its cause and scored zero. During search, expected module or metric failures are logged with the example input. Set `provideTraceback: true` to include the failure cause and stack; the default logs a hint instead. This setting changes neither events and reports nor bootstrap and proposal logging. Defects and interruption propagate.

Update callers for these breaking changes; the previous option names have no aliases:

- Rename `trialBudget` to `numTrials` and `fullEvalEvery` to `minibatchFullEvalSteps`.
- Remove `numInstructions`; instruction count derives from `numCandidates`. Choose either `numCandidates` or `auto`, which defaults to `"light"`.
- Replace the `diversityTemperature` prompt hint with `initTemperature`, which sets the proposer temperature.
- Supply `valset` explicitly to keep using the whole trainset for validation. The default uses the upstream 80% split. `minibatchSize` now defaults to 35 freshly sampled rows instead of a 50-row prefix.
- Read `MIPROv2.TrialEvaluation` fields from `TrialEvaluated` events.
- Use `MIPROv2Search.Result.program` and `parameters` instead of `module`, and rename `MIPROv2Candidates.DemoCandidate.params` to `parameters`.

New options include `auto`, `minibatch`, `teacher`, `teacherSettings`, `metricThreshold`, `maxErrors`, `numThreads`, `proposerSettings`, the four awareness flags, `viewDataBatchSize` and `provideTraceback`.
