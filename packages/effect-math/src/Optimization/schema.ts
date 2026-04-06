/**
 * Optimization schema authority — domain model and boundary codec contracts.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Optimization domain model schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const OptimizationDomainSchema = Schema.Struct({
  domain: Schema.Literal("Optimization"),
  stability: DomainStability
})

/**
 * Decodes unknown boundary input into the canonical optimization domain model.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeOptimizationDomain = (input: unknown) =>
  Schema.decodeUnknown(OptimizationDomainSchema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Optimization",
          contract: "OptimizationDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes the canonical optimization domain model at the package boundary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeOptimizationDomain = (domain: OptimizationDomain) =>
  Schema.encode(OptimizationDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Optimization",
          contract: "OptimizationDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Optimization boundary encode/decode errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type OptimizationSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Optimization schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type OptimizationDomain = typeof OptimizationDomainSchema.Type

// ---------------------------------------------------------------------------
// Operation input schemas
// ---------------------------------------------------------------------------

/**
 * Bisection method input — two finite bracket endpoints with optional
 * tolerance and iteration budget.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BisectInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.finite()),
  b: Schema.Number.pipe(Schema.finite()),
  tolerance: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))),
  maxIterations: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)))
}).annotations({ identifier: "BisectInput" })

/**
 * Golden section search input — two finite bracket endpoints with
 * optional tolerance and iteration budget.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GoldenSectionInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.finite()),
  b: Schema.Number.pipe(Schema.finite()),
  tolerance: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))),
  maxIterations: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)))
}).annotations({ identifier: "GoldenSectionInput" })

/**
 * Canonical nonlinear root-finding method selector.
 *
 * @since 0.3.0
 * @category schemas
 */
export const RootFindingMethod = Schema.Literal("brent", "secant", "newtonRaphson")

/**
 * Canonical nonlinear root-finding status envelope.
 *
 * @since 0.3.0
 * @category schemas
 */
export const RootFindingStatus = Schema.Literal(
  "converged",
  "invalidBracket",
  "zeroDerivative",
  "maxIterationsExceeded"
)

/**
 * Canonical nonlinear root-finding result envelope shared across
 * bracketed and derivative-driven solvers.
 *
 * @since 0.3.0
 * @category schemas
 */
export class RootFindingResult extends Schema.Class<RootFindingResult>("RootFindingResult")({
  method: RootFindingMethod,
  status: RootFindingStatus,
  root: Schema.Number.pipe(Schema.finite()),
  residual: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  iterationCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  functionEvaluationCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * Brent root-finding input envelope.
 *
 * @since 0.3.0
 * @category schemas
 */
export const BrentInput = Schema.Struct({
  method: Schema.Literal("brent"),
  lowerBound: Schema.Number.pipe(Schema.finite()),
  upperBound: Schema.Number.pipe(Schema.finite()),
  absoluteTolerance: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))),
  relativeTolerance: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))),
  maxIterations: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)))
}).annotations({ identifier: "BrentInput" })

/**
 * Secant root-finding input envelope.
 *
 * @since 0.3.0
 * @category schemas
 */
export const SecantInput = Schema.Struct({
  method: Schema.Literal("secant"),
  previousEstimate: Schema.Number.pipe(Schema.finite()),
  currentEstimate: Schema.Number.pipe(Schema.finite()),
  absoluteTolerance: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))),
  relativeTolerance: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))),
  maxIterations: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)))
}).annotations({ identifier: "SecantInput" })

/**
 * Newton-Raphson root-finding input envelope.
 *
 * @since 0.3.0
 * @category schemas
 */
export const NewtonRaphsonInput = Schema.Struct({
  method: Schema.Literal("newtonRaphson"),
  initialGuess: Schema.Number.pipe(Schema.finite()),
  absoluteTolerance: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))),
  relativeTolerance: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))),
  maxIterations: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)))
}).annotations({ identifier: "NewtonRaphsonInput" })

/**
 * Canonical nonlinear root-finding input union.
 *
 * @since 0.3.0
 * @category schemas
 */
export const RootFindingInput = Schema.Union(BrentInput, SecantInput, NewtonRaphsonInput).annotations({
  identifier: "RootFindingInput"
})

/**
 * Root-finding method selector type.
 *
 * @since 0.3.0
 * @category models
 */
export type RootFindingMethodType = typeof RootFindingMethod.Type

/**
 * Root-finding status type.
 *
 * @since 0.3.0
 * @category models
 */
export type RootFindingStatusType = typeof RootFindingStatus.Type

/**
 * Canonical nonlinear root-finding result type.
 *
 * @since 0.3.0
 * @category models
 */
export type RootFindingResultType = typeof RootFindingResult.Type

/**
 * Brent input type.
 *
 * @since 0.3.0
 * @category models
 */
export type BrentInputType = typeof BrentInput.Type

/**
 * Secant input type.
 *
 * @since 0.3.0
 * @category models
 */
export type SecantInputType = typeof SecantInput.Type

/**
 * Newton-Raphson input type.
 *
 * @since 0.3.0
 * @category models
 */
export type NewtonRaphsonInputType = typeof NewtonRaphsonInput.Type

/**
 * Canonical nonlinear root-finding input type.
 *
 * @since 0.3.0
 * @category models
 */
export type RootFindingInputType = typeof RootFindingInput.Type
