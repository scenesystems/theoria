/**
 * Numerical differentiation, multivariate differential operators, and quadrature.
 *
 * @since 0.1.0
 * @module
 */
import { Boolean, Chunk, Effect, Inspectable, Match, Number, Option, Predicate, Schema, String } from "effect"

import * as Complex from "./Complex.js"
import * as AdaptiveSimpson from "./internal/calculus/adaptiveSimpson.js"
import * as Integration from "./internal/calculus/integration.js"
import * as Multivariate from "./internal/calculus/multivariate.js"
import * as Ridder from "./internal/calculus/ridderUnivariate.js"
import * as PolicyGuard from "./internal/policyGuard.js"
import * as Numeric from "./Numeric.js"

const finite = Schema.Number.pipe(Schema.finite())
const positiveGreaterThanOne = finite.pipe(Schema.greaterThan(1))
const point = Schema.Struct({ point: Schema.NonEmptyChunk(finite) })
const defaultComplexStep = Schema.decodeSync(Numeric.StepSize)(1e-20)
const encodeBoolean = Schema.encodeSync(Schema.BooleanFromString)
const encodeNumber = Schema.encodeSync(Schema.NumberFromString)
const sampledValues = Schema.Chunk(finite).pipe(
  Schema.filter((values) =>
    Boolean.match(Number.greaterThanOrEqualTo(Chunk.size(values), 2), {
      onTrue: () => true,
      onFalse: () => "Expected at least two sampled values"
    })
  )
)

/**
 * Accepts optional stopping and refinement controls for Ridder extrapolation.
 *
 * @since 0.2.0
 * @category schemas
 */
export const RidderMethodInput = Schema.Struct({
  initialStep: Schema.optional(Numeric.StepSize),
  contractionFactor: Schema.optional(positiveGreaterThanOne),
  maxIterations: Schema.optional(Numeric.IterationBudget),
  absoluteTolerance: Schema.optional(Numeric.AbsoluteTolerance),
  relativeTolerance: Schema.optional(Numeric.RelativeTolerance),
  minimumStep: Schema.optional(Numeric.StepSize),
  safetyFactor: Schema.optional(positiveGreaterThanOne)
}).annotations({ identifier: "@scenesystems/effect-math/Calculus/RidderMethodInput" })

/**
 * Ridder extrapolation controls with defaults applied by the solver.
 *
 * @since 0.2.0
 * @category models
 */
export type RidderMethodInput = typeof RidderMethodInput.Type

/**
 * Accepts a finite derivative estimate and its convergence metadata.
 *
 * @since 0.2.0
 * @category schemas
 */
export const DerivativeLimitEstimate = Schema.Struct({
  value: finite,
  absoluteError: finite.pipe(Schema.nonNegative()),
  iterations: Numeric.IterationBudget,
  converged: Schema.Boolean
}).annotations({ identifier: "@scenesystems/effect-math/Calculus/DerivativeLimitEstimate" })

/**
 * A derivative estimate with an error bound and refinement status.
 *
 * @since 0.2.0
 * @category models
 */
export type DerivativeLimitEstimate = typeof DerivativeLimitEstimate.Type

/**
 * Accepts a finite point and optional first-derivative controls.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DerivativeInput = Schema.extend(
  Schema.Struct({ x: finite }),
  RidderMethodInput
).annotations({ identifier: "@scenesystems/effect-math/Calculus/DerivativeInput" })

/**
 * Decoded first-derivative input.
 *
 * @since 0.1.0
 * @category models
 */
export type DerivativeInput = typeof DerivativeInput.Type

/**
 * Accepts a finite point and optional second-derivative controls.
 *
 * @since 0.2.0
 * @category schemas
 */
export const SecondDerivativeInput = Schema.extend(
  Schema.Struct({ x: finite }),
  RidderMethodInput
).annotations({ identifier: "@scenesystems/effect-math/Calculus/SecondDerivativeInput" })

/**
 * Decoded second-derivative input.
 *
 * @since 0.2.0
 * @category models
 */
export type SecondDerivativeInput = typeof SecondDerivativeInput.Type

/**
 * Accepts a finite point and an optional positive complex-step size.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ComplexStepInput = Schema.Struct({
  x: finite,
  h: Schema.optionalWith(Numeric.StepSize, { default: () => defaultComplexStep })
}).annotations({ identifier: "@scenesystems/effect-math/Calculus/ComplexStepInput" })

/**
 * Decoded complex-step differentiation input.
 *
 * @since 0.1.0
 * @category models
 */
