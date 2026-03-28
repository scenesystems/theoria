/**
 * Policy-aware wrappers for multivariate calculus operations.
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
