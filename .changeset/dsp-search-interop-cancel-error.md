---
"@scenesystems/effect-dsp": patch
---

`EffectSearchInterop.cancel` carries `ArtifactStorageError` in its error channel, following `Study.cancel` in `@scenesystems/effect-search`: publishing the completion event to a persistent artifact sink can fail, and that failure is now typed instead of discarded.
