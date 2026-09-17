/**
 * One-dimensional root finding and scalar minimization.
 *
 * @since 0.1.0
 * @module
 */
import { Array, Effect, Inspectable, Match, Predicate, Schema } from "effect"

import * as Bisect from "./internal/optimization/bisect.js"
import * as GoldenSection from "./internal/optimization/goldenSection.js"
import * as PolicyGuard from "./internal/policyGuard.js"
import * as Numeric from "./Numeric.js"

const encodeNumber = Schema.encodeSync(Schema.NumberFromString)

/**
 * Accepts finite bisection endpoints and optional positive stopping controls.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BisectInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.finite()),
  b: Schema.Number.pipe(Schema.finite()),
  tolerance: Schema.optional(Numeric.AbsoluteTolerance),
  maxIterations: Schema.optional(Numeric.IterationBudget)
}).annotations({ identifier: "@scenesystems/effect-math/Optimization/BisectInput" })

/**
 * Bisection boundary input.
 *
 * @since 0.1.0
 * @category models
 */
export type BisectInput = typeof BisectInput.Type

/**
 * Accepts finite golden-section endpoints and optional positive stopping controls.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GoldenSectionInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.finite()),
  b: Schema.Number.pipe(Schema.finite()),
  tolerance: Schema.optional(Numeric.AbsoluteTolerance),
  maxIterations: Schema.optional(Numeric.IterationBudget)
}).annotations({ identifier: "@scenesystems/effect-math/Optimization/GoldenSectionInput" })

/**
 * Golden-section boundary input.
 *
 * @since 0.1.0
 * @category models
 */
export type GoldenSectionInput = typeof GoldenSectionInput.Type

/**
 * Reports malformed settings supplied to a validated solver.
 *
 * @since 0.1.0
 * @category errors
 */
export class DecodeError extends Schema.TaggedError<DecodeError>()("OptimizationDecodeError", {
  /** Solver whose settings failed decoding. */
  operation: Schema.String,
  /** Effect Schema issue report. */
  message: Schema.String
}) {}

/**
 * Reports a non-finite estimate rejected by strict precision.
 *
 * @since 0.1.0
 * @category errors
 */
export class DomainViolationError
  extends Schema.TaggedError<DomainViolationError>()("OptimizationDomainViolationError", {
    /** Policy-aware solver that produced the result. */
    operation: Schema.String,
    /** Diagnostic describing the rejected result. */
    message: Schema.String
  })
{}

/**
 * Failures emitted by validated and policy-aware solvers.
 *
 * @since 0.1.0
 * @category errors
 */
export type OperationError = DecodeError | DomainViolationError | Numeric.ExecutionError

const formatExecutionError = (error: unknown): string =>
  Match.value(error).pipe(
    Match.when(Predicate.isError, (cause) => cause.message),
    Match.orElse((cause) => Inspectable.toStringUnknown(cause, 0))
  )

const execute = (operation: string, computation: () => number) =>
  Effect.try({
    try: computation,
    catch: (error) => new Numeric.ExecutionError({ operation, message: formatExecutionError(error) })
  })

const decode = <A, I, R>(schema: Schema.Schema<A, I, R>, operation: string, input: unknown) =>
  Schema.decodeUnknown(schema)(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError((error) => new DecodeError({ operation, message: error.message }))
  )

/**
 * Approximates a root by repeatedly halving a sign-changing bracket.
 *
 * @remarks
 * Endpoint signs and ordering are not checked. The search returns the current
 * midpoint when the bracket width is below `tolerance` or `maxIterations` is
 * reached. Defaults are `1e-12` and `100`; callback exceptions escape.
 *
 * @param f - Synchronous function whose root is bracketed.
 * @param a - First bracket endpoint; ordering is not validated.
 * @param b - Second bracket endpoint; ordering is not validated.
 * @param tolerance - Positive target width; the trusted operation does not validate it.
 * @param maxIterations - Maximum halvings; the trusted operation does not validate it.
 * @returns The final bracket midpoint; exhaustion is not reported separately.
 * @since 0.1.0
 * @category operations
 */
export const bisect = (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance?: number,
  maxIterations?: number
): number => Bisect.bisect(f, a, b, tolerance, maxIterations)

