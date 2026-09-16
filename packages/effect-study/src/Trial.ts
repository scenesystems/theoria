/**
 * Schema-composed trial records with caller-owned inputs and outcomes.
 *
 * @since 0.1.0
 * @module
 */
import { Data, Number as Num, Schema } from "effect"
import { dual } from "effect/Function"

const Metadata = Schema.Struct({
  trialNumber: Schema.Number,
  cost: Schema.optional(Schema.Number),
  prior: Schema.optional(Schema.Literal(true))
})

const CompletedMetadata = Schema.TaggedStruct("Completed", { duration: Schema.Number })
const FailedMetadata = Schema.TaggedStruct("Failed", { duration: Schema.Number })

/**
 * Builds a trial codec without choosing an input domain or outcome vocabulary.
 * The component schemas retain their encoded forms and service requirements.
 * Numbers retain the caller's units; a negative trial number can identify prior history.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Trial = <Config extends Schema.Schema.All, State extends Schema.Schema.All>(
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

/** A pending evaluation state. @since 0.1.0 @category models */
export type Running = typeof Running.Type

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
  Schema.Struct({ ...FailedMetadata.fields, error })

/** A failed evaluation retaining its caller-owned error. @since 0.1.0 @category models */
export type Failed<Failure> = Schema.Schema.Type<
  Schema.extend<typeof FailedMetadata, Schema.Struct<{ error: Schema.Schema<Failure> }>>
>

/**
 * Cancellation without a fabricated observation or failure.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Cancelled = Schema.TaggedStruct("Cancelled", { cancelled: Schema.optional(Schema.Literal(true)) })

/** A cancelled evaluation state. @since 0.1.0 @category models */
export type Cancelled = typeof Cancelled.Type

/** Creates a running trial with no domain-specific outcome metadata. @since 0.1.0 @category constructors */
export const makeRunning = <Config>(
  trialNumber: number,
  config: Config,
  startedAt: number
): Trial<Config, Running> =>
  Data.struct({ trialNumber, config, state: Data.struct<Running>({ _tag: "Running", startedAt }) })

/** Returns elapsed milliseconds for a running state. @since 0.1.0 @category getters */
export const duration = (state: Running, now: number): number => Num.subtract(now, state.startedAt)

/** Completes a running trial with a caller-owned observation. @since 0.1.0 @category combinators */
export const complete: {
  <Value>(value: Value, now: number): <Config>(self: Trial<Config, Running>) => Trial<Config, Completed<Value>>
  <Config, Value>(self: Trial<Config, Running>, value: Value, now: number): Trial<Config, Completed<Value>>
} = dual(
  3,
  <Config, Value>(self: Trial<Config, Running>, value: Value, now: number) =>
    Data.struct({
      ...self,
      state: Data.struct<Completed<Value>>({ _tag: "Completed", value, duration: duration(self.state, now) })
    })
)

/** Records a typed terminal failure for a running trial. @since 0.1.0 @category combinators */
export const fail: {
  <Failure>(error: Failure, now: number): <Config>(self: Trial<Config, Running>) => Trial<Config, Failed<Failure>>
  <Config, Failure>(
    self: Trial<Config, Running>,
    error: Failure,
    now: number
  ): Trial<Config, Failed<Failure>>
} = dual(
  3,
  <Config, Failure>(self: Trial<Config, Running>, error: Failure, now: number) =>
    Data.struct({
      ...self,
      state: Data.struct<Failed<Failure>>({ _tag: "Failed", error, duration: duration(self.state, now) })
    })
)

/** Records cancellation without fabricating an observation or failure. @since 0.1.0 @category combinators */
export const cancel = <Config, TrialState>(self: Trial<Config, TrialState>): Trial<Config, Cancelled> =>
  Data.struct({ ...self, state: Data.struct<Cancelled>({ _tag: "Cancelled" }) })
