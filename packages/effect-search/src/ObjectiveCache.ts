/**
 * Caches objective values by canonical configuration identity.
 *
 * @since 0.7.0
 * @module
 */
import type * as SqlClient from "@effect/sql/SqlClient"
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import { Data, Effect, Layer, Match, Option, ParseResult, Schema, String as Str } from "effect"
import type * as Context from "effect/Context"

import * as Cache from "./Cache.js"
import { Value } from "./Objective.js"

const defaultScope = "optimization"

/**
 * Selects the namespace used for objective values.
 *
 * @since 0.7.0
 * @category models
 */
export class Options extends Schema.Class<Options>("effect-search/ObjectiveCache/Options")({
  scope: Schema.String
}) {}

/**
 * Couples a configuration codec and value with a lazy objective computation.
 *
 * @since 0.7.0
 * @category models
 */
export class Request<Configuration, Encoded, ComputeError, Requirements> extends Data.Class<{
  readonly schema: Schema.Schema<Configuration, Encoded, never>
  readonly config: Configuration
  readonly compute: Effect.Effect<Value, ComputeError, Requirements>
}> {}

const defaultOptions = new Options({ scope: defaultScope })

class PreparedKey<Encoded> extends Data.Class<{
  readonly encoded: Encoded
  readonly fingerprint: string
  readonly keySpace: Cache.KeySpace<Encoded, Value, Encoded>
}> {}

const keySpaceFor = <Configuration, Encoded>(
  options: Options,
  schema: Schema.Schema<Configuration, Encoded, never>
): Cache.KeySpace<Encoded, Value, Encoded> =>
  new Cache.KeySpace({
    namespace: Str.concat(options.scope, "/objective"),
    keySchema: Schema.encodedSchema(schema),
    valueSchema: Value
  })

const keySpacePrefix = <Encoded>(keySpace: Cache.KeySpace<Encoded, Value, Encoded>): string =>
  Str.concat(keySpace.namespace, ":")

const prepareKey = <Configuration, Encoded>(
  options: Options,
  schema: Schema.Schema<Configuration, Encoded, never>,
  config: Configuration
) => {
  const keySpace = keySpaceFor(options, schema)
  return Effect.suspend(() => Schema.encode(schema)(config)).pipe(
    Effect.mapError((error) =>
      new Cache.Corrupt({
        key: keySpacePrefix(keySpace),
        reason: ParseResult.TreeFormatter.formatIssueSync(error.issue)
      })
    ),
    Effect.flatMap((encoded) =>
      ContentDigest.fromUnknown("blake3-256", encoded).pipe(
        Effect.map(ContentDigest.toString),
        Effect.map((fingerprint) => new PreparedKey({ encoded, fingerprint, keySpace })),
        Effect.mapError((cause) =>
          new Cache.Corrupt({
            key: keySpacePrefix(keySpace),
            reason: Str.concat("fingerprint failure: ", cause._tag)
          })
        )
      )
    )
  )
}

/**
 * Reuses objective values for configurations with the same canonical identity.
 *
 * @since 0.7.0
 * @category services
 */
export class ObjectiveCache extends Effect.Tag("effect-search/ObjectiveCache")<
  ObjectiveCache,
  {
    readonly resolve: <Configuration, Encoded, ComputeError, Requirements>(
      request: Request<Configuration, Encoded, ComputeError, Requirements>
    ) => Effect.Effect<Cache.Result<Value>, Cache.Error | ComputeError, Requirements>
    readonly invalidate: <Configuration, Encoded>(
      schema: Schema.Schema<Configuration, Encoded, never>,
      config: Configuration
    ) => Effect.Effect<void, Cache.Error>
  }
>() {}

/** Objective-cache service implementation. @since 0.7.0 @category models */
export type Service = Context.Tag.Service<typeof ObjectiveCache>

/** Expected objective-cache failure. @since 0.7.0 @category models */
export type Error = Cache.Error

/**
 * Creates an objective cache over the ambient cache service.
 *
 * @since 0.7.0
 * @category constructors
 */
export const make = (
  options: Options = defaultOptions
): Effect.Effect<Service, never, Cache.Cache> =>
  Effect.gen(function*() {
    const cache = yield* Cache.Cache
    const observer = yield* Effect.serviceOption(Cache.Observer)
    const observe = (event: Cache.Event): Effect.Effect<void> =>
      Option.match(observer, {
        onNone: () => Effect.void,
        onSome: (service) => service.record(event)
      })

    return {
      resolve: ({ schema, config, compute }) =>
        prepareKey(options, schema, config).pipe(
          Effect.flatMap(({ encoded, fingerprint, keySpace }) =>
            cache.resolve(new Cache.Request({ keySpace, key: encoded, compute })).pipe(
              Effect.tap((result) =>
                observe(
                  Match.value(result.resolution).pipe(
                    Match.when("hit", () => new Cache.Hit({ fingerprint, scope: options.scope })),
                    Match.when("miss", () => new Cache.Miss({ fingerprint, scope: options.scope })),
                    Match.exhaustive
                  )
                )
              )
            )
          )
        ),
      invalidate: (schema, config) =>
        prepareKey(options, schema, config).pipe(
          Effect.flatMap(({ encoded, fingerprint, keySpace }) =>
            cache.remove(keySpace, encoded).pipe(
              Effect.tap(() => observe(new Cache.Invalidation({ fingerprint, scope: options.scope })))
            )
          )
        )
    }
  })

const layerWith = <LayerError, Requirements>(
  cacheLayer: Layer.Layer<Cache.Cache, LayerError, Requirements>,
  options: Options
) => Layer.effect(ObjectiveCache, make(options)).pipe(Layer.provide(cacheLayer))

/** Installs a process-local objective cache. @since 0.7.0 @category layers */
export const layerMemory = (options: Options = defaultOptions) => layerWith(Cache.layerMemory, options)

/** Installs a filesystem-backed objective cache. @since 0.7.0 @category layers */
export const layerFileSystem = (
  directory: string,
  options: Options = defaultOptions
) => layerWith(Cache.layerFileSystem(directory), options)

/** Installs a SQL-backed objective cache. @since 0.7.0 @category layers */
export const layerSql = (
  sqlClientLayer: Layer.Layer<SqlClient.SqlClient, Cache.BackendError>,
  options: Options = defaultOptions
) => layerWith(Cache.layerSql(sqlClientLayer), options)