/**
 * Approximates the minimizer of a unimodal scalar function by golden-section reduction.
 *
 * @remarks
 * Endpoint ordering and unimodality are caller preconditions. The current
 * midpoint is returned when the width target or iteration budget is reached.
 * Defaults are `1e-12` and `100`; callback exceptions escape.
 *
 * @param f - Synchronous objective function.
 * @param a - First search endpoint; ordering is not validated.
 * @param b - Second search endpoint; ordering is not validated.
 * @param tolerance - Positive target width; the trusted operation does not validate it.
 * @param maxIterations - Maximum reductions; the trusted operation does not validate it.
 * @returns The final search-interval midpoint rather than the objective value.
 * @since 0.1.0
 * @category operations
 */
export const goldenSection = (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance?: number,
  maxIterations?: number
): number => GoldenSection.goldenSection(f, a, b, tolerance, maxIterations)

/**
 * Decodes bisection settings and captures callback failures.
 *
 * @remarks
 * Excess properties are rejected. Sign-changing and endpoint-ordering
 * preconditions remain with the caller. Iteration exhaustion succeeds with
 * the current midpoint.
 *
 * @throws {@link OptimizationDecodeError} for malformed settings.
 * @throws {@link KernelExecutionError} when the callback fails synchronously.
 * @since 0.1.0
 * @category validated operations
 */
export const bisectValidated = (f: (x: number) => number, input: unknown) =>
  Effect.flatMap(
    decode(BisectInput, "bisect", input),
    (settings) =>
      execute("bisect", () => Bisect.bisect(f, settings.a, settings.b, settings.tolerance, settings.maxIterations))
  )

/**
 * Decodes golden-section settings and captures callback failures.
 *
 * @remarks
 * Excess properties are rejected. Endpoint ordering and unimodality remain
 * caller preconditions. Iteration exhaustion succeeds with the current midpoint.
 *
 * @throws {@link OptimizationDecodeError} for malformed settings.
 * @throws {@link KernelExecutionError} when the callback fails synchronously.
 * @since 0.1.0
 * @category validated operations
 */
export const goldenSectionValidated = (f: (x: number) => number, input: unknown) =>
  Effect.flatMap(
    decode(GoldenSectionInput, "goldenSection", input),
    (settings) =>
      execute("goldenSection", () =>
        GoldenSection.goldenSection(f, settings.a, settings.b, settings.tolerance, settings.maxIterations))
  )

/**
 * Runs bisection with default stopping controls under precision and diagnostic policies.
 *
 * @remarks
 * Strict precision rejects a non-finite midpoint; relaxed precision returns it.
 * Diagnostics include the bracket and result. Bracketing and endpoint ordering
 * are not validated, and callback failures enter the typed error channel.
 *
 * @since 0.1.0
 * @category policy-aware operations
 */
export const bisectWithPolicies = (f: (x: number) => number, a: number, b: number) =>
  execute("bisectWithPolicies", () => Bisect.bisect(f, a, b)).pipe(
    Effect.flatMap((result) =>
      PolicyGuard.scalar({
        operation: "Optimization.bisectWithPolicies",
        compute: () => result,
        makeError: (message) => new DomainViolationError({ operation: "bisectWithPolicies", message }),
        annotations: (value) => ({
          input: Array.join(Array.make("a=", encodeNumber(a), ", b=", encodeNumber(b)), ""),
          result: encodeNumber(value)
        })
      })
    )
  )

/**
 * Runs golden-section search with default controls under precision and diagnostic policies.
 *
 * @remarks
 * Strict precision rejects a non-finite midpoint; relaxed precision returns it.
 * Diagnostics include the interval and result. Endpoint ordering and unimodality
 * are not validated, and callback failures enter the typed error channel.
 *
 * @since 0.1.0
 * @category policy-aware operations
 */
export const goldenSectionWithPolicies = (f: (x: number) => number, a: number, b: number) =>
  execute("goldenSectionWithPolicies", () => GoldenSection.goldenSection(f, a, b)).pipe(
    Effect.flatMap((result) =>
      PolicyGuard.scalar({
        operation: "Optimization.goldenSectionWithPolicies",
        compute: () => result,
        makeError: (message) => new DomainViolationError({ operation: "goldenSectionWithPolicies", message }),
        annotations: (value) => ({
          input: Array.join(Array.make("a=", encodeNumber(a), ", b=", encodeNumber(b)), ""),
          result: encodeNumber(value)
        })
      })
    )
  )
