---
"@scenesystems/effect-dsp": minor
---

Add TeacherTrace as the shared teacher-execution component, with checked signature compatibility, immutable leave-one-out overlays, complete trace evidence, acceptance thresholds, error budgets, execution-time events, and streaming. Signature.digest composes parameter instruction and field overrides and supplies both teacher compatibility and predictor cache identity.

Compile LabeledFewShot, BootstrapFewShot, and BootstrapRS into bound programs with parameter snapshots and concrete reports. LabeledFewShot resets demonstrations and samples independently per trainable predictor. BootstrapFewShot retains cross-example trace duplicates, prewarms uncompiled teachers with labeled examples, and fills only the remaining labeled capacity from unbootstrapped rows. Bound teachers retain their compiled demonstrations.

BootstrapRS evaluates independent zero-shot, labeled, unshuffled bootstrap, and seeded shuffled candidates in order, using full-validation failure-inclusive averages and earliest-winner ties. Its report retains candidate parameters, evaluation reports, and winnerSeed. stopAtScore is a fraction in [0, 1], equivalent to DSPy's percentage stop_at_score divided by 100.

Breaking option and report changes: bootstrap algorithms use metricThreshold, maxErrors, a teacher Module, and teacherSettings routed through ModelBinder. Synthetic teacher instruction changes and labeled-fallback switches and events are removed. BootstrapFewShot defaults to 4 bootstrapped demos, 16 labeled slots, and 1 round. BootstrapRS uses numCandidatePrograms (default 16), removes explicit seed lists, and replaces label/index-based reports with seed-based candidate history. These optimizers never install parameters into caller modules; Module.install is the explicit installation operation.

Correct Evaluate.maxErrors to abort when the failure count reaches the limit, rather than allowing one extra failure. The generic effect-study maxFailures primitive continues to count allowed failures; one shared internal conversion supplies DSPy-named error budgets.

Parity evidence covers seven bootstrap-family upstream fixtures, including labeled teacher prewarming, alongside local boundary and immutability tests. Python RNG-sequence equality and DSPy's hash-seeded selection between repeated invocations within one trace remain outside the verified behavior, as recorded in PARITY.md.
