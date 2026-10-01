/**
 * Plans scalar, backend, differentiation, and uncertainty metadata.
 *
 * Planning selects labels and provenance; it does not execute a numerical kernel.
 *
 * @since 0.1.0
 * @module
 */
import { Context, Data, Effect, Layer, Match, Option, Schema } from "effect"

import * as Autodiff from "./Autodiff.js"
import * as Backend from "./Backend.js"
import * as Policy from "./Policy.js"
import * as Precision from "./Precision.js"
import * as Scalar from "./Scalar.js"

const DifferentiationMethod = Schema.Union(Schema.Literal("none"), Autodiff.Method)
const NoAutodiffResolution = Schema.Struct({
  method: Schema.Literal("none"),
  mode: Schema.OptionFromSelf(Autodiff.Mode),
  usedFiniteDifferenceFallback: Schema.Literal(false)
})
const noAutodiffResolution = Schema.decodeUnknownSync(NoAutodiffResolution)({
  method: "none",
  mode: Option.none(),
  usedFiniteDifferenceFallback: false
})

/**
 * Accepts operation preferences, convergence state, and output requirements.
 *
 * `operationName` is diagnostic metadata. `escalationAttempt` is required even
 * without a convergence observation. Backend preference affects diagnostics,
 * not policy order. Autodiff preference is ignored unless autodiff is required,
 * and the uncertainty flag is copied to the plan. This schema describes
 * planning input and does not authorize execution of a numerical kernel.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Request = Schema.Struct({
  operationCategory: Scalar.OperationCategory,
  operationName: Schema.String,
  requestedScalarKind: Schema.optional(Scalar.Kind),
  preferredBackend: Schema.optional(Backend.Kind),
  preferredAutodiff: Schema.optional(Autodiff.Mode),
  escalationAttempt: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  convergence: Schema.optional(Precision.ConvergenceObservation),
  requiresAutodiff: Schema.Boolean,
  requiresUncertaintyEnvelope: Schema.Boolean
}).annotations({ identifier: "@scenesystems/effect-math/Computation/Request" })

/**
 * A decoded computation planning request.
 *
 * @since 0.1.0
 * @category models
 */
export type Request = typeof Request.Type

/**
 * Accepts selected planning lanes and decision provenance.
 *
 * The schema validates each field independently. It does not couple the
 * differentiation method to its optional mode or fallback flag, nor escalation
 * to convergence. {@link planWithAuthorities} establishes those relationships.
 * Decoding represents an absent autodiff mode as `Option.none()`; encoding
 * omits that field. A plan is metadata and does not contain an executable
 * kernel or an uncertainty envelope.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Plan = Schema.Struct({
  scalarKind: Scalar.Kind,
  scalarResolutionSource: Scalar.ResolutionSource,
  precisionEscalationSource: Precision.ResolutionSource,
  backendKind: Backend.Kind,
  autodiffMode: Schema.optionalWith(Autodiff.Mode, { as: "Option" }),
  differentiationMethod: DifferentiationMethod,
  finiteDifferenceFallback: Schema.Boolean,
  escalated: Schema.Boolean,
  convergenceSatisfied: Schema.Boolean,
  uncertaintyEnvelope: Schema.Boolean
}).annotations({ identifier: "@scenesystems/effect-math/Computation/Plan" })

/**
 * A decoded computation plan containing selected labels and provenance.
 *
 * @since 0.1.0
 * @category models
 */
export type Plan = typeof Plan.Type

/**
 * Reports that an untrusted computation request failed decoding.
 *
 * The operation is the stable request boundary because an untrusted operation
 * name cannot be used before decoding; the message is Effect Schema's issue
 * report.
 *
 * @since 0.1.0
 * @category errors
 */
