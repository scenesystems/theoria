/**
 * Optimization domain operations — pure kernel re-exports,
 * Schema-validated boundary variants, and policy-aware operations
 * reading `PrecisionPolicyService` and `DiagnosticsPolicyService`.
 *
 * @since 0.1.0
 * @category operations
 */
import { Effect, Match, Option, Schema } from "effect"

import { derivative as finiteDifferenceDerivative } from "../Calculus/operations/pure.js"
import { AutodiffAuthorityLive, resolveAutodiffMode } from "../contracts/shared/AutodiffAuthority.js"
import {
  type ComputationDispatchPlanType,
  planComputationFromAuthorities
} from "../contracts/shared/ComputationDispatch.js"
import { withCustomPolicyGuards, withScalarPolicyGuards } from "../contracts/shared/PolicyGuards.js"
import { PrecisionEscalationLive } from "../contracts/shared/PrecisionEscalation.js"
import { ScalarAuthorityLive } from "../contracts/shared/ScalarAuthority.js"
import {
  OptimizationConvergenceError,
  OptimizationDecodeError,
  OptimizationDerivativeAuthorityError,
  OptimizationDomainViolationError,
  OptimizationParameterError
} from "./errors.js"
import * as Bisect from "./internal/bisect.js"
import * as Brent from "./internal/brent.js"
import * as GoldenSection from "./internal/goldenSection.js"
import * as NewtonRaphson from "./internal/newtonRaphson.js"
import * as Secant from "./internal/secant.js"
import { OptimizationDomainModel } from "./model.js"
import {
  BisectInput,
  type BrentInputType,
  GoldenSectionInput,
  type NewtonRaphsonInputType,
  RootFindingInput,
  type RootFindingInputType,
  type RootFindingResultType,
  type SecantInputType
} from "./schema.js"

/**
 * Lifts the static `OptimizationDomainModel` into an Effect so it can be
 * composed in pipelines that discover available domains at startup.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadOptimizationDomain = Effect.succeed(OptimizationDomainModel)

// ---------------------------------------------------------------------------
// Pure kernel re-exports
// ---------------------------------------------------------------------------

/**
 * Bisection method root-finding. Finds x where f(x) ≈ 0 in [a, b],
 * assuming f(a) and f(b) have opposite signs. Uses recursive tail-call
 * style with configurable tolerance and iteration budget.
 *
 * @example
 * ```ts
 * import { Optimization } from "effect-math"
 *
 * Optimization.bisect((x) => x * x - 2, 0, 2) // ≈ √2 ≈ 1.41421
 * ```
 *
 * @see {@link bisectValidated} — boundary-validated variant
 * @see {@link bisectWithPolicies} — policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const bisect: (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance?: number,
  maxIterations?: number
) => number = Bisect.bisectKernel

/**
 * Golden section search for 1D minimization. Uses the golden ratio
 * φ = (√5 − 1) / 2 to progressively narrow the bracket containing
 * the minimum.
 *
 * @example
 * ```ts
 * import { Optimization } from "effect-math"
 *
 * Optimization.goldenSection((x) => x * x, -2, 2) // ≈ 0
 * ```
 *
 * @see {@link goldenSectionValidated} — boundary-validated variant
 * @see {@link goldenSectionWithPolicies} — policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const goldenSection: (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance?: number,
  maxIterations?: number
) => number = GoldenSection.goldenSectionKernel

type RootFindingConvergenceOptions = Readonly<{
  readonly absoluteTolerance?: number
  readonly relativeTolerance?: number
  readonly maxIterations?: number
}>

type RootFindingDerivativeOptions = Readonly<{
  readonly derivative?: (x: number) => number
}>

type NewtonRaphsonOptions = RootFindingConvergenceOptions & RootFindingDerivativeOptions

const rootFindingOptions = (options?: RootFindingConvergenceOptions) => ({
  ...Option.match(Option.fromNullable(options?.absoluteTolerance), {
    onNone: () => ({}),
    onSome: (absoluteTolerance) => ({ absoluteTolerance })
  }),
  ...Option.match(Option.fromNullable(options?.relativeTolerance), {
    onNone: () => ({}),
    onSome: (relativeTolerance) => ({ relativeTolerance })
  }),
  ...Option.match(Option.fromNullable(options?.maxIterations), {
    onNone: () => ({}),
    onSome: (maxIterations) => ({ maxIterations })
  })
})

const makeBrentInput = (
  lowerBound: number,
  upperBound: number,
  options?: RootFindingConvergenceOptions
): BrentInputType => ({
  method: "brent",
  lowerBound,
  upperBound,
  ...rootFindingOptions(options)
})

const makeSecantInput = (
  previousEstimate: number,
  currentEstimate: number,
  options?: RootFindingConvergenceOptions
): SecantInputType => ({
  method: "secant",
  previousEstimate,
  currentEstimate,
  ...rootFindingOptions(options)
})

const makeNewtonRaphsonInput = (
  initialGuess: number,
  options?: RootFindingConvergenceOptions
): NewtonRaphsonInputType => ({
  method: "newtonRaphson",
  initialGuess,
  ...rootFindingOptions(options)
})

const fallbackDerivative = (
  f: (x: number) => number,
  options?: RootFindingDerivativeOptions
): (x: number) => number =>
  Option.getOrElse(
    Option.fromNullable(options?.derivative),
    () => (estimate: number) => finiteDifferenceDerivative(f, estimate)
  )

/**
 * Canonical nonlinear root-finding envelope shared by Brent, secant,
 * and Newton-Raphson.
 *
 * When Newton-Raphson does not receive an explicit derivative function,
 * it falls back to the released finite-difference derivative authority in
 * `effect-math/Calculus`.
 *
 * @since 0.3.0
 * @category operations
 */
