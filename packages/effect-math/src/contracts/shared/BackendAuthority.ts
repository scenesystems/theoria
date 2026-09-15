/**
 * Defines static backend capabilities and runtime-policy ordering for computation planning.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Array, Boolean, Effect, Match, Option, Schema, String } from "effect"

import { BackendUnavailableError } from "./AdvancedComputationErrors.js"
import { BackendPolicySchema, BackendPolicyService, type BackendPolicyType } from "./RuntimePolicies.js"
import { ScalarKind, type ScalarKindType } from "./ScalarAuthority.js"

/**
 * Accepts scalar, compensated, and accelerated backend labels.
 *
 * @remarks
 * These labels describe plans and do not acquire an execution backend.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BackendKind = Schema.Union(BackendPolicySchema.fields.policy, Schema.Literal("accelerated"))

/**
 * A decoded backend label used in dispatch metadata.
 *
 * @since 0.1.0
 * @category models
 */
export type BackendKindType = typeof BackendKind.Type

/**
 * Describes a backend's availability and supported scalar lanes.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BackendCapability = Schema.Struct({
  kind: BackendKind,
  available: Schema.Boolean,
  supportedScalarKinds: Schema.NonEmptyArray(ScalarKind)
})

/**
 * Decoded capability metadata for one backend.
 *
 * @since 0.1.0
 * @category models
 */
export type BackendCapabilityType = typeof BackendCapability.Type

const RUNTIME_BACKEND_CAPABILITIES = Schema.decodeUnknownSync(Schema.NonEmptyArray(BackendCapability))(Array.make(
  {
    kind: "compensated",
    available: true,
    supportedScalarKinds: Array.make("float64")
  },
  {
    kind: "scalar",
    available: true,
    supportedScalarKinds: Array.make("float64", "bigdecimal")
  },
  {
    kind: "accelerated",
    available: false,
    supportedScalarKinds: Array.make("float64")
  }
))

/**
 * Accepts the operation and scalar lane used for backend selection.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BackendResolutionRequest = Schema.Struct({
  operation: Schema.String,
  scalarKind: ScalarKind,
  preferredBackend: Schema.optional(BackendKind)
})

/**
 * A decoded backend selection request.
 *
 * @since 0.1.0
 * @category models
 */
export type BackendResolutionRequestType = typeof BackendResolutionRequest.Type

type RuntimeBackendPolicy = BackendPolicyType["policy"]

const orderedKindsFromRuntimePolicy = (policy: RuntimeBackendPolicy) =>
  Match.value(policy).pipe(
    Match.when("compensated", () =>
      Schema.decodeUnknownSync(Schema.NonEmptyArray(BackendKind))(
        Array.make("compensated", "scalar")
      )),
    Match.when("scalar", () =>
      Schema.decodeUnknownSync(Schema.NonEmptyArray(BackendKind))(
        Array.make("scalar", "compensated")
      )),
    Match.exhaustive
  )

const backendSupportsScalarKind = (kind: BackendKindType, scalarKind: ScalarKindType): boolean =>
  Option.match(Array.findFirst(RUNTIME_BACKEND_CAPABILITIES, (candidate) => String.Equivalence(candidate.kind, kind)), {
    onNone: () => false,
    onSome: (capability) =>
      Boolean.and(
        capability.available,
        Array.containsWith(String.Equivalence)(capability.supportedScalarKinds, scalarKind)
      )
  })

/**
 * Selects a statically available backend for a scalar lane.
 *
 * @remarks
 * `"compensated"` policy tries compensated then scalar; `"scalar"` policy
 * reverses that order. The compensated backend accepts only Float64. The
 * scalar backend accepts both scalar kinds. Accelerated execution is disabled
 * and absent from both orders. `preferredBackend` affects only failure
 * diagnostics.
 *
 * @param request - Operation identity, selected scalar lane, and optional diagnostic preference.
 * @returns The first backend in runtime-policy order that accepts the scalar lane.
 * @throws {@link BackendUnavailableError} in the Effect error channel when neither enabled backend accepts the scalar lane.
 *
 * @since 0.1.0
 * @category contracts
 */
export const resolveBackendKind = (request: BackendResolutionRequestType) =>
  Effect.gen(function*() {
    const backendPolicy = yield* BackendPolicyService
    const orderedKinds = orderedKindsFromRuntimePolicy(backendPolicy.policy)
    const requestedBackend = Option.getOrElse(
      Option.fromNullable(request.preferredBackend),
      () => backendPolicy.policy
    )
    const resolved = Array.findFirst(orderedKinds, (kind) => backendSupportsScalarKind(kind, request.scalarKind))

    const availableBackends = Array.map(
      Array.filter(RUNTIME_BACKEND_CAPABILITIES, (candidate) => candidate.available),
      (candidate) => candidate.kind
    )

    return yield* Option.match(resolved, {
      onNone: () =>
        Effect.fail(
          new BackendUnavailableError({
            operation: request.operation,
            requestedBackend,
            availableBackends,
            message: String.concat("No backend can satisfy scalar lane ", request.scalarKind)
          })
        ),
      onSome: (kind) => Effect.succeed(kind)
    })
  })
