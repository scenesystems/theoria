/**
 * Applies runtime precision and diagnostics policies to univariate calculus results.
 *
 * @remarks
 * Synchronous callback exceptions fail with {@link KernelExecutionError}.
 * Strict precision fails with {@link CalculusDomainViolationError} when the
 * selected result is non-finite. Enabled diagnostics emit one annotated debug
 * log. Inputs and mathematical preconditions are not validated.
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
 * Estimates a first derivative and applies policies to its value and absolute error.
 *
 * @remarks
 * Strict precision requires both fields to be finite. It does not require
 * `converged` to be true.
 *
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 * @throws {@link CalculusDomainViolationError} when strict precision rejects the estimate.
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
 * Estimates a second derivative and applies policies to its value and absolute error.
 *
 * @remarks
 * Strict precision requires both fields to be finite. It does not require
 * `converged` to be true.
 *
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 * @throws {@link CalculusDomainViolationError} when strict precision rejects the estimate.
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
 * Projects the first-order Ridder estimate after runtime policies accept it.
 *
 * @remarks
 * A non-finite absolute-error estimate fails under strict precision even when
 * the projected value is finite.
 *
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 * @throws {@link CalculusDomainViolationError} when strict precision rejects the estimate.
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
 * Applies runtime policies to a second-order Ridder estimate and returns its value.
 *
 * @remarks
 * A non-finite absolute-error estimate fails under strict precision even when
 * the projected value is finite.
 *
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 * @throws {@link CalculusDomainViolationError} when strict precision rejects the estimate.
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
 * Integrates samples by trapezoid and applies policies to the scalar result.
 *
 * @remarks
 * Sample count, sample values, and spacing are used without validation.
 *
 * @throws {@link KernelExecutionError} when the synchronous kernel throws.
 * @throws {@link CalculusDomainViolationError} when strict precision rejects the result.
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
 * Integrates samples by Simpson quadrature and applies policies to the scalar result.
 *
 * @remarks
 * Sample count, sample values, and spacing are used without validation.
 *
 * @throws {@link KernelExecutionError} when the synchronous kernel throws.
 * @throws {@link CalculusDomainViolationError} when strict precision rejects the result.
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
 * Integrates a scalar function adaptively and applies policies to the estimate.
 *
 * @remarks
 * Bounds and recursion controls are used without validation. Reaching
 * `maxDepth` still succeeds if strict precision accepts the finite result.
 *
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 * @throws {@link CalculusDomainViolationError} when strict precision rejects the result.
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
