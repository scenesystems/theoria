---
"@scenesystems/effect-dsp": minor
---

Optimizer failures are typed and carry their cause instead of being replaced or discarded.

- `EffectSearchInterop.cancel` carries `ArtifactStorageError` in its error channel, following `Study.cancel` in `@scenesystems/effect-search`: publishing the completion event to a persistent artifact sink can fail, and that failure is now typed.
- GEPA propagates the language-model error when the reflective mutation call fails. Previously the failure was swallowed and the parent instruction was re-proposed as if the model had returned it.
- BootstrapRS keeps a candidate out of the search only when it fails with `AllTrialsFailed` (zero successful evaluations); any other evaluation failure propagates. The final selection no longer replaces a study failure with a fabricated `AllTrialsFailed`.

These widen public error types, which is a breaking change under 0.x semver, hence a minor release.
