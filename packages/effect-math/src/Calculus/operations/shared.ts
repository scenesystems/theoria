/**
 * Shared calculus operation helpers.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect, Schema } from "effect"

import { KernelExecutionError } from "../../contracts/shared/AdvancedComputationErrors.js"
import { CalculusDecodeError, CalculusParameterError } from "../errors.js"
import type { DerivativeLimitEstimate, RidderMethodInputType } from "../schema.js"

const formatKernelErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : String(error)

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
 * Lifts Ridder configuration fields from decoded operation input.
 *
 * @since 0.1.0
 * @category operations
 */
export const ridderConfigFrom = (input: RidderMethodInputType): RidderMethodInputType => ({
  initialStep: input.initialStep,
  contractionFactor: input.contractionFactor,
  maxIterations: input.maxIterations,
  absoluteTolerance: input.absoluteTolerance,
  relativeTolerance: input.relativeTolerance,
  minimumStep: input.minimumStep,
  safetyFactor: input.safetyFactor
})

/**
 * Checks whether every value in a vector is finite.
 *
 * @since 0.1.0
 * @category operations
 */
export const vectorIsFinite = (values: Chunk.Chunk<number>): boolean =>
  Chunk.reduce(values, true, (acc, value) => acc && Number.isFinite(value))

/**
 * Checks whether every value in a matrix is finite.
 *
 * @since 0.1.0
 * @category operations
 */
export const matrixIsFinite = (matrix: Chunk.Chunk<Chunk.Chunk<number>>): boolean =>
  Chunk.reduce(matrix, true, (acc, row) => acc && vectorIsFinite(row))

/**
 * Checks whether a derivative-limit estimate is finite.
 *
 * @since 0.1.0
 * @category operations
 */
export const estimateIsFinite = (estimate: DerivativeLimitEstimate): boolean =>
  Number.isFinite(estimate.value) && Number.isFinite(estimate.absoluteError)

/**
 * Converts matrix chunks into nested readonly arrays for validated boundaries.
 *
 * @since 0.1.0
 * @category operations
 */
export const matrixToReadonly = (matrix: Chunk.Chunk<Chunk.Chunk<number>>) =>
  Chunk.toReadonlyArray(Chunk.map(matrix, (row) => Chunk.toReadonlyArray(row)))

/**
 * Enforces operation-specific parameter invariants.
 *
 * @since 0.1.0
 * @category operations
 */
export const ensureParameters = (operation: string, condition: boolean, message: string) =>
  condition
    ? Effect.void
    : Effect.fail(
      new CalculusParameterError({
        operation,
        message
      })
    )
