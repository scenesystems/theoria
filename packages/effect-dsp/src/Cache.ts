/**
 * Cache keys and the service contract for language-model call memoization.
 *
 * @since 0.1.0
 * @module
 */
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import * as SearchCache from "@scenesystems/effect-search/Cache"
import { Context, Data, Effect, Layer, Schema, String as Str } from "effect"

import { RolloutRef } from "./internal/cache/rollout.js"

/**
 * Durable identity for one language-model request.
 *
 * @remarks
 * Module and runtime fingerprints preserve caller-selected identities. Input
 * and parameter Schema-encoded values are canonically fingerprinted, while `rolloutId`
 * isolates concurrent candidate evaluations from one another.
 *
 * @since 0.1.0
 * @category models
 */
export class Key extends Schema.Class<Key>("@scenesystems/effect-dsp/Cache/Key")({
  moduleFingerprint: Schema.String,
  runtimeFingerprint: Schema.String,
  inputHash: Schema.String,
  paramsHash: Schema.String,
  rolloutId: Schema.Option(Schema.Finite)
}) {}

const namespace = "effect-dsp/lm-cache"

/**
 * Carries request identity before durable canonicalization.
 *
 * @remarks
 * {@link key} encodes `input` and `params` using their required owner codecs,
 * hashes those wire representations canonically, and adds the active
 * rollout partition. Fingerprints identify the module implementation and
 * language-model runtime independently of request content.
 *
 * @since 0.1.0
 * @category models
 */
export class KeyRequest<Input, Params> extends Data.Class<{
  readonly moduleFingerprint: string
  readonly runtimeFingerprint: string
  readonly inputSchema: Schema.Codec<Input, unknown>
  readonly paramsSchema: Schema.Codec<Params, unknown>
  readonly input: Input
  readonly params: Params
}> {}

/**
 * Carries a lazy cache request and the schema used to encode its output.
 *
 * @remarks
 * `compute` runs only after a miss. `outputSchema` controls durable encoding
 * and decoding, so its encoded form must remain compatible with previously
 * persisted values. `inputSchema` and `paramsSchema` select identity fields and
 * transformations; schema identifiers are not automatically part of the key.
 *
 * @since 0.1.0
 * @category models
 */
export class Request<Input, Params, Output, Failure, Requirement, EncodedOutput = Output> extends Data.Class<{
  readonly moduleFingerprint: string
  readonly runtimeFingerprint: string
  readonly inputSchema: Schema.Codec<Input, unknown>
  readonly paramsSchema: Schema.Codec<Params, unknown>
  readonly input: Input
  readonly params: Params
  readonly outputSchema: Schema.Codec<Output, EncodedOutput>
  readonly compute: Effect.Effect<Output, Failure, Requirement>
}> {}

/**
 * Memoizes decoded language-model results under content-derived keys.
 *
 * @remarks
 * Resolution preserves the lazy computation's `Failure` and `Requirement`
 * channels and adds `SearchCache.Error` for canonicalization, encoding,
 * decoding, and backend failures. Failed computations are not cached; failed
 * backend lookups and writes evict local lookup state rather than publish
 * an uncertain value.
 *
 * @since 0.1.0
 * @category services
 */
export class Cache extends Context.Service<
  Cache,
  {
    readonly resolve: <Input, Params, Output, Failure, Requirement, EncodedOutput = Output>(
      request: Request<Input, Params, Output, Failure, Requirement, EncodedOutput>
    ) => Effect.Effect<SearchCache.Result<Output>, Failure | SearchCache.Error, Requirement>
  }
>()("@scenesystems/effect-dsp/Cache") {}

const fingerprint = <Value>(
  schema: Schema.Codec<Value, unknown>,
  value: Value,
  label: string
): Effect.Effect<string, SearchCache.Corrupt> =>
  ContentDigest.fromSchema(schema, value).pipe(
    Effect.map(ContentDigest.toString),
    Effect.mapError((cause) =>
      new SearchCache.Corrupt({
        key: namespace,
        reason: Str.concat(label, Str.concat(" fingerprint: ", cause._tag))
      })
    )
  )

/**
 * Canonically fingerprints request input and parameters in the current rollout partition.
 *
 * @since 0.1.0
 * @category constructors
 */
export const key = <Input, Params>(request: KeyRequest<Input, Params>): Effect.Effect<Key, SearchCache.Corrupt> =>
  Effect.all({
    inputHash: fingerprint(request.inputSchema, request.input, "input"),
    paramsHash: fingerprint(request.paramsSchema, request.params, "params"),
    rolloutId: RolloutRef
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

/**
 * Adapts the configured effect-search cache backend to DSP memoization.
 *
 * @remarks
 * This layer requires `SearchCache.Cache`; provide the desired memory,
 * filesystem, SQL, or custom search-cache layer at the application boundary.
 * The resulting DSP service retains the backend's durability and failure
 * semantics.
 *
 * @since 0.1.0
 * @category layers
 */
export const layer: Layer.Layer<Cache, never, SearchCache.Cache> = Layer.effect(
  Cache,
  Effect.gen(function*() {
    const cache = yield* SearchCache.Cache
    return {
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
    }
  })
)

/**
 * Installs the DSP cache with a process-local effect-search memory backend.
 *
 * @since 0.1.0
 * @category layers
 */
export const layerMemory: Layer.Layer<Cache> = Layer.provide(layer, SearchCache.layerMemory)

/**
 * Runs an effect in an isolated rollout cache partition.
 *
 * @remarks
 * Child fibers inherit the partition. The previous partition is restored when
 * the effect ends, and its success, failure, and requirement channels are
 * preserved unchanged.
 *
 * @since 0.1.0
 * @category combinators
 */
export { withRollout } from "./internal/cache/rollout.js"