export const findRoot = (
  f: (x: number) => number,
  input: RootFindingInputType,
  options?: RootFindingDerivativeOptions
): RootFindingResultType =>
  Match.value(input).pipe(
    Match.when({ method: "brent" }, (value: BrentInputType) => Brent.solveBrent(f, value)),
    Match.when({ method: "secant" }, (value: SecantInputType) => Secant.solveSecant(f, value)),
    Match.when({ method: "newtonRaphson" }, (value: NewtonRaphsonInputType) =>
      NewtonRaphson.solveNewtonRaphson(f, fallbackDerivative(f, options), value)),
    Match.exhaustive
  )

/**
 * Brent-style bracketed root finding over the canonical result envelope.
 *
 * Use this when the objective can supply a sign-changing bracket and you want
 * the released bracketed solver directly rather than dispatching through the
 * method union.
 *
 * @since 0.3.0
 * @category operations
 */
export const brent = (
  f: (x: number) => number,
  lowerBound: number,
  upperBound: number,
  options?: RootFindingConvergenceOptions
): RootFindingResultType => findRoot(f, makeBrentInput(lowerBound, upperBound, options))

/**
 * Secant root finding over the canonical result envelope.
 *
 * Use this when two distinct initial estimates are available and you want the
 * released derivative-free open solver directly.
 *
 * @since 0.3.0
 * @category operations
 */
export const secant = (
  f: (x: number) => number,
  previousEstimate: number,
  currentEstimate: number,
  options?: RootFindingConvergenceOptions
): RootFindingResultType => findRoot(f, makeSecantInput(previousEstimate, currentEstimate, options))

/**
 * Newton-Raphson root finding over the canonical result envelope.
 *
 * When no derivative function is supplied, the pure kernel falls back to the
 * released finite-difference derivative from `effect-math/Calculus`.
 *
 * @since 0.3.0
 * @category operations
 */
export const newtonRaphson = (
  f: (x: number) => number,
  initialGuess: number,
  options?: NewtonRaphsonOptions
): RootFindingResultType => findRoot(f, makeNewtonRaphsonInput(initialGuess, options), options)

const decodeRootFindingInput = (input: unknown) =>
  Schema.decodeUnknown(RootFindingInput)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.mapError((error) =>
      new OptimizationDecodeError({
        operation: "findRoot",
        message: error.message
      })
    )
  )

const resolveDerivative = (
  f: (x: number) => number,
  options?: RootFindingDerivativeOptions,
  operation: "findRootValidated" | "findRootWithPolicies" = "findRootValidated"
) =>
  Option.fromNullable(options?.derivative).pipe(
    Option.match({
      onNone: () =>
        resolveAutodiffMode({
          operation: `Optimization.${operation}`
        }).pipe(
          Effect.mapError((error) =>
            new OptimizationDerivativeAuthorityError({
              operation,
              message: error.message
            })
          ),
          Effect.as((estimate: number) => finiteDifferenceDerivative(f, estimate))
        ),
      onSome: Effect.succeed
    })
  )

