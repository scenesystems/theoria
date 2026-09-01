/**
 * Calculus schema authority — domain model and operation boundary contracts.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { AbsoluteTolerance, IterationBudget, RelativeTolerance, StepSize } from "../contracts/shared/BrandedScalars.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Accepts only the `"Calculus"` discovery discriminator and a known stability value.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CalculusDomainSchema = Schema.Struct({
  domain: Schema.Literal("Calculus"),
  stability: DomainStability
})

/**
 * Discovery metadata identifying numerical differentiation and integration
 * capabilities in a recognized stability lane.
 *
 * @since 0.1.0
 * @category models
 */
export type CalculusDomain = typeof CalculusDomainSchema.Type

/**
 * Validates the capability descriptor used to register numerical
 * differentiation and integration. Unknown stability values or additional
 * fields fail with {@link BoundaryDecodeError}.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeCalculusDomain = (input: unknown) =>
  Schema.decodeUnknown(CalculusDomainSchema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Calculus",
          contract: "CalculusDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes the canonical calculus domain model at the package boundary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeCalculusDomain = (domain: CalculusDomain) =>
  Schema.encode(CalculusDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Calculus",
          contract: "CalculusDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Decode failures for unknown input or encode failures for forged Calculus descriptors.
 *
 * @since 0.1.0
 * @category errors
 */
export type CalculusSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

const FiniteNumber = Schema.Number.pipe(Schema.finite())
const NonNegativeFiniteNumber = FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0))
const GreaterThanOneFiniteNumber = FiniteNumber.pipe(Schema.greaterThan(1))
const NonEmptyFiniteNumberArray = Schema.NonEmptyArray(FiniteNumber)

const SampledValues = Schema.Array(FiniteNumber).pipe(
  Schema.filter((values) => values.length >= 2 || "Expected at least two sampled values")
)

const RidderContractionFactor = GreaterThanOneFiniteNumber.pipe(Schema.brand("RidderContractionFactor"))
const RidderSafetyFactor = GreaterThanOneFiniteNumber.pipe(Schema.brand("RidderSafetyFactor"))

/**
 * Ridder-method tuning envelope shared across derivative-based operators.
 *
 * @since 0.2.0
 * @category schemas
 */
export const RidderMethodInput = Schema.Struct({
  initialStep: Schema.optional(StepSize),
  contractionFactor: Schema.optional(RidderContractionFactor),
  maxIterations: Schema.optional(IterationBudget),
  absoluteTolerance: Schema.optional(AbsoluteTolerance),
  relativeTolerance: Schema.optional(RelativeTolerance),
  minimumStep: Schema.optional(StepSize),
  safetyFactor: Schema.optional(RidderSafetyFactor)
}).annotations({ identifier: "RidderMethodInput" })

/**
 * Optional initial step, error tolerances, iteration budget, and contraction
 * factor used to refine Ridder derivative estimates.
 *
 * @since 0.2.0
 * @category models
 */
export type RidderMethodInputType = typeof RidderMethodInput.Type

/**
 * First/second derivative limit estimate payload.
 *
 * @since 0.2.0
 * @category schemas
 */
export const DerivativeLimitEstimateSchema = Schema.Struct({
  value: FiniteNumber,
  absoluteError: NonNegativeFiniteNumber,
  iterations: IterationBudget,
  converged: Schema.Boolean
}).annotations({ identifier: "DerivativeLimitEstimate" })

/**
 * A derivative estimate paired with its non-negative absolute error, iteration
 * count, and convergence flag.
 *
 * @since 0.2.0
 * @category models
 */
export type DerivativeLimitEstimate = typeof DerivativeLimitEstimateSchema.Type

/**
 * Univariate first-derivative input envelope.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DerivativeInput = Schema.extend(
  Schema.Struct({ x: FiniteNumber }),
  RidderMethodInput
).annotations({ identifier: "DerivativeInput" })

/**
 * Univariate second-derivative input envelope.
 *
 * @since 0.2.0
 * @category schemas
 */
export const SecondDerivativeInput = Schema.extend(
  Schema.Struct({ x: FiniteNumber }),
  RidderMethodInput
).annotations({ identifier: "SecondDerivativeInput" })

/**
 * Trapezoidal-rule input envelope.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TrapezoidInput = Schema.Struct({
  values: SampledValues,
  dx: StepSize
}).annotations({ identifier: "TrapezoidInput" })

/**
 * Simpson-rule input envelope.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SimpsonInput = Schema.Struct({
  values: SampledValues,
  dx: StepSize
}).annotations({ identifier: "SimpsonInput" })

/**
 * Adaptive-Simpson input with independent absolute and relative tolerances.
 *
 * @since 0.2.0
 * @category schemas
 */
export const AdaptiveSimpsonInput = Schema.Struct({
  a: FiniteNumber,
  b: FiniteNumber,
  absoluteTolerance: Schema.optional(AbsoluteTolerance),
  relativeTolerance: Schema.optional(RelativeTolerance),
  maxDepth: Schema.optional(IterationBudget)
}).annotations({ identifier: "AdaptiveSimpsonInput" })

/**
 * Gradient/Jacobian/Hessian point input envelope.
 *
 * @since 0.1.0
 * @category schemas
 */
const PointInput = Schema.Struct({
  point: NonEmptyFiniteNumberArray
})

/**
 * Gradient input envelope.
 *
 * @since 0.2.0
 * @category schemas
 */
export const GradientInput = Schema.extend(PointInput, RidderMethodInput).annotations({
  identifier: "GradientInput"
})

/**
 * Jacobian input envelope.
 *
 * @since 0.2.0
 * @category schemas
 */
export const JacobianInput = Schema.extend(PointInput, RidderMethodInput).annotations({
  identifier: "JacobianInput"
})

/**
 * Hessian input envelope.
 *
 * @since 0.2.0
 * @category schemas
 */
export const HessianInput = Schema.extend(PointInput, RidderMethodInput).annotations({
  identifier: "HessianInput"
})

/**
 * Directional-derivative input envelope.
 *
 * @since 0.2.0
 * @category schemas
 */
export const DirectionalDerivativeInput = Schema.extend(
  Schema.Struct({
    point: NonEmptyFiniteNumberArray,
    direction: NonEmptyFiniteNumberArray
  }),
  RidderMethodInput
).annotations({ identifier: "DirectionalDerivativeInput" })

/**
 * Divergence input envelope.
 *
 * @since 0.2.0
 * @category schemas
 */
export const DivergenceInput = Schema.extend(PointInput, RidderMethodInput).annotations({
  identifier: "DivergenceInput"
})

/**
 * Laplacian input envelope.
 *
 * @since 0.2.0
 * @category schemas
 */
export const LaplacianInput = Schema.extend(PointInput, RidderMethodInput).annotations({
  identifier: "LaplacianInput"
})
