/**
 * Descriptor model for schema-parameterized cache keys and values.
 *
 * @since 0.1.0
 */
import type { Schema } from "effect"
import { Data } from "effect"

/**
 * Describes how a cache key and value are encoded and how entries are partitioned.
 *
 * @remarks
 * Entry keys have the form `namespace:version:<fingerprint>`. Changing either
 * string therefore selects a separate set of persisted entries; neither field
 * is interpreted as a migration instruction.
 *
 * @since 0.1.0
 * @category models
 */
export class CacheDescriptor<Key, Value, EncodedKey = Key, EncodedValue = Value> extends Data.Class<{
  readonly namespace: string
  readonly version: string
  readonly keySchema: Schema.Schema<Key, EncodedKey, never>
  readonly valueSchema: Schema.Schema<Value, EncodedValue, never>
}> {}

/**
 * Defines one independently versioned cache keyspace.
 *
 * @remarks
 * `keySchema` is encoded before durable fingerprinting. `valueSchema` is used
 * to encode values as JSON on writes and decode them on reads.
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