export type ComplexStepInput = typeof ComplexStepInput.Type

/**
 * Accepts finite samples and positive spacing for trapezoidal integration.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TrapezoidInput = Schema.Struct({ values: sampledValues, dx: Numeric.StepSize }).annotations({
  identifier: "@scenesystems/effect-math/Calculus/TrapezoidInput"
})

/**
 * Decoded trapezoidal integration input.
 *
 * @since 0.1.0
 * @category models
 */
export type TrapezoidInput = typeof TrapezoidInput.Type

/**
 * Accepts finite samples and positive spacing for Simpson integration.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SimpsonInput = Schema.Struct({ values: sampledValues, dx: Numeric.StepSize }).annotations({
  identifier: "@scenesystems/effect-math/Calculus/SimpsonInput"
})

/**
 * Decoded Simpson integration input.
 *
 * @since 0.1.0
 * @category models
 */
export type SimpsonInput = typeof SimpsonInput.Type

/**
 * Accepts finite bounds and optional adaptive-Simpson controls.
 *
 * @since 0.2.0
 * @category schemas
 */
export const AdaptiveSimpsonInput = Schema.Struct({
  a: finite,
  b: finite,
  absoluteTolerance: Schema.optional(Numeric.AbsoluteTolerance),
  relativeTolerance: Schema.optional(Numeric.RelativeTolerance),
  maxDepth: Schema.optional(Numeric.IterationBudget)
}).annotations({ identifier: "@scenesystems/effect-math/Calculus/AdaptiveSimpsonInput" })

/**
 * Decoded adaptive-Simpson input.
 *
 * @since 0.2.0
 * @category models
 */
export type AdaptiveSimpsonInput = typeof AdaptiveSimpsonInput.Type

/**
 * Accepts a non-empty finite point and optional gradient controls.
 *
 * @since 0.2.0
 * @category schemas
 */
export const GradientInput = Schema.extend(point, RidderMethodInput).annotations({
  identifier: "@scenesystems/effect-math/Calculus/GradientInput"
})

/**
 * Decoded gradient input.
 *
 * @since 0.2.0
 * @category models
 */
export type GradientInput = typeof GradientInput.Type

/**
 * Accepts a non-empty finite point and optional Jacobian controls.
 *
 * @since 0.2.0
 * @category schemas
 */
export const JacobianInput = Schema.extend(point, RidderMethodInput).annotations({
  identifier: "@scenesystems/effect-math/Calculus/JacobianInput"
})

/**
 * Decoded Jacobian input.
 *
 * @since 0.2.0
 * @category models
 */
export type JacobianInput = typeof JacobianInput.Type

/**
 * Accepts a non-empty finite point and optional Hessian controls.
 *
 * @since 0.2.0
 * @category schemas
 */
export const HessianInput = Schema.extend(point, RidderMethodInput).annotations({
  identifier: "@scenesystems/effect-math/Calculus/HessianInput"
})

/**
 * Decoded Hessian input.
 *
 * @since 0.2.0
 * @category models
 */
export type HessianInput = typeof HessianInput.Type

/**
 * Accepts finite point and direction vectors plus optional refinement controls.
 *
 * @since 0.2.0
 * @category schemas
 */
export const DirectionalDerivativeInput = Schema.extend(
  Schema.Struct({ point: Schema.NonEmptyChunk(finite), direction: Schema.NonEmptyChunk(finite) }),
  RidderMethodInput
).annotations({ identifier: "@scenesystems/effect-math/Calculus/DirectionalDerivativeInput" })

/**
 * Decoded directional-derivative input.
 *
 * @since 0.2.0
 * @category models
 */
export type DirectionalDerivativeInput = typeof DirectionalDerivativeInput.Type

/**
 * Accepts a non-empty finite point and optional divergence controls.
 *
 * @since 0.2.0
 * @category schemas
 */
export const DivergenceInput = Schema.extend(point, RidderMethodInput).annotations({
  identifier: "@scenesystems/effect-math/Calculus/DivergenceInput"
})

/**
 * Decoded divergence input.
 *
 * @since 0.2.0
 * @category models
 */
