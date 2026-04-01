/**
 * Backend authority contracts for deterministic execution dispatch.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Effect, Match, Option, Schema } from "effect"

import { BackendUnavailableError } from "./AdvancedComputationErrors.js"
import { BackendPolicyService, type BackendPolicyType } from "./RuntimePolicies.js"
import { ScalarKind, type ScalarKindType } from "./ScalarAuthority.js"

/**
 * Compute backend kinds participating in contract dispatch.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BackendKind = Schema.Literal("scalar", "typed-array", "accelerated")

/**
 * Backend kind type.
 *
 * @since 0.1.0
 * @category models
 */
export type BackendKindType = typeof BackendKind.Type

/**
 * Backend capability contract.
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
 * Backend capability type.
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
 * Resolves backend kind from runtime policy authority and backend capabilities.
 *
 * **Details**
 * Runtime backend policy is authoritative for ordering. `preferredBackend`
 * is carried for diagnostics only and never bypasses runtime policy ordering.
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
