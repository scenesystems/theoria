/**
 * Cache keys and the service contract for language-model call memoization.
 *
 * @since 0.1.0
 * @module
 */
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import * as SearchCache from "@scenesystems/effect-search/Cache"
import { Data, Effect, FiberRef, Layer, Schema, String as Str } from "effect"

import { RolloutRef } from "./internal/cache/rollout.js"

/** Identifies one language-model call within a module, runtime, and rollout. @since 0.1.0 @category models */
export class Key extends Schema.Class<Key>("effect-dsp/Cache/Key")({
  moduleFingerprint: Schema.String,
  runtimeFingerprint: Schema.String,
  inputHash: Schema.String,
  paramsHash: Schema.String,
  rolloutId: Schema.Option(Schema.Number)
}) {}

const namespace = "effect-dsp/lm-cache"

/** Carries the values used to construct a cache key. @since 0.1.0 @category models */
export class KeyRequest<Input, Params> extends Data.Class<{
  readonly moduleFingerprint: string
  readonly runtimeFingerprint: string
  readonly input: Input
  readonly params: Params
}> {}

/** Carries a lazy, schema-encoded cache request. @since 0.1.0 @category models */
export class Request<Input, Params, Output, Failure, Requirement, EncodedOutput = Output> extends Data.Class<{
  readonly moduleFingerprint: string
  readonly runtimeFingerprint: string
  readonly input: Input
  readonly params: Params
  readonly outputSchema: Schema.Schema<Output, EncodedOutput, never>
  readonly compute: Effect.Effect<Output, Failure, Requirement>
}> {}

/** Memoizes decoded language-model results under content-derived keys. @since 0.1.0 @category services */
export class Cache extends Effect.Tag("effect-dsp/Cache")<
  Cache,
  {
    readonly resolve: <Input, Params, Output, Failure, Requirement, EncodedOutput = Output>(
      request: Request<Input, Params, Output, Failure, Requirement, EncodedOutput>
    ) => Effect.Effect<SearchCache.Result<Output>, Failure | SearchCache.Error, Requirement>
  }
>() {}

const fingerprint = <Value>(value: Value, label: string): Effect.Effect<string, SearchCache.Corrupt> =>
  ContentDigest.fromUnknown("blake3-256", value).pipe(
    Effect.map(ContentDigest.toString),
    Effect.mapError((cause) =>
      new SearchCache.Corrupt({
        key: namespace,
        reason: Str.concat(label, Str.concat(" fingerprint: ", cause._tag))
      })
    )
  )

/** Computes a durable key in the current rollout partition. @since 0.1.0 @category constructors */
export const key = <Input, Params>(request: KeyRequest<Input, Params>): Effect.Effect<Key, SearchCache.Corrupt> =>
  Effect.all({
    inputHash: fingerprint(request.input, "input"),
    paramsHash: fingerprint(request.params, "params"),
    rolloutId: FiberRef.get(RolloutRef)
  }).pipe(
    Effect.map(({ inputHash, paramsHash, rolloutId }) =>
      new Key({
        moduleFingerprint: request.moduleFingerprint,
        runtimeFingerprint: request.runtimeFingerprint,
        inputHash,
        paramsHash,
        rolloutId
      })
    )
  )

/** Adapts effect-search cache storage to DSP language-model memoization. @since 0.1.0 @category layers */
export const layer: Layer.Layer<Cache, never, SearchCache.Cache> = Layer.effect(
  Cache,
  Effect.gen(function*() {
    const cache = yield* SearchCache.Cache
    return Cache.of({
      resolve: <Input, Params, Output, Failure, Requirement, EncodedOutput = Output>(
        request: Request<Input, Params, Output, Failure, Requirement, EncodedOutput>
      ) =>
        key(request).pipe(
          Effect.flatMap((cacheKey) =>
            cache.resolve(
              new SearchCache.Request({
                keySpace: new SearchCache.KeySpace({
                  namespace,
                  keySchema: Key,
                  valueSchema: request.outputSchema
                }),
                key: cacheKey,
                compute: request.compute
              })
            )
          )
        )
    })
  })
)

/** In-memory cache layer. @since 0.1.0 @category layers */
export const layerMemory: Layer.Layer<Cache> = Layer.provide(layer, SearchCache.layerMemory)

export { withRollout } from "./internal/cache/rollout.js"