export type DivergenceInput = typeof DivergenceInput.Type

/**
 * Accepts a non-empty finite point and optional Laplacian controls.
 *
 * @since 0.2.0
 * @category schemas
 */
export const LaplacianInput = Schema.extend(point, RidderMethodInput).annotations({
  identifier: "@scenesystems/effect-math/Calculus/LaplacianInput"
})

/**
 * Decoded Laplacian input.
 *
 * @since 0.2.0
 * @category models
 */
export type LaplacianInput = typeof LaplacianInput.Type

/**
 * Reports malformed input to a validated calculus operation.
 *
 * @since 0.1.0
 * @category errors
 */
export class DecodeError extends Schema.TaggedError<DecodeError>()("CalculusDecodeError", {
  /** Operation whose input failed decoding. */
  operation: Schema.String,
  /** Effect Schema issue report. */
  message: Schema.String
}) {}

/**
 * Reports a non-finite result rejected by strict precision.
 *
 * @since 0.1.0
 * @category errors
 */
export class DomainViolationError extends Schema.TaggedError<DomainViolationError>()("CalculusDomainViolationError", {
  /** Policy-aware operation that produced the result. */
  operation: Schema.String,
  /** Diagnostic describing the rejected result. */
  message: Schema.String
}) {}

/**
 * Reports incompatible dimensions at a validated calculus boundary.
 *
 * @since 0.1.0
 * @category errors
 */
export class ParameterError extends Schema.TaggedError<ParameterError>()("CalculusParameterError", {
  /** Operation whose mathematical precondition failed. */
  operation: Schema.String,
  /** Diagnostic describing the incompatible parameters. */
  message: Schema.String
}) {}

/**
 * Failures emitted by validated and policy-aware calculus operations.
 *
 * @since 0.1.0
 * @category errors
 */
export type OperationError = DecodeError | DomainViolationError | ParameterError | Numeric.ExecutionError

const formatExecutionError = (error: unknown): string =>
  Match.value(error).pipe(
    Match.when(Predicate.isError, (cause) => cause.message),
    Match.orElse((cause) => Inspectable.toStringUnknown(cause, 0))
  )

const execute = <A>(operation: string, computation: () => A): Effect.Effect<A, Numeric.ExecutionError> =>
  Effect.try({
    try: computation,
    catch: (error) => new Numeric.ExecutionError({ operation, message: formatExecutionError(error) })
  })

const decode = <A, I, R>(schema: Schema.Schema<A, I, R>, operation: string, input: unknown) =>
  Schema.decodeUnknown(schema)(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError((error) => new DecodeError({ operation, message: error.message }))
  )

const ensureParameters = (operation: string, condition: boolean, message: string) =>
  Boolean.match(condition, {
    onTrue: () => Effect.void,
    onFalse: () => Effect.fail(new ParameterError({ operation, message }))
  })

const vectorIsFinite = (values: Chunk.Chunk<number>): boolean =>
  Chunk.reduce(values, true, (valid, value) => Boolean.and(valid, Numeric.isFinite(value)))

const matrixIsFinite = (matrix: Chunk.Chunk<Chunk.Chunk<number>>): boolean =>
  Chunk.reduce(matrix, true, (valid, row) => Boolean.and(valid, vectorIsFinite(row)))

const estimateIsFinite = (estimate: DerivativeLimitEstimate): boolean =>
  Boolean.and(Numeric.isFinite(estimate.value), Numeric.isFinite(estimate.absoluteError))

/**
 * Estimates a first derivative by central differences and Ridder extrapolation.
 * Exhausting refinement returns the best candidate with `converged: false`.
 *
 * @since 0.2.0
 * @category operations
 */
export const derivativeLimit = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInput
): DerivativeLimitEstimate => Ridder.derivativeLimitRidder(f, x, config)

/**
 * Estimates a second derivative by symmetric differences and Ridder extrapolation.
 * Exhausting refinement returns the best candidate with `converged: false`.
 *
 * @since 0.2.0
 * @category operations
 */
export const secondDerivativeLimit = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInput
): DerivativeLimitEstimate => Ridder.secondDerivativeLimitRidder(f, x, config)

/**
 * Estimates a first derivative and returns only the selected value.
 *
 * @since 0.1.0
 * @category operations
 */
export const derivative = (f: (x: number) => number, x: number, config?: RidderMethodInput): number =>
  derivativeLimit(f, x, config).value

