/**
 * Ensemble optimizer contracts — configuration, reduce function, and candidate
 * state.
 *
 * @since 0.1.0
 */
import type { Effect, Schema } from "effect"
import type { DspError } from "../../Errors/union.js"
import type { Module as DspModule } from "../../Module/model.js"

/**
 * Resolved input type for a schema struct, used as input to ensemble reducers.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ProgramInput<I extends Schema.Struct.Fields> = Schema.Schema.Type<Schema.Struct<I>>

/**
 * Resolved output type for a schema struct, used as output from ensemble
 * reducers.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ProgramOutput<O extends Schema.Struct.Fields> = Schema.Schema.Type<Schema.Struct<O>>

/**
 * Function that combines multiple sub-module outputs into a single winner.
 *
 * @remarks
 * Receives the original input and all collected outputs; returns one merged
 * output or fails with a `DspError`.
 *
 * @see {@link EnsembleOptions} for where this is supplied
 * @since 0.1.0
 * @category models
 */
export type EnsembleReduceFn<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> = (options: {
  readonly input: ProgramInput<I>
  readonly outputs: ReadonlyArray<ProgramOutput<O>>
}) => Effect.Effect<ProgramOutput<O>, DspError>

/**
 * Controls fixed-subset execution and output reduction for an ensemble.
 *
 * @remarks
 * Construction fails with `AllTrialsFailed` when `programs` is empty. A
 * deterministic subset is chosen once during construction; every forward call
 * runs that same subset concurrently and supplies outputs to the reducer in
 * selection order. Any selected program failure fails the forward call before
 * reduction.
 *
 * @see {@link EnsembleReduceFn} for the reduce contract
 * @since 0.1.0
 * @category models
 */
export type EnsembleOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> = Readonly<{
  /** Candidate modules. The first supplies the ensemble signature; all are retained as sub-modules. */
  readonly programs: ReadonlyArray<DspModule<I, O>>
  /**
   * Combines selected outputs with the original input. Defaults to structural
   * majority vote over whole outputs, with first-observed output winning ties.
   */
  readonly reduceFn?: EnsembleReduceFn<I, O>
  /** Programs selected to run, clamped to `[1, programs.length]`; omission selects all. */
  readonly size?: number
  /** Seed for reproducible subset choice. Defaults to `1` and does not advance between calls. */
  readonly seed?: number
  /** Identity of the composed module and its forward span. Defaults to `"ensemble"`. */
  readonly name?: string
}>
