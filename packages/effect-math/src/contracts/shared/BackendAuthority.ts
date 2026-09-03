/**
 * Defines static backend capabilities and runtime-policy ordering for computation planning.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Effect, Match, Option, Schema } from "effect"

import { BackendUnavailableError } from "./AdvancedComputationErrors.js"
import { BackendPolicyService, type BackendPolicyType } from "./RuntimePolicies.js"
import { ScalarKind, type ScalarKindType } from "./ScalarAuthority.js"

/**
 * Accepts scalar, typed-array, and accelerated backend labels.
 *
 * @remarks
 * These labels describe plans and do not acquire an execution backend.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BackendKind = Schema.Literal("scalar", "typed-array", "accelerated")

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

const RUNTIME_BACKEND_CAPABILITIES: ReadonlyArray<BackendCapabilityType> = [{
  kind: "typed-array",
  available: true,
  supportedScalarKinds: ["float64"]
}, {
  kind: "scalar",
  available: true,
  supportedScalarKinds: ["float64", "bigdecimal"]
}, {
  kind: "accelerated",
  available: false,
  supportedScalarKinds: ["float64"]
}]

const TYPED_ARRAY_FIRST_ORDER: ReadonlyArray<BackendKindType> = ["typed-array", "scalar"]
const SCALAR_FIRST_ORDER: ReadonlyArray<BackendKindType> = ["scalar", "typed-array"]

type RuntimeBackendPolicy = BackendPolicyType["policy"]

const orderedKindsFromRuntimePolicy = (policy: RuntimeBackendPolicy): ReadonlyArray<BackendKindType> =>
  Match.value(policy).pipe(
    Match.when("typed-array", () => TYPED_ARRAY_FIRST_ORDER),
    Match.when("scalar", () => SCALAR_FIRST_ORDER),
    Match.exhaustive
  )

const backendSupportsScalarKind = (kind: BackendKindType, scalarKind: ScalarKindType): boolean =>
  Option.match(Option.fromNullable(RUNTIME_BACKEND_CAPABILITIES.find((candidate) => candidate.kind === kind)), {
    onNone: () => false,
    onSome: (capability) => capability.available && capability.supportedScalarKinds.includes(scalarKind)
  })

/**
 * Selects a statically available backend for a scalar lane.
 *
 * @remarks
 * `"typed-array"` policy tries typed-array then scalar; `"scalar"` policy
 * reverses that order. The typed-array backend accepts only Float64. The
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
export const resolveBackendKind = (request: {
  readonly operation: string
  readonly scalarKind: ScalarKindType
  readonly preferredBackend?: BackendKindType
}) =>
  Effect.gen(function*() {
    const backendPolicy = yield* BackendPolicyService
    const orderedKinds = orderedKindsFromRuntimePolicy(backendPolicy.policy)
    const requestedBackend = request.preferredBackend ?? backendPolicy.policy
    const resolved = Option.fromNullable(
      orderedKinds.find((kind) => backendSupportsScalarKind(kind, request.scalarKind))
    )

    const availableBackends = RUNTIME_BACKEND_CAPABILITIES
      .filter((candidate) => candidate.available)
      .map((candidate) => candidate.kind)

    return yield* Option.match(resolved, {
      onNone: () =>
        Effect.fail(
          new BackendUnavailableError({
            operation: request.operation,
            requestedBackend,
            availableBackends,
            message: `No backend can satisfy scalar lane ${request.scalarKind}`
          })
        ),
      onSome: (kind) => Effect.succeed(kind)
    })
  })
