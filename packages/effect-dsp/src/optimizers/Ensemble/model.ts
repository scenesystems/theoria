/**
 * Ensemble optimizer contracts — configuration, reduce function, and candidate
 * state.
 *
 * @since 0.0.0
 */
import type { Effect, Schema } from "effect"
import type { DspError } from "../../Errors/union.js"
import type { Module as DspModule } from "../../Module/model.js"

/**
 * Resolved input type for a schema struct, used as input to ensemble reducers.
 *
 * @since 0.0.0
 * @category type-level
 */
export type ProgramInput<I extends Schema.Struct.Fields> = Schema.Schema.Type<Schema.Struct<I>>

/**
 * Resolved output type for a schema struct, used as output from ensemble
 * reducers.
 *
 * @since 0.0.0
 * @category type-level
 */
export type ProgramOutput<O extends Schema.Struct.Fields> = Schema.Schema.Type<Schema.Struct<O>>

/**
 * Function that combines multiple sub-module outputs into a single winner.
 *
 * Receives the original input and all collected outputs; returns one merged
 * output or fails with a `DspError`.
 *
 * @see {@link EnsembleOptions} for where this is supplied
 * @since 0.0.0
 * @category models
 */
export type EnsembleReduceFn<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> = (options: {
  readonly input: ProgramInput<I>
  readonly outputs: ReadonlyArray<ProgramOutput<O>>
}) => Effect.Effect<ProgramOutput<O>, DspError>

/**
 * Configuration for the ensemble optimizer.
 *
 * `programs` — the sub-modules to run in parallel.
 * `reduceFn` — strategy for merging outputs (defaults to majority vote).
 * `size` — optional cap on how many programs are sampled per forward pass.
 * `seed` — deterministic seed for program sampling.
 *
 * @see {@link EnsembleReduceFn} for the reduce contract
 * @since 0.0.0
 * @category models
 */
export type EnsembleOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> = Readonly<{
  readonly programs: ReadonlyArray<DspModule<I, O>>
  readonly reduceFn?: EnsembleReduceFn<I, O>
  readonly size?: number
  readonly seed?: number
  readonly name?: string
}>
