/**
 * Cache keys and the service contract for language-model call memoization.
 * Automatic caching is durable across processes only when ModelIdentity is
 * declared (effect-inference always declares it). Otherwise runtime object
 * identity partitions process-local entries for the lifetime of the Cache
 * layer; closing its scope releases those identities, and a Cache service
 * installed without {@link layer} memoizes only declared identities.
 * Automatic cache failures warn and behave as misses or skipped writes;
 * explicit resolve retains typed errors.
 *
 * @since 0.1.0
 * @module
 */
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import { empty, ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import { Role } from "@scenesystems/effect-lm/Role"
import * as SearchCache from "@scenesystems/effect-search/Cache"
import { Context, Data, Effect, Layer, Option, Schema, String as Str } from "effect"

import * as LocalIdentities from "./internal/cache/identities.js"
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
  parametersHash: Schema.String,
  settings: Schema.toCodecJson(ModelSettings),
  role: Role,
  predictorId: Schema.String,
  signatureDigest: Schema.String,
  rolloutId: Schema.Option(Schema.Finite)
}) {}

const namespace = "effect-dsp/lm-cache"

/**
 * Carries request identity before durable canonicalization.
 *
 * @remarks
 * {@link key} encodes `input` and `parameters` using their required codecs,
 * hashes those wire representations canonically, and adds the active
 * rollout partition. Fingerprints identify the module implementation and
 * language-model runtime independently of request content.
 *
 * @since 0.1.0
 * @category models
 */
export class KeyRequest<Input, ParameterValues> extends Data.Class<{
  readonly moduleFingerprint: string
  readonly runtimeFingerprint: string
  readonly inputSchema: Schema.Codec<Input, unknown>
  readonly parametersSchema: Schema.Codec<ParameterValues, unknown>
  readonly input: Input
  readonly parameters: ParameterValues
  readonly settings?: ModelSettings
  readonly role?: Role
  readonly predictorId?: string
  readonly signatureDigest?: string
}> {}

/**
 * Carries a lazy cache request and the schema used to encode its output.
 *
 * @remarks
 * `compute` runs only after a miss. `outputSchema` controls durable encoding
 * and decoding, so its encoded form must remain compatible with previously
 * persisted values. `inputSchema` and `parametersSchema` select identity fields and
 * transformations; schema identifiers are not automatically part of the key.
 *
 * @since 0.1.0
 * @category models
 */
export class Request<Input, ParameterValues, Output, Failure, Requirement, EncodedOutput = Output> extends Data.Class<{
  readonly moduleFingerprint: string
  readonly runtimeFingerprint: string
  readonly inputSchema: Schema.Codec<Input, unknown>
  readonly parametersSchema: Schema.Codec<ParameterValues, unknown>
  readonly input: Input
  readonly parameters: ParameterValues
  readonly settings?: ModelSettings
  readonly role?: Role
  readonly predictorId?: string
  readonly signatureDigest?: string
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
    readonly get: <A, I>(key: Key, schema: Schema.Codec<A, I>) => Effect.Effect<Option.Option<A>, SearchCache.Error>
    readonly set: <A, I>(key: Key, schema: Schema.Codec<A, I>, value: A) => Effect.Effect<void, SearchCache.Error>
    readonly resolve: <Input, ParameterValues, Output, Failure, Requirement, EncodedOutput = Output>(
      request: Request<Input, ParameterValues, Output, Failure, Requirement, EncodedOutput>
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
export const key = <Input, ParameterValues>(
  request: KeyRequest<Input, ParameterValues>
): Effect.Effect<Key, SearchCache.Corrupt> =>
  Effect.all({
    inputHash: fingerprint(request.inputSchema, request.input, "input"),
    parametersHash: fingerprint(request.parametersSchema, request.parameters, "parameters"),
    rolloutId: RolloutRef
  }).pipe(
    Effect.map(({ inputHash, parametersHash, rolloutId }) =>
      new Key({
        moduleFingerprint: request.moduleFingerprint,
        runtimeFingerprint: request.runtimeFingerprint,
        settings: Option.getOrElse(Option.fromUndefinedOr(request.settings), () => empty),
        role: Option.getOrElse(Option.fromUndefinedOr(request.role), (): Role => "task"),
        predictorId: Option.getOrElse(Option.fromUndefinedOr(request.predictorId), () => request.moduleFingerprint),
        signatureDigest: Option.getOrElse(
          Option.fromUndefinedOr(request.signatureDigest),
          () => request.moduleFingerprint
        ),
        inputHash,
        parametersHash,
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
 * semantics. Process-local identities of runtimes without a declared
 * ModelIdentity are scoped to this layer and released when it closes.
 *
 * @since 0.1.0
 * @category layers
 */
export const layer: Layer.Layer<Cache, never, SearchCache.Cache> = Layer.effect(
  Cache,
  Effect.gen(function*() {
    const cache = yield* SearchCache.Cache
    return {
      get: <A, I>(key: Key, schema: Schema.Codec<A, I>) =>
        cache.get(
          new SearchCache.KeySpace({ namespace, keySchema: Key, valueSchema: schema }),
          key
        ),
      set: <A, I>(key: Key, schema: Schema.Codec<A, I>, value: A) =>
        cache.set(
          new SearchCache.KeySpace({ namespace, keySchema: Key, valueSchema: schema }),
          key,
          value
        ),
      resolve: <Input, ParameterValues, Output, Failure, Requirement, EncodedOutput = Output>(
        request: Request<Input, ParameterValues, Output, Failure, Requirement, EncodedOutput>
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
).pipe(Layer.merge(LocalIdentities.layer))

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