/**
 * Estimates a second derivative and returns only the selected value.
 *
 * @since 0.2.0
 * @category operations
 */
export const secondDerivative = (f: (x: number) => number, x: number, config?: RidderMethodInput): number =>
  secondDerivativeLimit(f, x, config).value

/**
 * Estimates an analytic derivative as `Im(f(x + ih)) / h`.
 *
 * @since 0.1.0
 * @category operations
 */
export const complexStep = (
  f: (z: Complex.Complex) => Complex.Complex,
  x: number,
  h: number = 1e-20
): number => Number.unsafeDivide(f(Complex.make(x, h)).im, h)

/**
 * Integrates evenly spaced samples with the composite trapezoidal rule. Fewer
 * than two samples return `NaN`; negative spacing reverses the sign.
 *
 * @since 0.1.0
 * @category operations
 */
export const trapezoid = (values: Chunk.Chunk<number>, dx: number): number => Integration.trapezoidalRule(values, dx)

/**
 * Integrates evenly spaced samples with composite Simpson quadrature. Two
 * samples use trapezoid; an odd final interval also uses trapezoid; fewer than
 * two samples return `NaN`.
 *
 * @since 0.1.0
 * @category operations
 */
export const simpson = (values: Chunk.Chunk<number>, dx: number): number => Integration.simpsonsRule(values, dx)

/**
 * Integrates a scalar function with adaptive Simpson quadrature. Defaults are
 * `1e-10` for absolute and relative tolerance and `16` levels. Reversed bounds
 * produce a signed integral; depth exhaustion returns the current estimate.
 *
 * @since 0.2.0
 * @category operations
 */
export const adaptiveSimpson = (
  f: (x: number) => number,
  a: number,
  b: number,
  absoluteTolerance?: number,
  relativeTolerance?: number,
  maxDepth?: number
): number => AdaptiveSimpson.adaptiveSimpsonIntegral(f, a, b, absoluteTolerance, relativeTolerance, maxDepth)

/**
 * Estimates one partial derivative per input coordinate.
 *
 * @since 0.2.0
 * @category operations
 */
export const gradient = (
  f: (point: Chunk.Chunk<number>) => number,
  at: Chunk.Chunk<number>,
  config?: RidderMethodInput
): Chunk.Chunk<number> => Multivariate.gradientLimit(f, at, config)

/**
 * Estimates a vector field's Jacobian with rows in output-component order and
 * columns in input-coordinate order. Evaluations are cached for one call.
 *
 * @since 0.2.0
 * @category operations
 */
export const jacobian = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  at: Chunk.Chunk<number>,
  config?: RidderMethodInput
): Chunk.Chunk<Chunk.Chunk<number>> => Multivariate.jacobianLimit(f, at, config)

/**
 * Estimates a symmetric Hessian, computing each mixed partial once.
 *
 * @since 0.2.0
 * @category operations
 */
export const hessian = (
  f: (point: Chunk.Chunk<number>) => number,
  at: Chunk.Chunk<number>,
  config?: RidderMethodInput
): Chunk.Chunk<Chunk.Chunk<number>> => Multivariate.hessianLimit(f, at, config)

/**
 * Projects an estimated gradient onto a normalized direction. Unequal lengths
 * or a zero direction produce `NaN`.
 *
 * @since 0.2.0
 * @category operations
 */
export const directionalDerivative = (
  f: (point: Chunk.Chunk<number>) => number,
  at: Chunk.Chunk<number>,
  direction: Chunk.Chunk<number>,
  config?: RidderMethodInput
): number => Multivariate.directionalDerivativeLimit(f, at, direction, config)

/**
 * Sums the diagonal of a vector field's estimated Jacobian. A field dimension
 * different from the point dimension produces `NaN`.
 *
 * @since 0.2.0
 * @category operations
 */
export const divergence = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  at: Chunk.Chunk<number>,
  config?: RidderMethodInput
): number => Multivariate.divergenceLimit(f, at, config)

/**
 * Sums the diagonal of a scalar function's estimated Hessian.
 *
 * @since 0.2.0
 * @category operations
 */
export const laplacian = (
  f: (point: Chunk.Chunk<number>) => number,
  at: Chunk.Chunk<number>,
  config?: RidderMethodInput
): number => Multivariate.laplacianLimit(f, at, config)

