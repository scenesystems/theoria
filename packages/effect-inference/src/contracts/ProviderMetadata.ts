/**
 * JSON-safe provider extensions retained with runtime evidence.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Recursive JSON value accepted in provider-specific response metadata.
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
 * Decodes recursively JSON-safe values without assigning normalized semantics.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ProviderMetadataValueSchema = providerMetadataValueSchema

/**
 * Decodes provider-keyed extension records separately from normalized evidence
 * fields.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ProviderMetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Record({ key: Schema.String, value: ProviderMetadataValueSchema })
})

/**
 * Provider-owned response details retained for replay without promoting them
 * to normalized evidence. Decoding establishes JSON shape, not authenticity
 * or cross-provider semantics.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ProviderMetadata = Schema.Schema.Type<typeof ProviderMetadataSchema>
