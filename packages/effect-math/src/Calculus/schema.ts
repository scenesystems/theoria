/**
 * Calculus schema authority — domain model and operation boundary contracts.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Chunk, Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { AbsoluteTolerance, IterationBudget, RelativeTolerance, StepSize } from "../contracts/shared/BrandedScalars.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Calculus domain model schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CalculusDomainSchema = Schema.Struct({
  domain: Schema.Literal("Calculus"),
  stability: DomainStability
})

/**
 * Calculus schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type CalculusDomain = typeof CalculusDomainSchema.Type

/**
 * Decodes unknown boundary input into the canonical calculus domain model.
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
 * Calculus boundary encode/decode errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type CalculusSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

const FiniteNumber = Schema.Number.pipe(Schema.finite())
const NonNegativeFiniteInteger = Schema.Number.pipe(Schema.finite(), Schema.int(), Schema.greaterThanOrEqualTo(0))
const NonNegativeFiniteNumber = FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0))
const GreaterThanOneFiniteNumber = FiniteNumber.pipe(Schema.greaterThan(1))
const NonEmptyFiniteChunk = Schema.Chunk(FiniteNumber).pipe(
  Schema.filter((values) => Chunk.size(values) > 0 || "Expected a non-empty state vector")
)
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
 * Ridder-method tuning envelope type.
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
 * First/second derivative limit estimate type.
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
 * ODE solver method identifiers.
 *
 * @since 0.3.0
 * @category schemas
 */
export const OdeMethod = Schema.Literal("euler", "rk4", "rk45")

/**
 * ODE solver method type.
 *
 * @since 0.3.0
 * @category models
 */
export type OdeMethodType = typeof OdeMethod.Type

/**
 * Canonical ODE solver status values.
 *
 * @since 0.3.0
 * @category schemas
 */
export const OdeSolveStatus = Schema.Literal("finished", "maxStepsExceeded", "stepSizeTooSmall")

/**
 * ODE solver status type.
 *
 * @since 0.3.0
 * @category models
 */
export type OdeSolveStatusType = typeof OdeSolveStatus.Type

/**
 * One published trajectory point from an IVP solve.
 *
 * @since 0.3.0
 * @category schemas
 */
export const OdeTrajectoryPoint = Schema.Struct({
  state: NonEmptyFiniteChunk,
  time: FiniteNumber
}).annotations({ identifier: "OdeTrajectoryPoint" })

/**
 * ODE trajectory point type.
 *
 * @since 0.3.0
 * @category models
 */
export type OdeTrajectoryPoint = typeof OdeTrajectoryPoint.Type

const NonEmptyOdeTrajectory = Schema.Chunk(OdeTrajectoryPoint).pipe(
  Schema.filter((points) => Chunk.size(points) > 0 || "Expected a non-empty ODE trajectory")
)

/**
 * Canonical result envelope shared by the released ODE solvers.
 *
 * **Details**
 * Fixed-step solvers publish trajectory points on the requested `stepSize`
 * cadence while `functionEvaluations` records any deterministic internal
 * substeps needed to meet the released parity envelope. Adaptive RK45 records
 * each accepted step directly in the trajectory.
 *
 * @since 0.3.0
 * @category schemas
 */
export const OdeSolveResultSchema = Schema.Struct({
  method: OdeMethod,
  status: OdeSolveStatus,
  finalTime: FiniteNumber,
  finalState: NonEmptyFiniteChunk,
  trajectory: NonEmptyOdeTrajectory,
  acceptedSteps: NonNegativeFiniteInteger,
  rejectedSteps: NonNegativeFiniteInteger,
  functionEvaluations: NonNegativeFiniteInteger
}).annotations({ identifier: "OdeSolveResult" })

/**
 * ODE solver result type.
 *
 * @since 0.3.0
 * @category models
 */
export type OdeSolveResult = typeof OdeSolveResultSchema.Type

const distinctInterval = <A extends { readonly finalTime: number; readonly initialTime: number }>(input: A) =>
  input.initialTime !== input.finalTime || "Expected initialTime and finalTime to differ"

/**
 * Fixed-step Euler input envelope.
 *
 * **Details**
 * `stepSize` names the published trajectory cadence. The solver may take
 * deterministic internal substeps while preserving that external grid.
 *
 * @since 0.3.0
 * @category schemas
 */
export const EulerInput = Schema.Struct({
  initialTime: FiniteNumber,
  finalTime: FiniteNumber,
  initialState: NonEmptyFiniteChunk,
  stepSize: StepSize,
  maxSteps: Schema.optional(IterationBudget)
}).pipe(Schema.filter(distinctInterval)).annotations({ identifier: "EulerInput" })

/**
 * Fixed-step Euler input type.
 *
 * @since 0.3.0
 * @category models
 */
export type EulerInputType = typeof EulerInput.Type

/**
 * Fixed-step classical RK4 input envelope.
 *
 * **Details**
 * `stepSize` names the published trajectory cadence. The solver may take
 * deterministic internal substeps while preserving that external grid.
 *
 * @since 0.3.0
 * @category schemas
 */
export const Rk4Input = Schema.Struct({
  initialTime: FiniteNumber,
  finalTime: FiniteNumber,
  initialState: NonEmptyFiniteChunk,
  stepSize: StepSize,
  maxSteps: Schema.optional(IterationBudget)
}).pipe(Schema.filter(distinctInterval)).annotations({ identifier: "Rk4Input" })

/**
 * Fixed-step RK4 input type.
 *
 * @since 0.3.0
 * @category models
 */
export type Rk4InputType = typeof Rk4Input.Type

/**
 * Adaptive Dormand-Prince RK45 input envelope.
 *
 * **Details**
 * `absoluteTolerance` and `relativeTolerance` map directly to the released
 * `atol` / `rtol` semantics used by the adaptive error controller.
 *
 * @since 0.3.0
 * @category schemas
 */
export const AdaptiveRk45Input = Schema.Struct({
  initialTime: FiniteNumber,
  finalTime: FiniteNumber,
  initialState: NonEmptyFiniteChunk,
  initialStep: Schema.optional(StepSize),
  maxStep: Schema.optional(StepSize),
  absoluteTolerance: Schema.optional(AbsoluteTolerance),
  relativeTolerance: Schema.optional(RelativeTolerance),
  maxSteps: Schema.optional(IterationBudget)
}).pipe(Schema.filter(distinctInterval)).annotations({ identifier: "AdaptiveRk45Input" })

/**
 * Adaptive RK45 input type.
 *
 * @since 0.3.0
 * @category models
 */
export type AdaptiveRk45InputType = typeof AdaptiveRk45Input.Type

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
