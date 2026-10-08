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

Repin five SciPy/NumPy reference payloads to `NPY_DISABLE_CPU_FEATURES=AVX2,FMA3,AVX512F`, with `PYTHONHASHSEED=0` set before imports. This is a last-ulp provenance change with no library behavior change: numerical implementations, test assertions, tolerances and timeouts are unchanged. `fixtures:verify` now regenerates and byte-compares all 16 payloads and their manifest in CI; the host-sensitive `fixtures:verify:full` alternative is removed. All other fixture bytes are unchanged.

Approved reference SHA-256 changes, relative to `packages/effect-math/test/fixtures/scipy/`:

| File                                   | Before SHA-256                                                     | After SHA-256                                                      |
| -------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `complex/arithmetic-parity.json`       | `7afdba6b89ddd2fed7c832344d5ecf3a18711d4c22b952a61f9334687027d69f` | `44176b639216d0f83e17d701d62a58de4ad1e6a49f3ec4e7abc87878279b2f8f` |
| `distribution/algebra-parity.json`     | `11925ad2cf91c00dc6e6a3cba146e36c68d98e15f70996f3ac530aa55f2ae243` | `da6ee045938cacec6dd314ac93b166708ce9288c000629181425bd362c054d8e` |
| `numeric/logspace-parity.json`         | `64c286075a9458633f4202dba893a3c7816c24cc586c0fc0d8dae334a86824e4` | `5be8d1708ab788375cbed46864c73842308886879233a32157ef576dc34b7ed1` |
| `numeric/scalar-parity.json`           | `230413ca6154ca4015e70634702a71ba5b9a2c9e46d0333d5126f786784e0720` | `f84ce12ee22c3b9615c65fbad58b440411759383d5711b642a0cb316565fbe80` |
| `probability/distribution-parity.json` | `cdbae0f440d803d317430d8c35830fc962d02429d7b8b79dc9da26e91d19a303` | `5013a21e9cfebb5d2122c73b59d5bf89bf568d381e6c0a245fe39f7a0dea81b4` |
| `manifest.json`                        | `809ec1033cefa1ab56babce676bf3d69eedc3d53348d5770f2c9c8f2b1929c7b` | `2a266ac03147553bc5bf16e7282b099df3adc49925d5ddc9853fad538c0eabcb` |