/**
 * Decodes a finite point and positive Ridder controls with excess properties
 * rejected, then captures callback failures in the typed error channel.
 *
 * @since 0.2.0
 * @category validated operations
 */
export const derivativeLimitValidated = (f: (x: number) => number, input: unknown) =>
  Effect.flatMap(
    decode(DerivativeInput, "derivativeLimit", input),
    (settings) => execute("derivativeLimit", () => derivativeLimit(f, settings.x, settings))
  )

/**
 * Decodes a finite point and positive Ridder controls with excess properties
 * rejected, then captures callback failures in the typed error channel.
 *
 * @since 0.2.0
 * @category validated operations
 */
export const secondDerivativeLimitValidated = (f: (x: number) => number, input: unknown) =>
  Effect.flatMap(
    decode(SecondDerivativeInput, "secondDerivativeLimit", input),
    (settings) => execute("secondDerivativeLimit", () => secondDerivativeLimit(f, settings.x, settings))
  )

/**
 * Decodes first-derivative input and projects the selected value.
 *
 * @since 0.1.0
 * @category validated operations
 */
export const derivativeValidated = (f: (x: number) => number, input: unknown) =>
  Effect.map(derivativeLimitValidated(f, input), (estimate) => estimate.value)

/**
 * Decodes second-derivative input and projects the selected value.
 *
 * @since 0.2.0
 * @category validated operations
 */
export const secondDerivativeValidated = (f: (x: number) => number, input: unknown) =>
  Effect.map(secondDerivativeLimitValidated(f, input), (estimate) => estimate.value)

/**
 * Decodes a finite point and positive step with excess properties rejected,
 * then captures callback failures in the typed error channel.
 *
 * @since 0.1.0
 * @category validated operations
 */
export const complexStepValidated = (f: (z: Complex.Complex) => Complex.Complex, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(ComplexStepInput)(input, { onExcessProperty: "error" }).pipe(
      Effect.mapError((error) => new DecodeError({ operation: "complexStep", message: error.message }))
    )
    return yield* execute("complexStep", () => complexStep(f, decoded.x, decoded.h))
  })

/**
 * Decodes at least two finite samples and positive spacing, rejecting excess
 * properties before trapezoidal integration.
 *
 * @since 0.1.0
 * @category validated operations
 */
export const trapezoidValidated = (input: unknown) =>
  Effect.flatMap(
    decode(TrapezoidInput, "trapezoid", input),
    (settings) => execute("trapezoid", () => trapezoid(settings.values, settings.dx))
  )

/**
 * Decodes at least two finite samples and positive spacing, rejecting excess
 * properties. An odd final interval uses the trapezoidal rule.
 *
 * @since 0.1.0
 * @category validated operations
 */
export const simpsonValidated = (input: unknown) =>
  Effect.flatMap(
    decode(SimpsonInput, "simpson", input),
    (settings) => execute("simpson", () => simpson(settings.values, settings.dx))
  )

/**
 * Decodes finite bounds and positive adaptive controls, rejecting excess
 * properties and capturing callback failures. Depth exhaustion succeeds with
 * the current estimate and does not expose convergence metadata.
 *
 * @since 0.2.0
 * @category validated operations
 */
export const adaptiveSimpsonValidated = (f: (x: number) => number, input: unknown) =>
  Effect.flatMap(
    decode(AdaptiveSimpsonInput, "adaptiveSimpson", input),
    (settings) =>
      execute("adaptiveSimpson", () =>
        adaptiveSimpson(
          f,
          settings.a,
          settings.b,
          settings.absoluteTolerance,
          settings.relativeTolerance,
          settings.maxDepth
        ))
  )

/**
 * Decodes a non-empty finite point and positive Ridder controls, rejecting
 * excess properties and capturing callback failures.
 *
 * @since 0.2.0
 * @category validated operations
 */
export const gradientValidated = (f: (point: Chunk.Chunk<number>) => number, input: unknown) =>
  Effect.flatMap(
    decode(GradientInput, "gradient", input),
    (settings) => execute("gradient", () => gradient(f, settings.point, settings))
  )

/**
 * Decodes a non-empty finite point and positive Ridder controls, rejecting
 * excess properties and capturing vector-field callback failures.
 *
 * @since 0.2.0
 * @category validated operations
 */
