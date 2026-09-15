---
"@scenesystems/effect-search": minor
---

Fix cache publication races: serialize reads, writes, removals, and miss computations per key within one service instance, including simultaneous acquisition of a previously unused key. Different keys progress independently. Failed lookups are immediately retryable; failed or interrupted mutations invalidate uncertain local state without hiding failures. Cancelled waiters do not encode values or mutate the backend.

**Breaking (0.x):**

- Direct `makeSchemaCache()` callers must provide `Scope` for reference-counted per-key locks. `SchemaCacheLive` owns that scope when used as a Layer.
- Pass the configuration Schema to `StudyObjectiveCache`: use `resolve(new StudyObjectiveCacheRequest({ schema, config, compute }))` and `invalidate(schema, config)`. Each operation encodes the configuration once and fingerprints its encoded form; existing identity-Schema fingerprints remain unchanged.

Expose `SchemaCacheRequest` and Schema-derived `SchemaCacheResult` tuples. Keep key encoding lazy and validate SQL result rows through `SqlSchema`.
