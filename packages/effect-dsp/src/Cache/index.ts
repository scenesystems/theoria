/**
 * Memoizes language-model calls by module identity, content hashes, and an
 * optional fiber-local rollout index.
 *
 * @remarks
 * `DspCache` is the capability consumed by model programs. `DspCacheLive`
 * resolves entries through `SchemaCache`; the file-system, memory, and SQLite
 * Layers select the backing store.
 *
 * @since 0.1.0
 */

export {
  /**
   * Fiber-local rollout index for cache key diversity.
   *
   * @since 0.1.0
   */
  RolloutRef,
  /**
   * Scoped rollout identity combinator.
   *
   * @since 0.1.0
   */
  withRollout
} from "./refs.js"

export {
  /**
   * DSP cache key projection — constructed automatically by `DspCache.resolve`.
   *
   * @since 0.1.0
   */
  buildDspCacheKey,
  /**
   * DSP cache service tag for module-level LM call memoization.
   *
   * @since 0.1.0
   */
  DspCache,
  /**
   * Composite memoization key combining module identity, content hashes,
   * and optional rollout index.
   *
   * @since 0.1.0
   */
  DspCacheKey
} from "./model.js"

export {
  /**
   * Persists LM-call cache entries in a directory so they survive process
   * restarts and can be reused by later runs.
   *
   * @since 0.1.0
   */
  DspCacheFileSystem,
  /**
   * Adapts the currently provided `SchemaCache` into module-level LM-call
   * memoization; callers choose the storage backend through that dependency.
   *
   * @since 0.1.0
   */
  DspCacheLive,
  /**
   * Isolates cache entries to the lifetime of the provided layer, avoiding
   * filesystem or database state in tests and short-lived runs.
   *
   * @since 0.1.0
   */
  DspCacheMemory,
  /**
   * Persists LM-call cache entries in SQLite for reuse across process restarts
   * while retaining the same rollout-partitioned lookup behavior.
   *
   * @since 0.1.4
   */
  DspCacheSql
} from "./layer.js"
