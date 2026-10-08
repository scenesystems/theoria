---
"@scenesystems/effect-math": minor
"@scenesystems/effect-search": minor
---

Add `PseudoRandom` CPython and NumPy legacy streams over one MT19937 engine, with portable checkpoints and bit-exact upstream random/sequence fixtures. Move DSP sampling to the numerical package without a re-export shim. Add NumPy-order `Numeric.sumPairwise` and use it in `logSumExp`.

Align seeded categorical RandomSampler and TPE with Optuna's persistent startup and model streams, singleton handling, categorical draw order, and product-mixture scoring. Persist both streams through JSON optimization checkpoints. Exact trajectory checks stop before libm-sensitive acquisition ties; identical-input ties retain the earliest candidate.

Add `Numeric.sumNeumaier`, matching CPython 3.12's builtin float sum, including cancellation, overflow, infinities, and signed zero, with recorded interpreter evidence. DSP consumers use this reduction rather than Kahan or ordinary left-to-right sums where upstream calls `sum`.

`PseudoRandom.CPython` adds `randbelowValidated`, `randintValidated`, `choiceValidated`, `getrandbitsValidated` and `sampleValidated`, which check CPython's argument domain before drawing and fail with `PseudoRandom.InvalidArgument` without consuming randomness. The trusted forms produce identical values for valid arguments and raise the same `InvalidArgument` as a defect, before any draw, when a precondition is violated. Streams are constructed from a captured or decoded `State`.

Breaking: `CPython` and `NumPyLegacy` constructors take the public `PseudoRandom.State` rather than an internal mutable engine reference. Factories still construct independent streams from seeds. Public declarations no longer require private engine types.

Breaking: seeded sampler checkpoints now carry continuing RNG streams rather than a seed-only reconstruction. `Sampler.Checkpoint` `Random` entries require an `rng` key and `Tpe` entries require `rng` and `startupRng` keys (each a nullable `PseudoRandom.State`); earlier JSON checkpoints without them are rejected rather than reconstructed from the seed. Optimization journal entries are `OptimizationSnapshot.TrialRecord` values containing both the trial and its sampler checkpoint; custom storage implementations and journal producers must supply this current shape. Recovery advances to the last durable journal checkpoint, including when a crash prevents a later snapshot. Old journal shapes are not decoded. Sequential Random and TPE startup/model-phase recovery is tested against uninterrupted execution; unfinished concurrent reservations do not promise identical evaluation trajectories.