export const jacobianValidated = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  input: unknown
) =>
  Effect.flatMap(
    decode(JacobianInput, "jacobian", input),
    (settings) => execute("jacobian", () => jacobian(f, settings.point, settings))
  )

/**
 * Decodes a non-empty finite point and positive Ridder controls, rejecting
 * excess properties and capturing scalar-surface callback failures.
 *
 * @since 0.2.0
 * @category validated operations
 */
export const hessianValidated = (f: (point: Chunk.Chunk<number>) => number, input: unknown) =>
  Effect.flatMap(
    decode(HessianInput, "hessian", input),
    (settings) => execute("hessian", () => hessian(f, settings.point, settings))
  )

/**
 * Decodes non-empty finite point and direction vectors and requires equal
 * dimensions. A zero direction passes decoding and produces `NaN`.
 *
 * @since 0.2.0
 * @category validated operations
 */
export const directionalDerivativeValidated = (
  f: (point: Chunk.Chunk<number>) => number,
  input: unknown
) =>
  Effect.gen(function*() {
    const settings = yield* decode(DirectionalDerivativeInput, "directionalDerivative", input)
    yield* ensureParameters(
      "directionalDerivative",
      Number.Equivalence(Chunk.size(settings.point), Chunk.size(settings.direction)),
      "Point and direction dimensions must match"
    )
    return yield* execute("directionalDerivative", () =>
      directionalDerivative(f, settings.point, settings.direction, settings))
  })

/**
 * Decodes a non-empty finite point and requires the field output dimension to
 * match it. The dimension check evaluates the field once before the numerical
 * kernel, so callers must provide a stable, side-effect-free function.
 *
 * @since 0.2.0
 * @category validated operations
 */
export const divergenceValidated = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  input: unknown
) =>
  Effect.gen(function*() {
    const settings = yield* decode(DivergenceInput, "divergence", input)
    const baseline = yield* execute("divergence", () => f(settings.point))
    yield* ensureParameters(
      "divergence",
      Number.Equivalence(Chunk.size(baseline), Chunk.size(settings.point)),
      "Vector-field output dimensions must match point dimensions"
    )
    return yield* execute("divergence", () => divergence(f, settings.point, settings))
  })

/**
 * Decodes a non-empty finite point and positive Ridder controls, rejecting
 * excess properties and capturing callback failures.
 *
 * @since 0.2.0
 * @category validated operations
 */
export const laplacianValidated = (f: (point: Chunk.Chunk<number>) => number, input: unknown) =>
  Effect.flatMap(
    decode(LaplacianInput, "laplacian", input),
    (settings) => execute("laplacian", () => laplacian(f, settings.point, settings))
  )

const estimateWithPolicies = (
  operation: string,
  computation: () => DerivativeLimitEstimate,
  annotations: (estimate: DerivativeLimitEstimate) => Record<string, string>
) =>
  execute(operation, computation).pipe(
    Effect.flatMap((estimate) =>
      PolicyGuard.custom({
        operation: String.concat("Calculus.", operation),
        compute: () => estimate,
        isValid: estimateIsFinite,
        makeError: (message) => new DomainViolationError({ operation, message }),
        annotations
      })
    )
  )

const scalarWithPolicies = (
  operation: string,
  computation: () => number,
  annotations: (value: number) => Record<string, string>
) =>
  execute(operation, computation).pipe(
    Effect.flatMap((result) =>
      PolicyGuard.scalar({
        operation: String.concat("Calculus.", operation),
        compute: () => result,
        makeError: (message) => new DomainViolationError({ operation, message }),
        annotations
      })
    )
  )

const vectorWithPolicies = (
  operation: string,
  computation: () => Chunk.Chunk<number>,
  annotations: (value: Chunk.Chunk<number>) => Record<string, string>
) =>
  execute(operation, computation).pipe(
    Effect.flatMap((result) =>
      PolicyGuard.custom({
        operation: String.concat("Calculus.", operation),
        compute: () => result,
        isValid: vectorIsFinite,
        makeError: (message) => new DomainViolationError({ operation, message }),
        annotations
      })
    )
  )