const ensureRootFindingInput = (input: RootFindingInputType) =>
  Match.value(input).pipe(
    Match.when({ method: "brent" }, (value) =>
      Effect.succeed(value).pipe(
        Effect.filterOrFail(
          ({ lowerBound, upperBound }) => lowerBound < upperBound,
          () =>
            new OptimizationParameterError({
              operation: "findRootValidated",
              message: "Expected lowerBound to be less than upperBound for Brent root finding"
            })
        ),
        Effect.asVoid
      )),
    Match.when({ method: "secant" }, (value) =>
      Effect.succeed(value).pipe(
        Effect.filterOrFail(
          ({ previousEstimate, currentEstimate }) => previousEstimate !== currentEstimate,
          () =>
            new OptimizationParameterError({
              operation: "findRootValidated",
              message: "Expected distinct starting estimates for the secant method"
            })
        ),
        Effect.asVoid
      )),
    Match.when({ method: "newtonRaphson" }, () => Effect.void),
    Match.exhaustive
  )

const liftRootFindingResult = (result: RootFindingResultType) =>
  Match.value(result.status).pipe(
    Match.when("converged", () => Effect.succeed(result)),
    Match.when("invalidBracket", () =>
      Effect.fail(
        new OptimizationParameterError({
          operation: result.method,
          message: "Expected a bracket whose endpoint values straddle a sign change"
        })
      )),
    Match.when("zeroDerivative", () =>
      Effect.fail(
        new OptimizationDerivativeAuthorityError({
          operation: result.method,
          message: "Encountered a zero or numerically singular derivative during root finding"
        })
      )),
    Match.when("maxIterationsExceeded", () =>
      Effect.fail(
        new OptimizationConvergenceError({
          operation: result.method,
          message: "Root-finding iteration budget exhausted before the declared tolerance envelope was satisfied",
          iterations: result.iterationCount
        })
      )),
    Match.exhaustive
  )

const executeValidatedRootFinding = (
  f: (x: number) => number,
  input: RootFindingInputType,
  options?: RootFindingDerivativeOptions,
  operation: "findRootValidated" | "findRootWithPolicies" = "findRootValidated"
) =>
  Effect.gen(function*() {
    yield* ensureRootFindingInput(input)

    const derivative = yield* Match.value(input.method).pipe(
      Match.when("newtonRaphson", () => resolveDerivative(f, options, operation)),
      Match.orElse(() => Effect.succeed<(x: number) => number>((estimate) => estimate))
    )

    const result = yield* Effect.sync(() =>
      Match.value(input.method).pipe(
        Match.when("newtonRaphson", () => findRoot(f, input, { derivative })),
        Match.orElse(() => findRoot(f, input, options))
      )
    )

    return yield* liftRootFindingResult(result)
  })

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

/**
 * Boundary-validated bisect. Accepts a function and `unknown` input,
 * decodes through `BisectInput` with `onExcessProperty: "error"`, and
 * returns the root.
 *
 * @see {@link bisect} — pure kernel for pre-validated input
 * @since 0.1.0
 * @category validated operations
 */
export const bisectValidated = (f: (x: number) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(BisectInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new OptimizationDecodeError({
          operation: "bisect",
          message: error.message
        })
      )
    )
    return Bisect.bisectKernel(f, decoded.a, decoded.b, decoded.tolerance, decoded.maxIterations)
  })

/**
 * Boundary-validated golden section search. Accepts a function and
 * `unknown` input, decodes through `GoldenSectionInput` with
 * `onExcessProperty: "error"`, and returns the minimizer.
 *
 * @see {@link goldenSection} — pure kernel for pre-validated input
 * @since 0.1.0
 * @category validated operations
 */
export const goldenSectionValidated = (f: (x: number) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(GoldenSectionInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new OptimizationDecodeError({
          operation: "goldenSection",
          message: error.message
        })
      )
    )
    return GoldenSection.goldenSectionKernel(f, decoded.a, decoded.b, decoded.tolerance, decoded.maxIterations)
  })

/**
 * Schema-decoded nonlinear root-finding boundary over the canonical
 * result envelope.
 *
 * When Newton-Raphson omits an explicit derivative function, this boundary
 * consults the shared autodiff authority before falling back to the
 * released finite-difference derivative surface.
 *
 * @since 0.3.0
 * @category validated operations
 */
export const findRootValidated = (
  f: (x: number) => number,
  input: unknown,
  options?: RootFindingDerivativeOptions
) =>
  Effect.gen(function*() {
    const decoded = yield* decodeRootFindingInput(input)

    return yield* executeValidatedRootFinding(f, decoded, options)
  })

const optimizationDispatchPlan = (operation: string, requiresAutodiff: boolean) =>
  planComputationFromAuthorities({
    operationCategory: "optimization",
    operationName: `Optimization.${operation}`,
    escalationAttempt: 0,
    requiresAutodiff,
    requiresUncertaintyEnvelope: false
  }).pipe(
    Effect.provide(AutodiffAuthorityLive),
    Effect.provide(PrecisionEscalationLive),
    Effect.provide(ScalarAuthorityLive)
  )