export class DecodeError extends Schema.TaggedError<DecodeError>(
  "@scenesystems/effect-math/Computation/DecodeError"
)("ComputationDispatchDecodeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Failures produced while decoding or planning a computation.
 *
 * No execution failure appears because planning does not invoke a kernel.
 *
 * @since 0.1.0
 * @category errors
 */
export type PlanningError =
  | Scalar.UnsupportedError
  | Precision.EscalationExhaustedError
  | Backend.UnavailableError
  | Autodiff.UnavailableError
  | DecodeError

/**
 * Services required by authority-based planning.
 *
 * The requirements supply scalar capability, precision escalation, backend
 * policy, and autodiff capability metadata. They are read when a planner's
 * Effect executes, not captured by constructing {@link Planner}.
 *
 * @since 0.1.0
 * @category services
 */
export type Requirements = Scalar.Scalar | Precision.Precision | Policy.Backend | Autodiff.Autodiff

/**
 * Describes a computation planner implementation as an Effect-native capability.
 *
 * `plan` receives an already decoded request and returns an Effect that still
 * requires {@link Requirements}. The callback preserves Context dependencies;
 * it does not recreate dependency injection, capture execution resources, or
 * execute a numerical kernel.
 *
 * @since 0.1.0
 * @category models
 */
export class Planner extends Data.Class<{
  readonly plan: (request: Request) => Effect.Effect<Plan, PlanningError, Requirements>
}> {}

/**
 * Supplies a computation planner through the Effect Context.
 *
 * The service contains only a planning callback. Supplying it does not satisfy
 * that callback's {@link Requirements} or allocate execution resources.
 *
 * @since 0.1.0
 * @category services
 */
export class Computation extends Context.Tag("@scenesystems/effect-math/Computation")<Computation, Planner>() {}

const decodeRequest = (input: unknown) =>
  Schema.decodeUnknown(Request)(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError(
      (error) =>
        new DecodeError({
          operation: "ComputationDispatchRequest",
          message: error.message
        })
    )
  )

/**
 * Builds a plan from an already decoded request and configured authorities.
 *
 * Scalar selection runs first, followed by optional convergence escalation and
 * an enforced scalar-capability recheck. Missing convergence is recorded as
 * satisfied. Runtime backend policy remains authoritative over the diagnostic
 * backend preference. Autodiff resolves only when required, and the uncertainty
 * requirement is copied unchanged. The result contains labels and provenance;
 * no backend, differentiation engine, uncertainty envelope, or numerical kernel
 * is constructed or executed.
 *
 * @since 0.1.0
 * @category planning
 */
export const planWithAuthorities = (request: Request) =>
  Effect.gen(function*() {
    const initialScalar = yield* Option.match(Option.fromNullable(request.requestedScalarKind), {
      onNone: () =>
        Scalar.resolve({
          operation: request.operationName,
          operationCategory: request.operationCategory
        }),
      onSome: (requestedKind) =>
        Scalar.resolve({
          operation: request.operationName,
          operationCategory: request.operationCategory,
          requestedKind
        })
    })

    const precision = yield* Option.match(Option.fromNullable(request.convergence), {
      onNone: () =>
        Effect.succeed<Precision.Resolution>({
          scalarKind: initialScalar.kind,
          converged: true,
          escalated: false,
          source: "none"
        }),
      onSome: (convergence) =>
        Precision.resolve({
          operation: request.operationName,
          currentKind: initialScalar.kind,
          attempts: request.escalationAttempt,
          convergence,
          scalarResolutionSource: initialScalar.source
        })
    })

    const scalarKind = yield* Scalar.resolve({
      operation: request.operationName,
      operationCategory: request.operationCategory,
      requestedKind: precision.scalarKind,
      enforceRequestedKind: true
    }).pipe(Effect.map((resolution) => resolution.kind))

    const backendKind = yield* Option.match(Option.fromNullable(request.preferredBackend), {
      onNone: () => Backend.resolve({ operation: request.operationName, scalarKind }),
      onSome: (preferredBackend) => Backend.resolve({ operation: request.operationName, scalarKind, preferredBackend })
    })

    const autodiff = yield* Match.value(request.requiresAutodiff).pipe(
      Match.when(false, () => Effect.succeed(noAutodiffResolution)),
      Match.when(true, () =>
        Option.match(Option.fromNullable(request.preferredAutodiff), {
          onNone: () => Autodiff.resolve({ operation: request.operationName }),
          onSome: (preferredMode) => Autodiff.resolve({ operation: request.operationName, preferredMode })
        })),
      Match.exhaustive
    )

    return {
      scalarKind,
      scalarResolutionSource: initialScalar.source,
      precisionEscalationSource: precision.source,
      backendKind,
      autodiffMode: autodiff.mode,
      differentiationMethod: autodiff.method,
      finiteDifferenceFallback: autodiff.usedFiniteDifferenceFallback,
      escalated: precision.escalated,
      convergenceSatisfied: precision.converged,
      uncertaintyEnvelope: request.requiresUncertaintyEnvelope
    }
  })

/**
 * Provides all default authority services used by planning.
 *
 * Backend policy is scalar-first. The resource-free layer cannot fail, does
 * not provide {@link Computation}, and installs no execution implementations.
 *
 * @since 0.1.0
 * @category layers
 */
export const layerAuthorities = Layer.mergeAll(
  Scalar.layer,
  Precision.layer,
  Layer.succeed(Policy.Backend, { policy: "scalar" }),
  Autodiff.layer
)

/**
 * Provides the authority-based planner without providing its requirements.
 *
 * This resource-free layer captures only the `planWithAuthorities` callback.
 * Calling that callback still requires {@link Requirements}; the layer neither
 * captures nor recreates those Context services.
 *
 * @since 0.1.0
 * @category layers
 */
export const layerPlanner = Layer.succeed(Computation, new Planner({ plan: planWithAuthorities }))

/**
 * Provides the authority-based planner and all default authority services.
 *
 * The resource-free layer cannot fail and supplies only planning capabilities.
 * It installs and executes no numerical kernel.
 *
 * @since 0.1.0
 * @category layers
 */
export const layer = Layer.mergeAll(layerPlanner, layerAuthorities)

/**
 * Decodes unknown input with excess-property rejection and delegates planning.
 *
 * The configured {@link Computation} receives the decoded request. Its returned
 * Effect retains any declared Context requirements. With {@link layer}, the
 * result is a plan only; delegation does not execute numerical work.
 *
 * @since 0.1.0
 * @category planning
 */
export const plan = (input: unknown) =>
  Effect.gen(function*() {
    const request = yield* decodeRequest(input)
    const computation = yield* Computation
    return yield* computation.plan(request)
  })
