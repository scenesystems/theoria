/**
 * DspCache service — thin projection of `@scenesystems/effect-search/Cache` shared
 * authority for module-level LM call memoization.
 *
 * @since 0.1.0
 */
import {
  CacheCorrupt,
  type CacheError,
  type CacheResolution,
  durableFingerprint
} from "@scenesystems/effect-search/Cache"
import { Effect, FiberRef, Schema } from "effect"

import { RolloutRef } from "./refs.js"

/**
 * Cache key for one LM-call partition. Caller-supplied module and runtime
 * fingerprints partition entries; durable hashes identify input and parameter
 * content; the fiber-local rollout id optionally creates a separate partition.
 *
 * @see {@link RolloutRef} — fiber-local rollout identity source
 * @see {@link DspCache} — the service that builds and resolves these keys
 *
 * @since 0.1.0
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
 * DSP cache service backed by `@scenesystems/effect-search/Cache`. `resolve`
 * returns the decoded value and its `CacheResolution`; computation failures
 * remain `E`, while cache read, write, or decode failures are `CacheError`.
 * Entry lifetime is determined by the provided cache backend.
 *
 * @see {@link DspCacheKey} — the composite key built by `resolve`
 * @see {@link DspCacheMemory} — in-memory layer for tests
 *
 * @since 0.1.0
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
        reason: `${label} fingerprint: ${cause._tag}`
      })
    )
  )

/**
 * Build a {@link DspCacheKey} from caller fingerprints, durable hashes of
 * `input` and `params`, and the current {@link RolloutRef}. Values that cannot
 * be fingerprinted fail with `CacheCorrupt`; its reason identifies the input
 * or parameter projection.
 *
 * @see {@link DspCacheKey} — the composite key returned
 * @see {@link RolloutRef} — fiber-local rollout identity read during construction
 *
 * @since 0.1.0
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
