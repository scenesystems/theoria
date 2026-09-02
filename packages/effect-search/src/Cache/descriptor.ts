/**
 * Schema codecs and keyspace partitioning for cached values.
 *
 * @since 0.1.0
 */
import type { Schema } from "effect"
import { Data } from "effect"

/**
 * Binds key and value codecs to one persisted cache keyspace.
 *
 * @remarks
 * Persistence keys use `namespace:version:<fingerprint>`. The strings are not
 * validated or escaped, and changing either selects different entries rather than
 * migrating existing data. Both schemas must encode without Effect requirements.
 *
 * @typeParam Key - Decoded key supplied to cache operations.
 * @typeParam Value - Decoded value returned by cache operations.
 * @typeParam EncodedKey - Representation fingerprinted to form the persistence key.
 * @typeParam EncodedValue - Representation serialized in the backing store.
 *
 * @since 0.1.0
 * @category models
 */
export class CacheDescriptor<Key, Value, EncodedKey = Key, EncodedValue = Value> extends Data.Class<{
  /** Unescaped keyspace prefix shared by all entries described by this value. */
  readonly namespace: string
  /** Unescaped keyspace revision used to isolate incompatible stored entries. */
  readonly version: string
  /** Codec applied before canonical key fingerprinting. */
  readonly keySchema: Schema.Schema<Key, EncodedKey, never>
  /** Codec applied when writing and reading persisted values. */
  readonly valueSchema: Schema.Schema<Value, EncodedValue, never>
}> {}

/**
 * Constructs a descriptor without validating its namespace, version, or codecs.
 *
 * @remarks
 * Keys are schema-encoded before canonical fingerprinting. Values are schema-encoded
 * to JSON on writes and decoded from JSON on reads.
 *
 * @typeParam Key - Decoded key supplied to cache operations.
 * @typeParam Value - Decoded value returned by cache operations.
 * @typeParam EncodedKey - Representation fingerprinted to form the persistence key.
 * @typeParam EncodedValue - Representation serialized in the backing store.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeDescriptor = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
  namespace: string,
  version: string,
  keySchema: Schema.Schema<Key, EncodedKey, never>,
  valueSchema: Schema.Schema<Value, EncodedValue, never>
): CacheDescriptor<Key, Value, EncodedKey, EncodedValue> =>
  new CacheDescriptor({
    namespace,
    version,
    keySchema,
    valueSchema
  })
