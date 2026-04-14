/**
 * Descriptor model for schema-parameterized cache keys and values.
 *
 * @since 0.1.0
 */
import type { Schema } from "effect"
import { Data } from "effect"

/**
 * Typed cache descriptor carrying key/value schemas and namespace/version routing metadata.
 *
 * @since 0.1.0
 * @category models
 */
export class CacheDescriptor<Key, Value, EncodedKey = Key, EncodedValue = Value> extends Data.Class<{
  readonly namespace: string
  readonly version: string
  readonly keySchema: Schema.Schema<Key, EncodedKey, never>
  readonly valueSchema: Schema.Schema<Value, EncodedValue, never>
}> {
  /**
   * Constructs a cache descriptor from namespace/version metadata and key/value schemas.
   *
   * @since 0.1.0
   * @category constructors
   */
  static make<Key, Value, EncodedKey = Key, EncodedValue = Value>(
    namespace: string,
    version: string,
    keySchema: Schema.Schema<Key, EncodedKey, never>,
    valueSchema: Schema.Schema<Value, EncodedValue, never>
  ): CacheDescriptor<Key, Value, EncodedKey, EncodedValue> {
    return new CacheDescriptor({
      namespace,
      version,
      keySchema,
      valueSchema
    })
  }
}
