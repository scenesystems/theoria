/**
 * Policy-aware wrappers for multivariate calculus operations.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk } from "effect"

import { withCustomPolicyGuards, withScalarPolicyGuards } from "../../../contracts/shared/PolicyGuards.js"
import { CalculusDomainViolationError } from "../../errors.js"
import type { RidderMethodInputType } from "../../schema.js"
import { directionalDerivative, divergence, gradient, hessian, jacobian, laplacian } from "../pure.js"
import { matrixIsFinite, vectorIsFinite } from "../shared.js"

export const gradientWithPolicies = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
) =>
  withCustomPolicyGuards({
    operation: "Calculus.gradientWithPolicies",
    compute: () => gradient(f, point, config),
    isValid: vectorIsFinite,
    makeError: (message) =>
      new CalculusDomainViolationError({
        operation: "gradientWithPolicies",
        message
      }),
    annotations: (result) => ({
      dimensions: String(Chunk.size(point)),
      resultDimensions: String(Chunk.size(result))
    })
  })

export const jacobianWithPolicies = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
) =>
  withCustomPolicyGuards({
    operation: "Calculus.jacobianWithPolicies",
    compute: () => jacobian(f, point, config),
    isValid: matrixIsFinite,
    makeError: (message) =>
      new CalculusDomainViolationError({
        operation: "jacobianWithPolicies",
        message
      }),
    annotations: (result) => ({
      inputDimensions: String(Chunk.size(point)),
      outputDimensions: String(Chunk.size(result))
    })
  })

export const hessianWithPolicies = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
) =>
  withCustomPolicyGuards({
    operation: "Calculus.hessianWithPolicies",
    compute: () => hessian(f, point, config),
    isValid: matrixIsFinite,
    makeError: (message) =>
      new CalculusDomainViolationError({
        operation: "hessianWithPolicies",
        message
      }),
    annotations: (result) => ({
      dimensions: String(Chunk.size(result))
    })
  })

export const directionalDerivativeWithPolicies = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  direction: Chunk.Chunk<number>,
  config?: RidderMethodInputType
) =>
  withScalarPolicyGuards({
    operation: "Calculus.directionalDerivativeWithPolicies",
    compute: () => directionalDerivative(f, point, direction, config),
    makeError: (message) =>
      new CalculusDomainViolationError({
        operation: "directionalDerivativeWithPolicies",
        message
      }),
    annotations: (result) => ({
      dimensions: String(Chunk.size(point)),
      result: String(result)
    })
  })

export const divergenceWithPolicies = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
) =>
  withScalarPolicyGuards({
    operation: "Calculus.divergenceWithPolicies",
    compute: () => divergence(f, point, config),
    makeError: (message) =>
      new CalculusDomainViolationError({
        operation: "divergenceWithPolicies",
        message
      }),
    annotations: (result) => ({
      dimensions: String(Chunk.size(point)),
      result: String(result)
    })
  })

export const laplacianWithPolicies = (
  f: (point: Chunk.Chunk<number>) => number,
  point: Chunk.Chunk<number>,
  config?: RidderMethodInputType
) =>
  withScalarPolicyGuards({
    operation: "Calculus.laplacianWithPolicies",
    compute: () => laplacian(f, point, config),
    makeError: (message) =>
      new CalculusDomainViolationError({
        operation: "laplacianWithPolicies",
        message
      }),
    annotations: (result) => ({
      dimensions: String(Chunk.size(point)),
      result: String(result)
    })
  })