const matrixWithPolicies = (
  operation: string,
  computation: () => Chunk.Chunk<Chunk.Chunk<number>>,
  annotations: (value: Chunk.Chunk<Chunk.Chunk<number>>) => Record<string, string>
) =>
  execute(operation, computation).pipe(
    Effect.flatMap((result) =>
      PolicyGuard.custom({
        operation: String.concat("Calculus.", operation),
        compute: () => result,
        isValid: matrixIsFinite,
        makeError: (message) => new DomainViolationError({ operation, message }),
        annotations
      })
    )
  )

/**
 * Applies runtime policies to a first-derivative estimate. Strict precision
 * requires both the value and absolute-error estimate to be finite; it does
 * not require `converged` to be true. Callback exceptions become typed failures.
 *
 * @since 0.2.0
 * @category policy-aware operations
 */
export const derivativeLimitWithPolicies = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInput
) =>
  estimateWithPolicies(
    "derivativeLimitWithPolicies",
    () => derivativeLimit(f, x, config),
    (result) => ({
      x: encodeNumber(x),
      value: encodeNumber(result.value),
      absoluteError: encodeNumber(result.absoluteError),
      converged: encodeBoolean(result.converged)
    })
  )

/**
 * Applies runtime policies to a second-derivative estimate. Strict precision
 * requires both value and absolute error to be finite, without requiring
 * convergence; callback exceptions become typed failures.
 *
 * @since 0.2.0
 * @category policy-aware operations
 */
export const secondDerivativeLimitWithPolicies = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInput
) =>
  estimateWithPolicies(
    "secondDerivativeLimitWithPolicies",
    () => secondDerivativeLimit(f, x, config),
    (result) => ({
      x: encodeNumber(x),
      value: encodeNumber(result.value),
      absoluteError: encodeNumber(result.absoluteError),
      converged: encodeBoolean(result.converged)
    })
  )

/**
 * Applies runtime policies to the complete first-derivative estimate before
 * projecting its value, so strict precision also checks the absolute error.
 *
 * @since 0.1.0
 * @category policy-aware operations
 */
export const derivativeWithPolicies = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInput
) => Effect.map(derivativeLimitWithPolicies(f, x, config), (estimate) => estimate.value)

/**
 * Applies runtime policies to the complete second-derivative estimate before
 * projecting its value, so strict precision also checks the absolute error.
 *
 * @since 0.2.0
 * @category policy-aware operations
 */
export const secondDerivativeWithPolicies = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInput
) => Effect.map(secondDerivativeLimitWithPolicies(f, x, config), (estimate) => estimate.value)

/**
 * Applies runtime policies to complex-step differentiation. Strict precision
 * rejects non-finite results and callback exceptions become typed failures.
 *
 * @since 0.1.0
 * @category policy-aware operations
 */
export const complexStepWithPolicies = (
  f: (z: Complex.Complex) => Complex.Complex,
  x: number,
  h: number = 1e-20
) => scalarWithPolicies("complexStepWithPolicies", () => complexStep(f, x, h), () => ({ x: encodeNumber(x) }))

/**
 * Applies runtime policies to trapezoidal integration without validating
 * samples or spacing. Strict precision rejects a non-finite result.
 *
 * @since 0.1.0
 * @category policy-aware operations
 */
export const trapezoidWithPolicies = (values: Chunk.Chunk<number>, dx: number) =>
  scalarWithPolicies("trapezoidWithPolicies", () => trapezoid(values, dx), (result) => ({
    inputSize: encodeNumber(Chunk.size(values)),
    dx: encodeNumber(dx),
    result: encodeNumber(result)
  }))

/**
 * Applies runtime policies to Simpson integration without validating samples
 * or spacing. Strict precision rejects a non-finite result.
 *
 * @since 0.1.0
 * @category policy-aware operations
 */
export const simpsonWithPolicies = (values: Chunk.Chunk<number>, dx: number) =>
  scalarWithPolicies("simpsonWithPolicies", () => simpson(values, dx), (result) => ({
    inputSize: encodeNumber(Chunk.size(values)),
    dx: encodeNumber(dx),
    result: encodeNumber(result)
  }))

/**
 * Applies runtime policies to adaptive Simpson integration without validating
 * bounds or controls. Depth exhaustion succeeds when the result is finite.
 *
 * @since 0.2.0
 * @category policy-aware operations
 */
