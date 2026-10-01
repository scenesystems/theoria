/**
 * Contracts for fixed module subsets and output reduction.
 *
 * @since 0.1.0
 * @module
 */
import { Data } from "effect"
import type { Effect, Schema } from "effect"
import type { DspError } from "./DspError.js"
import { make as makeInternal } from "./internal/ensemble/runtime.js"
import { majorityVote as majorityVoteInternal } from "./internal/ensemble/vote.js"
import type { Module as DspModule } from "./Module.js"

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
 * Values supplied to an ensemble reducer after all selected programs succeed.
 *
 * @since 0.1.0
 * @category models
 */
export class ReduceOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> extends Data.Class<{
  /** Original decoded input passed to every selected module. */
  readonly input: ProgramInput<I>
  /** Successful outputs in selected-program order. */
  readonly outputs: Schema.Array$<Schema.Struct<O>>["Type"]
}> {}

/**
 * Reduces successful selected-module outputs to one ensemble result.
 *
 * @remarks
 * The output array follows the subset's construction-time selection order. The
 * callback runs only after every selected module succeeds. Its checked failures
 * and service requirements remain in the ensemble module's Effect channels.
 *
 * @typeParam I - Input fields represented by `options.input`.
 * @typeParam O - Shared output fields represented by each candidate and result.
 * @typeParam E - Expected reduction failure.
 * @typeParam R - Services required while reducing.
 * @param options - Original input and all successful selected outputs.
 * @returns One output matching the lead module's signature.
 *
 * @see {@link Options} for where this is supplied
 * @since 0.1.0
 * @category models
 */
export type ReduceFn<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = DspError,
  R = never
> = (
  options: ReduceOptions<I, O>
) => Effect.Effect<ProgramOutput<O>, E, R>

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
 * @typeParam MemberE - Additional checked failures from selected modules.
 * @typeParam MemberR - Additional services required by selected modules.
 * @typeParam ReducerE - Checked failures from the reducer.
 * @typeParam ReducerR - Services required by the reducer.
 *
 * @see {@link ReduceFn} for the reduce contract
 * @since 0.1.0
 * @category models
 */
export class Options<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  MemberE = never,
  MemberR = never,
  ReducerE = DspError,
  ReducerR = never
> extends Data.Class<{
  /** Candidate modules, consumed once at construction. The first supplies the signature; all are retained as children. */
  readonly programs: Iterable<DspModule<I, O, MemberE, MemberR>>
  /**
   * Combines selected outputs with the original input. Defaults to structural
   * majority vote over whole outputs, with first-observed output winning ties.
   */
  readonly reduceFn?: ReduceFn<I, O, ReducerE, ReducerR>
  /** Subset size, rounded down and clamped to `[1, programs.length]`; omission selects all. */
  readonly size?: number
  /** Seed for reproducible subset choice. Defaults to `1` and does not advance between calls. */
  readonly seed?: number
  /** Identity of the composed module and its forward span. Defaults to `"ensemble"`. */
  readonly name?: string
}> {}

/** Constructs a module that concurrently runs a fixed subset and reduces its outputs.
 * @since 0.1.0
 * @category constructors
 */
export const make = makeInternal

/** Selects the most frequent structurally equal output, preserving first-observed ties.
 * @since 0.1.0
 * @category reducers
 */
export const majorityVote = majorityVoteInternal
