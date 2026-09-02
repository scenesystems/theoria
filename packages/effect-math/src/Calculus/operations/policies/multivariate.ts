/**
 * Applies runtime precision and diagnostics policies to multivariate calculus results.
 *
 * @remarks
 * Synchronous callback exceptions fail with {@link KernelExecutionError}.
 * Strict precision rejects non-finite scalar, vector, or matrix entries.
 * Enabled diagnostics emit one debug log with dimensional metadata. Inputs and
 * dimensional preconditions are not validated.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect } from "effect"

import { withCustomPolicyGuards, withScalarPolicyGuards } from "../../../contracts/shared/PolicyGuards.js"
import { CalculusDomainViolationError } from "../../errors.js"
import type { RidderMethodInputType } from "../../schema.js"
import { directionalDerivative, divergence, gradient, hessian, jacobian, laplacian } from "../pure.js"
import { executeKernel, matrixIsFinite, vectorIsFinite } from "../shared.js"

/**
 * Estimates a gradient and applies policies to every component.
 *
 * @remarks
 * Strict precision accepts an empty result because there are no non-finite components.
 *
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 * @throws {@link CalculusDomainViolationError} when strict precision rejects the result.
 *
 * @since 0.2.0
 * @category operations
 */
export const gradientWithPolicies = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
) =>
  executeKernel("gradientWithPolicies", () => gradient(f, point, config)).pipe(
    Effect.flatMap((result) =>
      withCustomPolicyGuards({
        operation: "Calculus.gradientWithPolicies",
        compute: () => result,
        isValid: vectorIsFinite,
        makeError: (message) =>
          new CalculusDomainViolationError({
            operation: "gradientWithPolicies",
            message
          }),
        annotations: (value) => ({
          dimensions: String(Chunk.size(point)),
          resultDimensions: String(Chunk.size(value))
        })
      })
    )
  )

/**
 * Estimates a Jacobian and applies policies to every matrix entry.
 *
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 * @throws {@link CalculusDomainViolationError} when strict precision rejects the result.
 *
 * @since 0.2.0
 * @category operations
 */
export const jacobianWithPolicies = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
) =>
  executeKernel("jacobianWithPolicies", () => jacobian(f, point, config)).pipe(
    Effect.flatMap((result) =>
      withCustomPolicyGuards({
        operation: "Calculus.jacobianWithPolicies",
        compute: () => result,
        isValid: matrixIsFinite,
        makeError: (message) =>
          new CalculusDomainViolationError({
            operation: "jacobianWithPolicies",
            message
          }),
        annotations: (value) => ({
          inputDimensions: String(Chunk.size(point)),
          outputDimensions: String(Chunk.size(value))
        })
      })
    )
  )

/**
 * Estimates a Hessian and applies policies to every matrix entry.
 *
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 * @throws {@link CalculusDomainViolationError} when strict precision rejects the result.
 *
 * @since 0.2.0
 * @category operations
 */
export const hessianWithPolicies = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
) =>
  executeKernel("hessianWithPolicies", () => hessian(f, point, config)).pipe(
    Effect.flatMap((result) =>
      withCustomPolicyGuards({
        operation: "Calculus.hessianWithPolicies",
        compute: () => result,
        isValid: matrixIsFinite,
        makeError: (message) =>
          new CalculusDomainViolationError({
            operation: "hessianWithPolicies",
            message
          }),
        annotations: (value) => ({
          dimensions: String(Chunk.size(value))
        })
      })
    )
  )

/**
 * Estimates a normalized directional derivative and applies policies to the result.
 *
 * @remarks
 * Unequal vector lengths and zero directions produce `NaN`. Strict precision
 * rejects that sentinel; relaxed precision returns it.
 *
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 * @throws {@link CalculusDomainViolationError} when strict precision rejects the result.
 *
 * @since 0.2.0
 * @category operations
 */
export const directionalDerivativeWithPolicies = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  direction: Chunk.Chunk<number>,
  config?: RidderMethodInputType
) =>
  executeKernel("directionalDerivativeWithPolicies", () => directionalDerivative(f, point, direction, config)).pipe(
    Effect.flatMap((result) =>
      withScalarPolicyGuards({
        operation: "Calculus.directionalDerivativeWithPolicies",
        compute: () => result,
        makeError: (message) =>
          new CalculusDomainViolationError({
            operation: "directionalDerivativeWithPolicies",
            message
          }),
        annotations: (value) => ({
          dimensions: String(Chunk.size(point)),
          result: String(value)
        })
      })
    )
  )

/**
 * Estimates vector-field divergence and applies policies to the scalar result.
 *
 * @remarks
 * A field output dimension different from the point dimension produces `NaN`.
 * Strict precision rejects that sentinel; relaxed precision returns it.
 *
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 * @throws {@link CalculusDomainViolationError} when strict precision rejects the result.
 *
 * @since 0.2.0
 * @category operations
 */
export const divergenceWithPolicies = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
) =>
  executeKernel("divergenceWithPolicies", () => divergence(f, point, config)).pipe(
    Effect.flatMap((result) =>
      withScalarPolicyGuards({
        operation: "Calculus.divergenceWithPolicies",
        compute: () => result,
        makeError: (message) =>
          new CalculusDomainViolationError({
            operation: "divergenceWithPolicies",
            message
          }),
        annotations: (value) => ({
          dimensions: String(Chunk.size(point)),
          result: String(value)
        })
      })
    )
  )

/**
 * Estimates a scalar-field Laplacian and applies policies to the result.
 *
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 * @throws {@link CalculusDomainViolationError} when strict precision rejects the result.
 *
 * @since 0.2.0
 * @category operations
 */
export const laplacianWithPolicies = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
) =>
  executeKernel("laplacianWithPolicies", () => laplacian(f, point, config)).pipe(
    Effect.flatMap((result) =>
      withScalarPolicyGuards({
        operation: "Calculus.laplacianWithPolicies",
        compute: () => result,
        makeError: (message) =>
          new CalculusDomainViolationError({
            operation: "laplacianWithPolicies",
            message
          }),
        annotations: (value) => ({
          dimensions: String(Chunk.size(point)),
          result: String(value)
        })
      })
    )
  )
