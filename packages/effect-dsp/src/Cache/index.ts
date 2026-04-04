/**
 * Shared cache authority surface — thin DSP adapter over `effect-search/Cache`.
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
   * File-system-backed DspCache layer.
   *
   * @since 0.1.0
   */
  DspCacheFileSystem,
  /**
   * Live DspCache layer requiring a `SchemaCache` service.
   *
   * @since 0.1.0
   */
  DspCacheLive,
  /**
   * In-memory DspCache layer for tests.
   *
   * @since 0.1.0
   */
  DspCacheMemory,
  /**
   * SQLite-backed DspCache layer.
   *
   * @since 0.1.4
   */
  DspCacheSql
} from "./layer.js"
