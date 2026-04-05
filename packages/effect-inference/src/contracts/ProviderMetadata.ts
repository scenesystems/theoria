/**
 * Provider-namespaced metadata escape hatch for replay-safe evidence.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * JSON-safe metadata value for provider-specific request and response details.
 *
 * @since 0.1.0
 * @category models
 */
export type ProviderMetadataValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<ProviderMetadataValue>
  | { readonly [key: string]: ProviderMetadataValue }

const providerMetadataValueSchema: Schema.Schema<
  ProviderMetadataValue,
  ProviderMetadataValue,
  never
> = Schema.suspend((): Schema.Schema<ProviderMetadataValue, ProviderMetadataValue, never> =>
  Schema.Union(
    Schema.String,
    Schema.Number,
    Schema.Boolean,
    Schema.Null,
    Schema.Array(providerMetadataValueSchema),
    Schema.Record({ key: Schema.String, value: providerMetadataValueSchema })
  )
)

/**
 * Recursive schema for provider-specific metadata payloads.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ProviderMetadataValueSchema = providerMetadataValueSchema

/**
 * Provider-namespaced metadata record.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ProviderMetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Record({ key: Schema.String, value: ProviderMetadataValueSchema })
})

/**
 * Extracted provider-metadata record.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ProviderMetadata = Schema.Schema.Type<typeof ProviderMetadataSchema>
