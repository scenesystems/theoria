---
"@scenesystems/effect-dsp": minor
"@scenesystems/effect-lm": minor
"@scenesystems/effect-inference": minor
---

Add predictor request caching partitioned by model identity, settings, role, rollout, predictor path, effective signature and parameters. Automatic caching warns and continues on cache failures; explicit cache operations retain typed errors. ModelIdentity declares provider/model identity for durable reuse, with process-local runtime identity as the fallback.

TextProvider.Runtime now requires declared model defaults. TextProvider configuration accepts defaults directly or through DSP_MODEL_SETTINGS. The binder resolves defaults, ambient provider configuration and invocation overrides in that order and exposes the resolved settings through ModelSettings.Current. Custom opaque layers must declare their captured settings for cache identity. Auto-caching applies at every temperature; rollout IDs partition sampling requests and cache: "never" opts out.

Retain parse attempts and failed response evidence under a per-invocation execution ID. Module.call returns selected completed entries separately from attempts and accounts for every model call. Cache hits do not count as new provider usage.

Add output-only signatures and immutable instruction, field prefix and field description edits. Persist editable field metadata inside ModuleParameters so parameter overlays, snapshots and load/save share one state channel. Saved parameters and trace entries use the new shapes directly.
