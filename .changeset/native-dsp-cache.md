---
"@scenesystems/effect-dsp": minor
---

Expose `DspCacheKeyRequest` and `DspCacheRequest` as native Effect data models, preserving input, parameter, encoded-output, failure, and service relationships. Cache resolution returns the shared Schema-derived `SchemaCacheResult` tuple with its value and hit/miss status.

**Breaking (0.x):** `DspCache.resolve` type parameters change from `<Output, Error, R>` to `<Input, Params, Output, Failure, Requirement, EncodedOutput?>`. Prefer inference by removing explicit type arguments, or update them to the new order.

Use the updated schema-cache Layers so concurrent reads and mutations cannot restore stale values within one cache instance. Caller-facing Layer requirements remain unchanged.
