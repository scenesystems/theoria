/**
 * Memoizes language-model results by module state, input, and rollout identity.
 *
 * @remarks
 * Module execution consumes `DspCache`. Its base Layer requires an effect-search
 * `SchemaCache`; the specialized Layers select in-memory, filesystem, or
 * SQLite-compatible storage. `withRollout` partitions otherwise identical calls
 * during repeated sampling.
 *
 * @since 0.1.0
 */

export { RolloutRef, withRollout } from "./refs.js"

export { buildDspCacheKey, DspCache, DspCacheKey } from "./model.js"

export { DspCacheFileSystem, DspCacheLive, DspCacheMemory, DspCacheSql } from "./layer.js"
