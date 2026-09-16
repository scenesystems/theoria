/**
 * Schema-encoded caching under canonical fingerprints.
 *
 * @remarks
 * A {@link KeySpace} partitions persisted entries and defines their codecs.
 * Every operation for one persisted key is serialized within a cache instance,
 * while independent keys progress concurrently. Failed computations are not
 * cached and interrupted mutations never publish uncertain local state.
 *
 * @since 0.1.0
 * @module
 */
import * as KeyValueStore from "@effect/platform/KeyValueStore"
import type * as SqlClient from "@effect/sql/SqlClient"
import { Data, Effect, Layer, Schema } from "effect"
import type { Option } from "effect"
import type * as Context from "effect/Context"
import { dual } from "effect/Function"
import type * as Scope from "effect/Scope"

import * as cache from "./internal/cache/cache.js"
import * as runtime from "./internal/cache/runtimeFingerprint.js"

/**
 * Binds key and value codecs to one persisted cache keyspace.
 *
 * @remarks
 * Persistence keys use `namespace:version:<fingerprint>`. Changing the
 * namespace or version selects a distinct keyspace. Both schemas must encode
 * without Effect requirements.
 *
 * @since 0.1.0
 * @category models
 */
export class KeySpace<Key, Value, EncodedKey = Key, EncodedValue = Value> extends Data.Class<{
  readonly namespace: string
  readonly version: string
  readonly keySchema: Schema.Schema<Key, EncodedKey, never>
  readonly valueSchema: Schema.Schema<Value, EncodedValue, never>
}> {}

/**
 * Couples a keyspace and decoded key with a lazy miss computation.
 *
 * @since 0.1.0
 * @category models
 */
export class Request<Key, Value, ComputeError, Requirements, EncodedKey = Key, EncodedValue = Value>
  extends Data.Class<{
    readonly keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>
    readonly key: Key
    readonly compute: Effect.Effect<Value, ComputeError, Requirements>
  }>
{}

/** Origin of a resolved value. @since 0.1.0 @category schemas */
export const Resolution = Schema.Literal("hit", "miss")

/** Origin of a resolved value. @since 0.1.0 @category models */
export type Resolution = typeof Resolution.Type

/**
 * A resolved value and whether it was loaded or computed.
 *
 * @since 0.1.0
 * @category models
 */
export class Result<Value> extends Data.Class<{
  readonly value: Value
  readonly resolution: Resolution
}> {}

/**
 * Reports a key-encoding, fingerprinting, value-encoding, or value-decoding failure.
 *
 * @since 0.1.0
 * @category errors
 */
export class Corrupt extends Schema.TaggedError<Corrupt>()("effect-search/CacheCorrupt", {
  key: Schema.String,
  reason: Schema.String
}) {}

/**
 * Reports a rejected operation from the configured persistence backend.
 *
 * @since 0.1.0
 * @category errors
 */
export class BackendError extends Schema.TaggedError<BackendError>()("effect-search/CacheBackendError", {
  operation: Schema.String,
  reason: Schema.String
}) {}

/** Expected cache failures. @since 0.1.0 @category schemas */
export const Error = Schema.Union(Corrupt, BackendError)

/** Expected cache failure. @since 0.1.0 @category models */
export type Error = typeof Error.Type

type Failure = Error

/** A value reused without computation. @since 0.1.0 @category models */
export class Hit extends Schema.TaggedClass<Hit>()("Hit", {
  fingerprint: Schema.String,
  scope: Schema.String
}) {}

/** A value computed after lookup missed. @since 0.1.0 @category models */
export class Miss extends Schema.TaggedClass<Miss>()("Miss", {
  fingerprint: Schema.String,
  scope: Schema.String
}) {}

/** An entry explicitly invalidated by an integration. @since 0.1.0 @category models */
export class Invalidation extends Schema.TaggedClass<Invalidation>()("Invalidation", {
  fingerprint: Schema.String,
  scope: Schema.String
}) {}

/** Cache observability events accepted at persistence boundaries. @since 0.1.0 @category schemas */
export const Event = Schema.Union(Hit, Miss, Invalidation)

/** Cache observability event. @since 0.1.0 @category models */
export type Event = typeof Event.Type

/** Records cache events selected by integrations. @since 0.1.0 @category services */
export class Observer extends Effect.Tag("effect-search/Cache/Observer")<
  Observer,
  {
    readonly record: (event: Event) => Effect.Effect<void>
  }
>() {}

/**
 * Rejects runtime values outside the supported structural fingerprint domain.
 *
 * @since 0.3.0
 * @category errors
 */
export class RuntimeFingerprintError extends Schema.TaggedError<RuntimeFingerprintError>()(
  "effect-search/RuntimeFingerprintError",
  { reason: Schema.Literal("function", "symbol", "unsupported-value") }
) {}

/**
 * Reads and writes typed values under identities derived from encoded keys.
 *
 * @since 0.1.0
 * @category services
 */
