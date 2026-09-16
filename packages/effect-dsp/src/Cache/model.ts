/**
 * Cache keys and the service contract for language-model call memoization.
 *
 * @since 0.1.0
 */
import {
  Corrupt,
  durableFingerprint,
  type Error as CacheError,
  type Result as CacheResult
} from "@scenesystems/effect-search/Cache"
import { Data, Effect, FiberRef, Schema, String as Str } from "effect"

import { RolloutRef } from "./refs.js"

/**
 * Identifies one language-model call within a module, runtime, and rollout.
 *
 * @remarks
 * Input and parameter values are represented by durable fingerprints. A present
 * rollout index keeps concurrent candidate evaluations in separate partitions.
 *
 * @since 0.1.0
 * @category models
 */
export class DspCacheKey extends Schema.Class<DspCacheKey>("DspCacheKey")({
  /** Stable identity supplied by the calling module. */
  moduleFingerprint: Schema.String,
  /** Stable identity supplied by the language-model runtime. */
  runtimeFingerprint: Schema.String,
  /** Durable fingerprint of the module input. */
  inputHash: Schema.String,
  /** Durable fingerprint of the generation parameters. */
  paramsHash: Schema.String,
  /** Candidate partition inherited from {@link RolloutRef}, when present. */
  rolloutId: Schema.Option(Schema.Number)
}) {}

const DSP_CACHE_NAMESPACE = "effect-dsp/lm-cache"

/**
 * Carries the caller identities and values used to build one language-model
 * cache key.
 *
 * @since 0.1.0
 * @category models
 */
export class DspCacheKeyRequest<Input, Params> extends Data.Class<{
  /** Stable identity of the module implementation and prompt contract. */
  readonly moduleFingerprint: string
  /** Stable identity of the language-model runtime configuration. */
  readonly runtimeFingerprint: string
  /** Value included in the cache key through durable fingerprinting. */
  readonly input: Input
  /** Generation parameters included in the cache key through durable fingerprinting. */
  readonly params: Params
}> {}

/**
 * Carries one language-model cache request while preserving all generic
 * relationships among its input, parameters, output codec, computation error,
 * and computation requirements.
 *
 * @since 0.1.0
 * @category models
 */
export class DspCacheRequest<Input, Params, Output, Failure, Requirement, EncodedOutput = Output> extends Data.Class<{
  /** Stable identity of the module implementation and prompt contract. */
  readonly moduleFingerprint: string
  /** Stable identity of the language-model runtime configuration. */
  readonly runtimeFingerprint: string
  /** Value included in the cache key through durable fingerprinting. */
  readonly input: Input
  /** Generation parameters included in the cache key through durable fingerprinting. */
  readonly params: Params
  /** Codec used to persist and validate successful results. */
  readonly outputSchema: Schema.Schema<Output, EncodedOutput, never>
  /** Operation evaluated only after a cache miss. */
  readonly compute: Effect.Effect<Output, Failure, Requirement>
}> {}

/**
 * Memoizes decoded language-model results under content-derived keys.
 *
 * @remarks
 * A resolution reports `"hit"` when it reads a stored value and `"miss"` when
 * it runs and stores `compute`. Failures from `compute` retain their original
 * error type and are not stored. Key construction, backend access, and value
 * decoding fail with `CacheError`. Entry lifetime belongs to the configured
 * cache backend.
 *
 * @since 0.1.0
 * @category services
 */
export class DspCache extends Effect.Tag("effect-dsp/Cache/DspCache")<
  DspCache,
  {
    /**
     * Reads a matching value or evaluates `compute` and stores its successful
     * result. Calls for the same key are serialized by the configured cache.
     */
    readonly resolve: <Input, Params, Output, Failure, Requirement, EncodedOutput = Output>(
      request: DspCacheRequest<Input, Params, Output, Failure, Requirement, EncodedOutput>
    ) => Effect.Effect<CacheResult<Output>, Failure | CacheError, Requirement>
  }
>() {}

const fingerprintOrCorrupt = <Value>(
  value: Value,
  label: string
): Effect.Effect<string, Corrupt> =>
  durableFingerprint(value).pipe(
    Effect.mapError((cause) =>
      new Corrupt({
        key: DSP_CACHE_NAMESPACE,
        reason: Str.concat(label, Str.concat(" fingerprint: ", cause._tag))
      })
    )
  )

/**
 * Computes a cache key from caller identities, request content, and the current
 * rollout partition.
 *
 * @remarks
 * Input and parameter fingerprints are computed concurrently. Unsupported,
 * cyclic, or noncanonical values fail with `Corrupt`; the error reason
 * identifies which value could not be fingerprinted.
 *
 * @param request - Identities and request values that determine cache equality.
 * @returns A key containing both durable fingerprints and the current
 *   {@link RolloutRef} value.
 *
 * @since 0.1.0
 * @category constructors
 */
export const buildDspCacheKey = <Input, Params>(
  request: DspCacheKeyRequest<Input, Params>
): Effect.Effect<DspCacheKey, Corrupt> =>
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
