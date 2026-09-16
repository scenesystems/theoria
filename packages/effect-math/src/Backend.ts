/**
 * Selects execution backend metadata for computation plans.
 *
 * @since 0.1.0
 * @module
 */
import { Array, Boolean, Effect, Match, Option, Schema, String } from "effect"

import * as Policy from "./Policy.js"
import * as Scalar from "./Scalar.js"

/**
 * Accepts scalar, compensated, and accelerated backend labels.
 *
 * These labels describe plans and do not acquire execution resources.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Kind = Schema.Union(
  Policy.BackendPolicy.fields.policy,
  Schema.Literal("accelerated")
).annotations({ identifier: "@scenesystems/effect-math/Backend/Kind" })

/**
 * A decoded backend label used in dispatch metadata.
 *
 * @since 0.1.0
 * @category models
 */
export type Kind = typeof Kind.Type

/**
 * Describes static backend availability and accepted scalar lanes.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Capability = Schema.Struct({
  kind: Kind,
  available: Schema.Boolean,
  supportedScalarKinds: Schema.NonEmptyArray(Scalar.Kind)
}).annotations({ identifier: "@scenesystems/effect-math/Backend/Capability" })

/**
 * Decoded capability metadata for one backend.
 *
 * @since 0.1.0
 * @category models
 */
export type Capability = typeof Capability.Type

/**
 * Accepts operation metadata, the selected scalar lane, and a diagnostic preference.
 *
 * `preferredBackend` is reported on failure but deliberately does not alter
 * runtime-policy ordering.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Request = Schema.Struct({
  operation: Schema.String,
  scalarKind: Scalar.Kind,
  preferredBackend: Schema.optional(Kind)
}).annotations({ identifier: "@scenesystems/effect-math/Backend/Request" })

/**
 * A decoded backend selection request.
 *
 * @since 0.1.0
 * @category models
 */
export type Request = typeof Request.Type

/**
 * Reports that no available backend supports the selected scalar lane.
 *
 * `requestedBackend` is diagnostic metadata; `availableBackends` lists every
 * statically enabled backend, including incompatible ones.
 *
 * @since 0.1.0
 * @category errors
 */
export class UnavailableError extends Schema.TaggedError<UnavailableError>(
  "@scenesystems/effect-math/Backend/UnavailableError"
)("BackendUnavailableError", {
  operation: Schema.String,
  requestedBackend: Schema.String,
  availableBackends: Schema.Array(Schema.String),
  message: Schema.String
}) {}

const capabilities = Schema.decodeUnknownSync(Schema.NonEmptyArray(Capability))(Array.make(
  { kind: "compensated", available: true, supportedScalarKinds: Array.make("float64") },
  { kind: "scalar", available: true, supportedScalarKinds: Array.make("float64", "bigdecimal") },
  { kind: "accelerated", available: false, supportedScalarKinds: Array.make("float64") }
))

const orderedKinds = (policy: Policy.BackendPolicy["policy"]) =>
  Match.value(policy).pipe(
    Match.when("compensated", () =>
      Schema.decodeUnknownSync(Schema.NonEmptyArray(Kind))(Array.make("compensated", "scalar"))),
    Match.when("scalar", () =>
      Schema.decodeUnknownSync(Schema.NonEmptyArray(Kind))(Array.make("scalar", "compensated"))),
    Match.exhaustive
  )

const supports = (kind: Kind, scalarKind: Scalar.Kind): boolean =>
  Option.match(Array.findFirst(capabilities, (candidate) => String.Equivalence(candidate.kind, kind)), {
    onNone: () => false,
    onSome: (capability) =>
      Boolean.and(
        capability.available,
        Array.containsWith(String.Equivalence)(capability.supportedScalarKinds, scalarKind)
      )
  })

/**
 * Selects the first runtime-policy backend that accepts a scalar lane.
 *
 * Compensated policy tries compensated then scalar, while scalar policy tries
 * scalar then compensated. Compensated accepts only Float64; scalar accepts
 * both scalar kinds. Accelerated execution is disabled and never enters the
 * order. `preferredBackend` affects failure diagnostics only. The result is
 * planning metadata and does not execute or allocate a backend.
 *
 * @since 0.1.0
 * @category resolution
 */
export const resolve = (request: Request) =>
  Effect.gen(function*() {
    const backendPolicy = yield* Policy.Backend
    const ordered = orderedKinds(backendPolicy.policy)
    const requested = Option.getOrElse(
      Option.fromNullable(request.preferredBackend),
      () => backendPolicy.policy
    )
    const resolved = Array.findFirst(ordered, (kind) => supports(kind, request.scalarKind))
    const available = Array.map(
      Array.filter(capabilities, (candidate) => candidate.available),
      (candidate) => candidate.kind
    )

    return yield* Option.match(resolved, {
      onNone: () =>
        Effect.fail(
          new UnavailableError({
            operation: request.operation,
            requestedBackend: requested,
            availableBackends: available,
            message: String.concat("No backend can satisfy scalar lane ", request.scalarKind)
          })
        ),
      onSome: Effect.succeed
    })
  })
