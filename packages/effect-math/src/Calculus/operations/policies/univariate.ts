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
import { estimateIsFinite } from "../shared.js"

export const derivativeLimitWithPolicies = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
) =>
  withCustomPolicyGuards({
    operation: "Calculus.derivativeLimitWithPolicies",
    compute: () => derivativeLimit(f, x, config),
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

export const secondDerivativeLimitWithPolicies = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
) =>
  withCustomPolicyGuards({
    operation: "Calculus.secondDerivativeLimitWithPolicies",
    compute: () => secondDerivativeLimit(f, x, config),
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

export const derivativeWithPolicies = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
) => Effect.map(derivativeLimitWithPolicies(f, x, config), (estimate) => estimate.value)

export const secondDerivativeWithPolicies = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
) => Effect.map(secondDerivativeLimitWithPolicies(f, x, config), (estimate) => estimate.value)

export const trapezoidWithPolicies = (values: Chunk.Chunk<number>, dx: number) =>
  withScalarPolicyGuards({
    operation: "Calculus.trapezoidWithPolicies",
    compute: () => trapezoid(values, dx),
    makeError: (message) =>
      new CalculusDomainViolationError({
        operation: "trapezoidWithPolicies",
        message
      }),
    annotations: (result) => ({
      inputSize: String(Chunk.size(values)),
      dx: String(dx),
      result: String(result)
    })
  })

export const simpsonWithPolicies = (values: Chunk.Chunk<number>, dx: number) =>
  withScalarPolicyGuards({
    operation: "Calculus.simpsonWithPolicies",
    compute: () => simpson(values, dx),
    makeError: (message) =>
      new CalculusDomainViolationError({
        operation: "simpsonWithPolicies",
        message
      }),
    annotations: (result) => ({
      inputSize: String(Chunk.size(values)),
      dx: String(dx),
      result: String(result)
    })
  })

export const adaptiveSimpsonWithPolicies = (
  f: (x: number) => number,
  a: number,
  b: number,
  absoluteTolerance?: number,
  relativeTolerance?: number,
  maxDepth?: number
) =>
  withScalarPolicyGuards({
    operation: "Calculus.adaptiveSimpsonWithPolicies",
    compute: () => adaptiveSimpson(f, a, b, absoluteTolerance, relativeTolerance, maxDepth),
    makeError: (message) =>
      new CalculusDomainViolationError({
        operation: "adaptiveSimpsonWithPolicies",
        message
      }),
    annotations: (result) => ({
      a: String(a),
      b: String(b),
      absoluteTolerance: String(absoluteTolerance ?? 1e-10),
      relativeTolerance: String(relativeTolerance ?? 1e-10),
      maxDepth: String(maxDepth ?? 16),
      result: String(result)
    })
  })