const dispatchAnnotations = (plan: ComputationDispatchPlanType): Record<string, string> => ({
  backend: plan.backendKind,
  scalarKind: plan.scalarKind,
  scalarResolution: plan.scalarResolutionSource,
  differentiationMethod: plan.differentiationMethod,
  autodiffMode: String(plan.autodiffMode ?? "none"),
  finiteDifferenceFallback: String(plan.finiteDifferenceFallback),
  escalated: String(plan.escalated),
  convergenceSatisfied: String(plan.convergenceSatisfied)
})

const rootFindingResultIsFinite = (result: RootFindingResultType): boolean =>
  Number.isFinite(result.root) && Number.isFinite(result.residual)

const requiresAutodiffAuthority = (input: RootFindingInputType, options?: RootFindingDerivativeOptions): boolean =>
  Match.value(input.method).pipe(
    Match.when("newtonRaphson", () => Option.isNone(Option.fromNullable(options?.derivative))),
    Match.orElse(() => false)
  )

/**
 * Policy-aware nonlinear root finding over the canonical result envelope.
 *
 * The policy-aware surface resolves one optimization dispatch plan before it
 * evaluates the validated solver path, so backend choice and autodiff
 * availability remain package-owned runtime decisions rather than a domain-
 * local fork.
 *
 * @since 0.3.0
 * @category operations
 */
export const findRootWithPolicies = (
  f: (x: number) => number,
  input: RootFindingInputType,
  options?: RootFindingDerivativeOptions
) =>
  Effect.gen(function*() {
    const plan = yield* optimizationDispatchPlan("findRootWithPolicies", requiresAutodiffAuthority(input, options))
    const result = yield* executeValidatedRootFinding(f, input, options, "findRootWithPolicies").pipe(
      Effect.provide(AutodiffAuthorityLive)
    )

    return yield* withCustomPolicyGuards({
      operation: "Optimization.findRootWithPolicies",
      compute: () => result,
      isValid: rootFindingResultIsFinite,
      makeError: (message) =>
        new OptimizationDomainViolationError({
          operation: "findRootWithPolicies",
          message
        }),
      annotations: (value) => ({
        ...dispatchAnnotations(plan),
        method: value.method,
        status: value.status,
        iterations: String(value.iterationCount),
        functionEvaluations: String(value.functionEvaluationCount),
        residual: String(value.residual)
      })
    })
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Policy-aware bisect reading two services from context:
 *
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `OptimizationDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input, result, precision, and elapsed-ms annotations.
 *
 * @example
 * ```ts
 * import { Optimization } from "effect-math"
 * import { Effect, Layer } from "effect"
 * import {
 *   DiagnosticsPolicyService,
 *   PrecisionPolicyService
 * } from "effect-math/contracts"
 *
 * const layer = Layer.mergeAll(
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * const fn = (x: number) => x * x - 2
 * const program = Optimization.bisectWithPolicies(fn, 0, 2).pipe(
 *   Effect.provide(layer)
 * )
 * ```
 *
 * @see {@link bisect} — pure kernel without policy seams
 * @see {@link bisectValidated} — boundary-validated variant
 * @since 0.1.0
 * @category operations
 */
export const bisectWithPolicies = (f: (x: number) => number, a: number, b: number) =>
  withScalarPolicyGuards({
    operation: "Optimization.bisectWithPolicies",
    compute: () => Bisect.bisectKernel(f, a, b),
    makeError: (message) => new OptimizationDomainViolationError({ operation: "bisectWithPolicies", message }),
    annotations: (result) => ({ input: `a=${a}, b=${b}`, result: String(result) })
  })

/**
 * Policy-aware golden section search reading two services from context:
 *
 * - **`PrecisionPolicyService`** — `"strict"` rejects non-finite results
 *   with `OptimizationDomainViolationError`; `"relaxed"` passes them through.
 * - **`DiagnosticsPolicyService`** — `"enabled"` emits `Effect.logDebug`
 *   with input, result, precision, and elapsed-ms annotations.
 *
 * @see {@link goldenSection} — pure kernel without policy seams
 * @see {@link goldenSectionValidated} — boundary-validated variant
 * @since 0.1.0
 * @category operations
 */
export const goldenSectionWithPolicies = (f: (x: number) => number, a: number, b: number) =>
  withScalarPolicyGuards({
    operation: "Optimization.goldenSectionWithPolicies",
    compute: () => GoldenSection.goldenSectionKernel(f, a, b),
    makeError: (message) => new OptimizationDomainViolationError({ operation: "goldenSectionWithPolicies", message }),
    annotations: (result) => ({ input: `a=${a}, b=${b}`, result: String(result) })
  })