export const adaptiveSimpsonWithPolicies = (
  f: (x: number) => number,
  a: number,
  b: number,
  absoluteTolerance?: number,
  relativeTolerance?: number,
  maxDepth?: number
) =>
  scalarWithPolicies(
    "adaptiveSimpsonWithPolicies",
    () => adaptiveSimpson(f, a, b, absoluteTolerance, relativeTolerance, maxDepth),
    (result) => ({
      a: encodeNumber(a),
      b: encodeNumber(b),
      absoluteTolerance: encodeNumber(Option.getOrElse(Option.fromNullable(absoluteTolerance), () => 1e-10)),
      relativeTolerance: encodeNumber(Option.getOrElse(Option.fromNullable(relativeTolerance), () => 1e-10)),
      maxDepth: encodeNumber(Option.getOrElse(Option.fromNullable(maxDepth), () => 16)),
      result: encodeNumber(result)
    })
  )

/**
 * Applies runtime policies to every gradient component. Strict precision
 * accepts an empty vector because it contains no non-finite component.
 *
 * @since 0.2.0
 * @category policy-aware operations
 */
export const gradientWithPolicies = (
  f: (point: Chunk.Chunk<number>) => number,
  at: Chunk.Chunk<number>,
  config?: RidderMethodInput
) =>
  vectorWithPolicies("gradientWithPolicies", () => gradient(f, at, config), (result) => ({
    dimensions: encodeNumber(Chunk.size(at)),
    resultDimensions: encodeNumber(Chunk.size(result))
  }))

/**
 * Applies runtime policies to every Jacobian entry. Callback exceptions become
 * typed failures before strict precision examines the matrix.
 *
 * @since 0.2.0
 * @category policy-aware operations
 */
export const jacobianWithPolicies = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  at: Chunk.Chunk<number>,
  config?: RidderMethodInput
) =>
  matrixWithPolicies("jacobianWithPolicies", () => jacobian(f, at, config), (result) => ({
    inputDimensions: encodeNumber(Chunk.size(at)),
    outputDimensions: encodeNumber(Chunk.size(result))
  }))

/**
 * Applies runtime policies to every Hessian entry. Callback exceptions become
 * typed failures before strict precision examines the matrix.
 *
 * @since 0.2.0
 * @category policy-aware operations
 */
export const hessianWithPolicies = (
  f: (point: Chunk.Chunk<number>) => number,
  at: Chunk.Chunk<number>,
  config?: RidderMethodInput
) =>
  matrixWithPolicies("hessianWithPolicies", () => hessian(f, at, config), (result) => ({
    dimensions: encodeNumber(Chunk.size(result))
  }))

/**
 * Applies runtime policies to directional differentiation. Unequal dimensions
 * and zero directions produce `NaN`, rejected by strict precision and returned
 * by relaxed precision.
 *
 * @since 0.2.0
 * @category policy-aware operations
 */
export const directionalDerivativeWithPolicies = (
  f: (point: Chunk.Chunk<number>) => number,
  at: Chunk.Chunk<number>,
  direction: Chunk.Chunk<number>,
  config?: RidderMethodInput
) =>
  scalarWithPolicies(
    "directionalDerivativeWithPolicies",
    () => directionalDerivative(f, at, direction, config),
    (result) => ({ dimensions: encodeNumber(Chunk.size(at)), result: encodeNumber(result) })
  )

/**
 * Applies runtime policies to divergence. A field dimension mismatch produces
 * `NaN`, rejected by strict precision and returned by relaxed precision.
 *
 * @since 0.2.0
 * @category policy-aware operations
 */
export const divergenceWithPolicies = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  at: Chunk.Chunk<number>,
  config?: RidderMethodInput
) =>
  scalarWithPolicies("divergenceWithPolicies", () => divergence(f, at, config), (result) => ({
    dimensions: encodeNumber(Chunk.size(at)),
    result: encodeNumber(result)
  }))

/**
 * Applies runtime policies to Laplacian estimation. Strict precision rejects
 * a non-finite trace and callback exceptions become typed failures.
 *
 * @since 0.2.0
 * @category policy-aware operations
 */
export const laplacianWithPolicies = (
  f: (point: Chunk.Chunk<number>) => number,
  at: Chunk.Chunk<number>,
  config?: RidderMethodInput
) =>
  scalarWithPolicies("laplacianWithPolicies", () => laplacian(f, at, config), (result) => ({
    dimensions: encodeNumber(Chunk.size(at)),
    result: encodeNumber(result)
  }))
