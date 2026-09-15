/**
 * Shared calculus operation helpers.
 *
 * @since 0.1.0
 * @category operations
 */
import { Boolean, Chunk, Effect, Inspectable, Match, Predicate, Schema } from "effect"

import { KernelExecutionError } from "../../contracts/shared/AdvancedComputationErrors.js"
import * as Numeric from "../../Numeric/index.js"
import { CalculusDecodeError, CalculusParameterError } from "../errors.js"
import type { DerivativeLimitEstimate } from "../schema.js"

const formatKernelErrorMessage = (error: unknown): string =>
  Match.value(error).pipe(
    Match.when(Predicate.isError, (cause) => cause.message),
    Match.orElse((cause) => Inspectable.toStringUnknown(cause, 0))
  )

/**
 * Executes a pure kernel and maps runtime exceptions to typed execution errors.
 *
 * @since 0.1.0
 * @category operations
 */
export const executeKernel = <A>(operation: string, kernel: () => A): Effect.Effect<A, KernelExecutionError> =>
  Effect.try({
    try: kernel,
    catch: (error) =>
      new KernelExecutionError({
        operation,
        message: formatKernelErrorMessage(error)
      })
  })

/**
 * Decodes unknown operation input with strict excess-property rejection.
 *
 * @since 0.1.0
 * @category operations
 */
export const decodeOperationInput = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  operation: string,
  input: unknown
): Effect.Effect<A, CalculusDecodeError, R> =>
  Schema.decodeUnknown(schema)(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError(
      (error) =>
        new CalculusDecodeError({
          operation,
          message: error.message
        })
    )
  )

/**
 * Checks whether every value in a vector is finite.
 *
 * @since 0.1.0
 * @category operations
 */
export const vectorIsFinite = (values: Chunk.Chunk<number>): boolean =>
  Chunk.reduce(values, true, (acc, value) => Boolean.and(acc, Numeric.isFinite(value)))

/**
 * Checks whether every value in a matrix is finite.
 *
 * @since 0.1.0
 * @category operations
 */
export const matrixIsFinite = (matrix: Chunk.Chunk<Chunk.Chunk<number>>): boolean =>
  Chunk.reduce(matrix, true, (acc, row) => Boolean.and(acc, vectorIsFinite(row)))

/**
 * Checks whether a derivative-limit estimate is finite.
 *
 * @since 0.1.0
 * @category operations
 */
export const estimateIsFinite = (estimate: DerivativeLimitEstimate): boolean =>
  Boolean.and(Numeric.isFinite(estimate.value), Numeric.isFinite(estimate.absoluteError))

/**
 * Enforces operation-specific parameter invariants.
 *
 * @since 0.1.0
 * @category operations
 */
export const ensureParameters = (operation: string, condition: boolean, message: string) =>
  Boolean.match(condition, {
    onTrue: () => Effect.void,
    onFalse: () =>
      Effect.fail(
        new CalculusParameterError({
          operation,
          message
        })
      )
  })
