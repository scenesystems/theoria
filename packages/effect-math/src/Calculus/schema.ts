/**
 * Defines discovery metadata and serializable settings for numerical calculus.
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
 * Decoded Calculus discovery descriptor.
 *
 * @since 0.1.0
 * @category models
 */
export type CalculusDomain = typeof CalculusDomainSchema.Type

/**
 * Decodes Calculus discovery metadata and rejects excess fields.
 *
 * @throws {@link BoundaryDecodeError} in the Effect error channel when the
 * discriminator, stability, or object shape is invalid.
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
 * Encodes validated Calculus discovery metadata.
 *
 * @throws {@link BoundaryEncodeError} in the Effect error channel when a
 * value has been forged outside the `CalculusDomain` type.
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
 * Identifies Calculus descriptor decode and encode failures.
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
 * Accepts optional stopping and refinement controls for Ridder extrapolation.
 *
 * @remarks
 * Defaults are `1e-2` for `initialStep`, `1.4` for `contractionFactor`, `12`
 * iterations, `1e-12` absolute tolerance, `1e-10` relative tolerance,
 * `1e-14` for `minimumStep`, and `2.5` for `safetyFactor`. Step sizes and
 * tolerances must be positive. Contraction and safety factors must exceed `1`.
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
 * Decoded Ridder extrapolation controls with optional fields preserved.
 *
 * @since 0.2.0
 * @category models
 */
export type RidderMethodInputType = typeof RidderMethodInput.Type

/**
 * Accepts a finite derivative estimate with finite error and positive iteration count.
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
 * Records the selected derivative estimate and its refinement status.
 *
 * @remarks
 * Pure operations can return positive infinity for `absoluteError` when no
 * finite refinement is available. Such a value does not decode through
 * {@link DerivativeLimitEstimateSchema}.
 *
 * @since 0.2.0
 * @category models
 */
export type DerivativeLimitEstimate = typeof DerivativeLimitEstimateSchema.Type

/**
 * Accepts a finite point and optional Ridder controls for first differentiation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DerivativeInput = Schema.extend(
  Schema.Struct({ x: FiniteNumber }),
  RidderMethodInput
).annotations({ identifier: "DerivativeInput" })

/**
 * Accepts a finite point and optional Ridder controls for second differentiation.
 *
 * @since 0.2.0
 * @category schemas
 */
export const SecondDerivativeInput = Schema.extend(
  Schema.Struct({ x: FiniteNumber }),
  RidderMethodInput
).annotations({ identifier: "SecondDerivativeInput" })

/**
 * Accepts finite samples and positive spacing for composite trapezoidal integration.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TrapezoidInput = Schema.Struct({
  values: SampledValues,
  dx: StepSize
}).annotations({ identifier: "TrapezoidInput" })

/**
 * Accepts finite samples and positive spacing for Simpson integration with a final-interval fallback.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SimpsonInput = Schema.Struct({
  values: SampledValues,
  dx: StepSize
}).annotations({ identifier: "SimpsonInput" })

/**
 * Accepts finite integration bounds and optional positive adaptive-Simpson controls.
 *
 * @remarks
 * Defaults are `1e-10` for both tolerances and `16` for `maxDepth`. Bound
 * ordering is preserved, so reversing the bounds reverses the integral's sign.
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
 * Accepts a non-empty finite point and optional Ridder controls for a gradient.
 *
 * @since 0.2.0
 * @category schemas
 */
export const GradientInput = Schema.extend(PointInput, RidderMethodInput).annotations({
  identifier: "GradientInput"
})

/**
 * Accepts a non-empty finite point and optional Ridder controls for a Jacobian.
 *
 * @since 0.2.0
 * @category schemas
 */
export const JacobianInput = Schema.extend(PointInput, RidderMethodInput).annotations({
  identifier: "JacobianInput"
})

/**
 * Accepts a non-empty finite point and optional Ridder controls for a Hessian.
 *
 * @since 0.2.0
 * @category schemas
 */
export const HessianInput = Schema.extend(PointInput, RidderMethodInput).annotations({
  identifier: "HessianInput"
})

/**
 * Accepts non-empty finite point and direction vectors plus optional Ridder controls.
 *
 * @remarks
 * The schema does not require equal vector lengths or a non-zero direction.
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
 * Accepts a non-empty finite point and optional Ridder controls for divergence.
 *
 * @since 0.2.0
 * @category schemas
 */
export const DivergenceInput = Schema.extend(PointInput, RidderMethodInput).annotations({
  identifier: "DivergenceInput"
})

/**
 * Accepts a non-empty finite point and optional Ridder controls for a Laplacian.
 *
 * @since 0.2.0
 * @category schemas
 */
export const LaplacianInput = Schema.extend(PointInput, RidderMethodInput).annotations({
  identifier: "LaplacianInput"
})
