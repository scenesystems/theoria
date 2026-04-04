/**
 * Policy-aware wrappers for univariate and integration calculus operations.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect } from "effect"

import { withCustomPolicyGuards, withScalarPolicyGuards } from "../../../contracts/shared/PolicyGuards.js"
import { CalculusDomainViolationError } from "../../errors.js"
import type { RidderMethodInputType } from "../../schema.js"
import { adaptiveSimpson, derivativeLimit, secondDerivativeLimit, simpson, trapezoid } from "../pure.js"
import { estimateIsFinite, executeKernel } from "../shared.js"

/**
 * Policy-aware first-derivative limit estimate.
 *
 * @since 0.2.0
 * @category operations
 */
export const derivativeLimitWithPolicies = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
) =>
  executeKernel("derivativeLimitWithPolicies", () => derivativeLimit(f, x, config)).pipe(
    Effect.flatMap((estimate) =>
      withCustomPolicyGuards({
        operation: "Calculus.derivativeLimitWithPolicies",
        compute: () => estimate,
        isValid: estimateIsFinite,
        makeError: (message) =>
          new CalculusDomainViolationError({
            operation: "derivativeLimitWithPolicies",
            message
          }),
        annotations: (result) => ({
          x: String(x),
          value: String(result.value),
          absoluteError: String(result.absoluteError),
          converged: String(result.converged)
        })
      })
    )
  )

/**
 * Policy-aware second-derivative limit estimate.
 *
 * @since 0.2.0
 * @category operations
 */
export const secondDerivativeLimitWithPolicies = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
) =>
  executeKernel("secondDerivativeLimitWithPolicies", () => secondDerivativeLimit(f, x, config)).pipe(
    Effect.flatMap((estimate) =>
      withCustomPolicyGuards({
        operation: "Calculus.secondDerivativeLimitWithPolicies",
        compute: () => estimate,
        isValid: estimateIsFinite,
        makeError: (message) =>
          new CalculusDomainViolationError({
            operation: "secondDerivativeLimitWithPolicies",
            message
          }),
        annotations: (result) => ({
          x: String(x),
          value: String(result.value),
          absoluteError: String(result.absoluteError),
          converged: String(result.converged)
        })
      })
    )
  )

/**
 * Policy-aware first derivative value projection.
 *
 * @since 0.1.0
 * @category operations
 */
export const derivativeWithPolicies = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
) => Effect.map(derivativeLimitWithPolicies(f, x, config), (estimate) => estimate.value)

/**
 * Policy-aware second derivative value projection.
 *
 * @since 0.2.0
 * @category operations
 */
export const secondDerivativeWithPolicies = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
) => Effect.map(secondDerivativeLimitWithPolicies(f, x, config), (estimate) => estimate.value)

/**
 * Policy-aware trapezoidal integration.
 *
 * @since 0.1.0
 * @category operations
 */
export const trapezoidWithPolicies = (values: Chunk.Chunk<number>, dx: number) =>
  executeKernel("trapezoidWithPolicies", () => trapezoid(values, dx)).pipe(
    Effect.flatMap((result) =>
      withScalarPolicyGuards({
        operation: "Calculus.trapezoidWithPolicies",
        compute: () => result,
        makeError: (message) =>
          new CalculusDomainViolationError({
            operation: "trapezoidWithPolicies",
            message
          }),
        annotations: (value) => ({
          inputSize: String(Chunk.size(values)),
          dx: String(dx),
          result: String(value)
        })
      })
    )
  )

/**
 * Policy-aware Simpson integration.
 *
 * @since 0.1.0
 * @category operations
 */
export const simpsonWithPolicies = (values: Chunk.Chunk<number>, dx: number) =>
  executeKernel("simpsonWithPolicies", () => simpson(values, dx)).pipe(
    Effect.flatMap((result) =>
      withScalarPolicyGuards({
        operation: "Calculus.simpsonWithPolicies",
        compute: () => result,
        makeError: (message) =>
          new CalculusDomainViolationError({
            operation: "simpsonWithPolicies",
            message
          }),
        annotations: (value) => ({
          inputSize: String(Chunk.size(values)),
          dx: String(dx),
          result: String(value)
        })
      })
    )
  )

/**
 * Policy-aware adaptive Simpson integration.
 *
 * @since 0.2.0
 * @category operations
 */
export const adaptiveSimpsonWithPolicies = (
  f: (x: number) => number,
  a: number,
  b: number,
  absoluteTolerance?: number,
  relativeTolerance?: number,
  maxDepth?: number
) =>
  executeKernel(
    "adaptiveSimpsonWithPolicies",
    () => adaptiveSimpson(f, a, b, absoluteTolerance, relativeTolerance, maxDepth)
  ).pipe(
    Effect.flatMap((result) =>
      withScalarPolicyGuards({
        operation: "Calculus.adaptiveSimpsonWithPolicies",
        compute: () => result,
        makeError: (message) =>
          new CalculusDomainViolationError({
            operation: "adaptiveSimpsonWithPolicies",
            message
          }),
        annotations: (value) => ({
          a: String(a),
          b: String(b),
          absoluteTolerance: String(absoluteTolerance ?? 1e-10),
          relativeTolerance: String(relativeTolerance ?? 1e-10),
          maxDepth: String(maxDepth ?? 16),
          result: String(value)
        })
      })
    )
  )
