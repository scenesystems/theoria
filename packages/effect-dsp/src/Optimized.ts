/**
 * Immutable optimization results.
 * @since 1.0.0
 * @module
 */
import { Data } from "effect"
import type { ParameterSet } from "./ParameterSet.js"

/** A bound program, its parameter snapshot, and its algorithm's concrete report.
 * @since 1.0.0
 * @category models
 */
export class Result<M, R> extends Data.Class<{
  readonly program: M
  readonly parameters: ParameterSet
  readonly report: R
}> {}