export class Cache extends Effect.Tag("effect-search/Cache")<
  Cache,
  {
    readonly get: <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
      key: Key
    ) => Effect.Effect<Option.Option<Value>, Failure>
    readonly set: <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
      key: Key,
      value: Value
    ) => Effect.Effect<void, Failure>
    readonly remove: <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
      key: Key
    ) => Effect.Effect<void, Failure>
    readonly resolve: <Key, Value, ComputeError, Requirements, EncodedKey = Key, EncodedValue = Value>(
      request: Request<Key, Value, ComputeError, Requirements, EncodedKey, EncodedValue>
    ) => Effect.Effect<Result<Value>, Failure | ComputeError, Requirements>
  }
>() {}

/** Cache service implementation. @since 0.1.0 @category models */
export type Service = Context.Tag.Service<typeof Cache>

/** Reads and decodes an entry. @since 0.1.0 @category combinators */
export const get: {
  <Key, Value, EncodedKey = Key, EncodedValue = Value>(
    keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
    key: Key
  ): (self: Service) => Effect.Effect<Option.Option<Value>, Failure>
  <Key, Value, EncodedKey = Key, EncodedValue = Value>(
    self: Service,
    keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
    key: Key
  ): Effect.Effect<Option.Option<Value>, Failure>
} = dual(
  3,
  <Key, Value, EncodedKey = Key, EncodedValue = Value>(
    self: Service,
    keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
    key: Key
  ) => self.get(keySpace, key)
)

/** Encodes and persists an entry. @since 0.1.0 @category combinators */
export const set: {
  <Key, Value, EncodedKey = Key, EncodedValue = Value>(
    keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
    key: Key,
    value: Value
  ): (self: Service) => Effect.Effect<void, Failure>
  <Key, Value, EncodedKey = Key, EncodedValue = Value>(
    self: Service,
    keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
    key: Key,
    value: Value
  ): Effect.Effect<void, Failure>
} = dual(
  4,
  <Key, Value, EncodedKey = Key, EncodedValue = Value>(
    self: Service,
    keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
    key: Key,
    value: Value
  ) => self.set(keySpace, key, value)
)

/** Removes a persisted entry. @since 0.1.0 @category combinators */
export const remove: {
  <Key, Value, EncodedKey = Key, EncodedValue = Value>(
    keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
    key: Key
  ): (self: Service) => Effect.Effect<void, Failure>
  <Key, Value, EncodedKey = Key, EncodedValue = Value>(
    self: Service,
    keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
    key: Key
  ): Effect.Effect<void, Failure>
} = dual(
  3,
  <Key, Value, EncodedKey = Key, EncodedValue = Value>(
    self: Service,
    keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
    key: Key
  ) => self.remove(keySpace, key)
)

/** Resolves a cached value or computes one miss. @since 0.1.0 @category combinators */
export const resolve: {
  <Key, Value, ComputeError, Requirements, EncodedKey = Key, EncodedValue = Value>(
    request: Request<Key, Value, ComputeError, Requirements, EncodedKey, EncodedValue>
  ): (self: Service) => Effect.Effect<Result<Value>, Failure | ComputeError, Requirements>
  <Key, Value, ComputeError, Requirements, EncodedKey = Key, EncodedValue = Value>(
    self: Service,
    request: Request<Key, Value, ComputeError, Requirements, EncodedKey, EncodedValue>
  ): Effect.Effect<Result<Value>, Failure | ComputeError, Requirements>
} = dual(
  2,
  <Key, Value, ComputeError, Requirements, EncodedKey = Key, EncodedValue = Value>(
    self: Service,
    request: Request<Key, Value, ComputeError, Requirements, EncodedKey, EncodedValue>
  ) => self.resolve(request)
)

/**
 * Canonicalizes a portable encoded key and computes its durable BLAKE3-256 identity.
 *
 * @since 0.1.0
 * @category fingerprinting
 */
export { durableFingerprint } from "@scenesystems/digest"

/**
 * Computes process-local structural identity for the supported runtime value domain.
 *
 * @since 0.1.0
 * @category fingerprinting
 */
export const runtimeFingerprint = runtime.runtimeFingerprint

/** Allocates cache lookup state and per-key locks. @since 0.1.0 @category constructors */
export const make = (): Effect.Effect<Service, never, KeyValueStore.KeyValueStore | Scope.Scope> => cache.make()

/** Installs a cache over the ambient key-value store. @since 0.1.0 @category layers */
export const layer = Layer.scoped(Cache, make())

/** Installs a process-local in-memory cache. @since 0.1.0 @category layers */
export const layerMemory = Layer.provide(layer, KeyValueStore.layerMemory)

/** Installs a filesystem-backed cache. @since 0.1.0 @category layers */
export const layerFileSystem = (directory: string) => Layer.provide(layer, KeyValueStore.layerFileSystem(directory))

/** Installs a cache backed by a SQLite-compatible client. @since 0.1.0 @category layers */
export const layerSql = (sqlClientLayer: Layer.Layer<SqlClient.SqlClient, BackendError>) =>
  Layer.provide(layer, cache.sqlKeyValueStoreLayer(sqlClientLayer))
