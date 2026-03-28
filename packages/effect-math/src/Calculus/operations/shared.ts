/**
 * Shared calculus operation helpers.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect, Schema } from "effect"

import { CalculusDecodeError, CalculusParameterError } from "../errors.js"
import type { DerivativeLimitEstimate, RidderMethodInputType } from "../schema.js"

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

export const ridderConfigFrom = (input: RidderMethodInputType): RidderMethodInputType => ({
  initialStep: input.initialStep,
  contractionFactor: input.contractionFactor,
  maxIterations: input.maxIterations,
  absoluteTolerance: input.absoluteTolerance,
  relativeTolerance: input.relativeTolerance,
  minimumStep: input.minimumStep,
  safetyFactor: input.safetyFactor
})

export const vectorIsFinite = (values: Chunk.Chunk<number>): boolean =>
  Chunk.reduce(values, true, (acc, value) => acc && Number.isFinite(value))

export const matrixIsFinite = (matrix: Chunk.Chunk<Chunk.Chunk<number>>): boolean =>
  Chunk.reduce(matrix, true, (acc, row) => acc && vectorIsFinite(row))

export const estimateIsFinite = (estimate: DerivativeLimitEstimate): boolean =>
  Number.isFinite(estimate.value) && Number.isFinite(estimate.absoluteError)

export const matrixToReadonly = (matrix: Chunk.Chunk<Chunk.Chunk<number>>) =>
  Chunk.toReadonlyArray(Chunk.map(matrix, (row) => Chunk.toReadonlyArray(row)))

export const ensureParameters = (operation: string, condition: boolean, message: string) =>
  condition
    ? Effect.void
    : Effect.fail(
      new CalculusParameterError({
        operation,
        message
      })
    )
