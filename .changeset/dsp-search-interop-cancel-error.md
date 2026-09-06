---
"@scenesystems/effect-dsp": minor
---

Optimizer failures are typed and carry their cause instead of being replaced or discarded.

- `EffectSearchInterop.cancel` carries `ArtifactStorageError` in its error channel, following `Study.cancel` in `@scenesystems/effect-search`: publishing the completion event to a persistent artifact sink can fail, and that failure is now typed.
- GEPA propagates the language-model error when the reflective mutation call fails, and the decoding errors of the reflection response are in its error channel. Previously the failure was swallowed and the parent instruction was re-proposed as if the model had returned it.
- GEPA candidate scores are the metric's own values. The `candidateBoost` that added a small increment per mutation step so that later candidates outranked equal earlier ones is removed; a candidate that does not improve the metric now fails the strict-improvement gate instead of being recorded as progress.
- BootstrapRS propagates a failure in bootstrap candidate generation instead of returning no candidates, and keeps a candidate out of the search only when it fails with `AllTrialsFailed` (zero successful evaluations); any other evaluation failure propagates. The final selection no longer replaces a study failure with a fabricated `AllTrialsFailed`.
- MIPROv2 preserves the effect-search study's own failure, such as `ArtifactStorageError`, instead of replacing it with `AllTrialsFailed`.

These widen public error types, which is a breaking change under 0.x semver, hence a minor release.
