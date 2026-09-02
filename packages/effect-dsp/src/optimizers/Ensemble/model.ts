/**
 * Contracts for fixed module subsets and output reduction.
 *
 * @since 0.1.0
 */
import type { Effect, Schema } from "effect"
import type { DspError } from "../../Errors/union.js"
import type { Module as DspModule } from "../../Module/model.js"

/**
 * Computes the decoded input represented by a signature field map.
 *
 * @typeParam I - Input field schemas to resolve.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ProgramInput<I extends Schema.Struct.Fields> = Schema.Schema.Type<Schema.Struct<I>>

/**
 * Computes the decoded output represented by a signature field map.
 *
 * @typeParam O - Output field schemas to resolve.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ProgramOutput<O extends Schema.Struct.Fields> = Schema.Schema.Type<Schema.Struct<O>>

/**
 * Reduces successful selected-module outputs to one ensemble result.
 *
 * @remarks
 * The output array follows the subset's construction-time selection order. The
 * callback runs only after every selected module succeeds and cannot add a
 * service requirement.
 *
 * @typeParam I - Input fields represented by `options.input`.
 * @typeParam O - Shared output fields represented by each candidate and result.
 * @param options - Original input and all successful selected outputs.
 * @returns One output matching the lead module's signature.
 *
 * @see {@link EnsembleOptions} for where this is supplied
 * @since 0.1.0
 * @category models
 */
export type EnsembleReduceFn<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> = (options: {
  /** Original decoded input passed to every selected module. */
  readonly input: ProgramInput<I>
  /** Successful outputs in selected-program order. */
  readonly outputs: ReadonlyArray<ProgramOutput<O>>
}) => Effect.Effect<ProgramOutput<O>, DspError>

/**
 * Configures a construction-time subset and its reducer.
 *
 * @remarks
 * Construction fails with `AllTrialsFailed` when `programs` is empty. A
 * seeded subset is chosen once during construction; every forward call
 * runs that same subset concurrently and supplies outputs to the reducer in
 * selection order. All programs are retained as child nodes, including
 * unselected programs. The first program supplies the signature; construction
 * does not compare the remaining signatures. Any selected program failure
 * fails the forward call before reduction.
 *
 * @typeParam I - Input fields shared by candidate modules.
 * @typeParam O - Output fields shared by candidate modules and the reducer.
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
  /** Subset size, rounded down and clamped to `[1, programs.length]`; omission selects all. */
  readonly size?: number
  /** Seed for reproducible subset choice. Defaults to `1` and does not advance between calls. */
  readonly seed?: number
  /** Identity of the composed module and its forward span. Defaults to `"ensemble"`. */
  readonly name?: string
}>
