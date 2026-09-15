/**
 * Schema-composed trial records with caller-owned inputs and outcomes.
 *
 * @since 0.1.0
 * @module
 */
import { Schema } from "effect"

const Metadata = Schema.Struct({
  trialNumber: Schema.Number,
  cost: Schema.optional(Schema.Number),
  prior: Schema.optional(Schema.Literal(true))
})

const CompletedMetadata = Schema.TaggedStruct("Completed", { duration: Schema.Number })

/**
 * Builds a trial codec without choosing an input domain or outcome vocabulary.
 * The component schemas retain their encoded forms and service requirements.
 * Numbers retain the caller's units; a negative trial number can identify prior history.
 *
 * @since 0.1.0
 * @category schemas
 */
export const makeSchema = <Config extends Schema.Schema.All, State extends Schema.Schema.All>(
  config: Config,
  state: State
) =>
  Schema.Struct({
    ...Metadata.fields,
    config,
    state
  })

/**
 * Decoded trial data, derived from the same factory used for persistence.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Trial<Config, State> = Schema.Schema.Type<
  Schema.extend<typeof Metadata, Schema.Struct<{ config: Schema.Schema<Config>; state: Schema.Schema<State> }>>
>

/**
 * A pending evaluation with its start time in milliseconds.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Running = Schema.TaggedStruct("Running", { startedAt: Schema.Number })

/**
 * A successful observation and its measured duration in milliseconds.
 * Observations need not be scalar scores or otherwise orderable.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Completed = <Value extends Schema.Schema.All>(value: Value) =>
  Schema.Struct({ ...CompletedMetadata.fields, value })

/**
 * A completed observation with its decoded value type preserved.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Completed<Value> = Schema.Schema.Type<
  Schema.extend<typeof CompletedMetadata, Schema.Struct<{ value: Schema.Schema<Value> }>>
>

/**
 * A failed evaluation with a caller-owned error codec and elapsed milliseconds.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Failed = <Failure extends Schema.Schema.All>(error: Failure) =>
  Schema.TaggedStruct("Failed", { error, duration: Schema.Number })

/**
 * Cancellation without a fabricated observation or failure.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Cancelled = Schema.TaggedStruct("Cancelled", { cancelled: Schema.optional(Schema.Literal(true)) })
