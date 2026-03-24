/**
 * DspCache service — thin projection of `effect-search/Cache` shared
 * authority for module-level LM call memoization.
 *
 * @since 0.0.0
 */
import { Effect, FiberRef, Schema } from "effect"
import { CacheCorrupt, type CacheError, type CacheResolution, durableFingerprint } from "effect-search/Cache"

import { RolloutRef } from "./refs.js"

/**
 * Composite memoization key for module-level LM call replay. Combines
 * module identity, runtime identity, content hashes for input and params,
 * and an optional rollout index for cache key diversity during `bestOfN`
 * evaluation.
 *
 * @see {@link RolloutRef} — fiber-local rollout identity source
 * @see {@link DspCache} — the service that builds and resolves these keys
 *
 * @since 0.0.0
 * @category models
 */
export class DspCacheKey extends Schema.Class<DspCacheKey>("DspCacheKey")({
  moduleFingerprint: Schema.String,
  runtimeFingerprint: Schema.String,
  inputHash: Schema.String,
  paramsHash: Schema.String,
  rolloutId: Schema.Option(Schema.Number)
}) {}

const DSP_CACHE_NAMESPACE = "effect-dsp/lm-cache"

/**
 * Thin adapter projecting DSP-specific module/input/params/rollout
 * semantics onto the `effect-search/Cache` shared authority. No hashing
 * logic lives here — `durableFingerprint` from `effect-search` handles
 * all content hashing.
 *
 * @see {@link DspCacheKey} — the composite key built by `resolve`
 * @see {@link DspCacheMemory} — in-memory layer for tests
 *
 * @since 0.0.0
 * @category services
 */
export class DspCache extends Effect.Tag("effect-dsp/Cache/DspCache")<
  DspCache,
  {
    readonly resolve: <O, E, R>(request: {
      readonly moduleFingerprint: string
      readonly runtimeFingerprint: string
      readonly input: unknown
      readonly params: unknown
      readonly outputSchema: Schema.Schema<O>
      readonly compute: Effect.Effect<O, E, R>
    }) => Effect.Effect<
      readonly [O, CacheResolution],
      E | CacheError,
      R
    >
  }
>() {}

const fingerprintOrCorrupt = (
  value: unknown,
  label: string
): Effect.Effect<string, CacheCorrupt> =>
  durableFingerprint(value).pipe(
    Effect.mapError((cause) =>
      new CacheCorrupt({
        key: DSP_CACHE_NAMESPACE,
        reason: `${label} fingerprint: ${cause.reason}`
      })
    )
  )

/**
 * Build a {@link DspCacheKey} from request fields and the current
 * {@link RolloutRef}. Hashes `input` and `params` via
 * `durableFingerprint` from `effect-search/Cache` — no hashing logic
 * lives in `effect-dsp`.
 *
 * @see {@link DspCacheKey} — the composite key returned
 * @see {@link RolloutRef} — fiber-local rollout identity read during construction
 *
 * @since 0.0.0
 * @category constructors
 */
export const buildDspCacheKey = (request: {
  readonly moduleFingerprint: string
  readonly runtimeFingerprint: string
  readonly input: unknown
  readonly params: unknown
}): Effect.Effect<DspCacheKey, CacheCorrupt> =>
  Effect.all({
    inputHash: fingerprintOrCorrupt(request.input, "input"),
    paramsHash: fingerprintOrCorrupt(request.params, "params"),
    rolloutId: FiberRef.get(RolloutRef)
  }).pipe(
    Effect.map(({ inputHash, paramsHash, rolloutId }) =>
      new DspCacheKey({
        moduleFingerprint: request.moduleFingerprint,
        runtimeFingerprint: request.runtimeFingerprint,
        inputHash,
        paramsHash,
        rolloutId
      })
    )
  )
