/**
 * Selects automatic-differentiation metadata for computation plans.
 *
 * @since 0.1.0
 * @module
 */
import { Array, Boolean, Context, Effect, Layer, Match, Option, Schema, String } from "effect"

import * as LinearAlgebra from "./LinearAlgebra.js"

/**
 * Accepts forward- and reverse-mode automatic-differentiation labels.
 *
 * A mode is planning metadata and does not supply a differentiation engine.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Mode = Schema.Literal("forward", "reverse").annotations({
  identifier: "@scenesystems/effect-math/Autodiff/Mode"
})

/**
 * A decoded autodiff mode used in planning metadata.
 *
 * @since 0.1.0
 * @category models
 */
export type Mode = typeof Mode.Type

/**
 * Describes mode availability and an optional supported input dimension.
 *
 * `maxInputDimension` uses {@link LinearAlgebra.Dimension} and is capability
 * metadata only. {@link Request} has no dimension, so {@link resolve} cannot
 * enforce this limit and consults only `mode` and `available`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Capability = Schema.Struct({
  mode: Mode,
  available: Schema.Boolean,
  maxInputDimension: Schema.optional(LinearAlgebra.Dimension)
}).annotations({ identifier: "@scenesystems/effect-math/Autodiff/Capability" })

/**
 * Decoded capability metadata for one autodiff mode.
 *
 * @since 0.1.0
 * @category models
 */
export type Capability = typeof Capability.Type

/**
 * Accepts differentiation method labels returned by resolution.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Method = Schema.Literal("autodiff", "finite-difference").annotations({
  identifier: "@scenesystems/effect-math/Autodiff/Method"
})

/**
 * A decoded differentiation method selected during planning.
 *
 * @since 0.1.0
 * @category models
 */
export type Method = typeof Method.Type

/**
 * Describes the selected method, optional mode, and fallback provenance.
 *
 * Decoding represents an absent mode as `Option.none()`; encoding omits it.
 * The schema validates fields independently, while {@link resolve} returns
 * only consistent method, mode, and fallback combinations.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Resolution = Schema.Struct({
  method: Method,
  mode: Schema.optionalWith(Mode, { as: "Option" }),
  usedFiniteDifferenceFallback: Schema.Boolean
}).annotations({ identifier: "@scenesystems/effect-math/Autodiff/Resolution" })

/**
 * A decoded differentiation selection result.
 *
 * @since 0.1.0
 * @category models
 */
export type Resolution = typeof Resolution.Type

/**
 * Orders autodiff candidates and controls finite-difference fallback.
 *
 * Duplicate modes are accepted and retain their first position in resolution.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Policy = Schema.Struct({
  preferredOrder: Schema.NonEmptyArray(Mode),
  allowFiniteDifferenceFallback: Schema.Boolean
}).annotations({ identifier: "@scenesystems/effect-math/Autodiff/Policy" })

/**
 * A decoded autodiff mode selection policy.
 *
 * @since 0.1.0
 * @category models
 */
export type Policy = typeof Policy.Type

/**
 * Combines autodiff selection policy with a non-empty capability table.
 *
 * The schema permits duplicate modes and does not require policy modes to
 * appear in the capability table.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Settings = Schema.Struct({
  policy: Policy,
  capabilities: Schema.NonEmptyArray(Capability)
}).annotations({ identifier: "@scenesystems/effect-math/Autodiff/Settings" })

/**
 * Decoded policy and capability state consumed by autodiff selection.
 *
 * @since 0.1.0
 * @category models
 */
export type Settings = typeof Settings.Type

/**
 * Accepts operation metadata and an optional preferred autodiff mode.
 *
 * No input dimension is present, so capability dimension limits cannot be
 * enforced by mode resolution.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Request = Schema.Struct({ operation: Schema.String, preferredMode: Schema.optional(Mode) }).annotations({
  identifier: "@scenesystems/effect-math/Autodiff/Request"
})

/**
 * A decoded autodiff selection request.
 *
 * @since 0.1.0
 * @category models
 */
export type Request = typeof Request.Type

/**
 * Reports that no autodiff mode is available and fallback is disabled.
 *
 * `requestedMode` contains the caller preference or `"policy-default"`, and
 * `availableModes` contains capabilities currently marked available.
 *
 * @since 0.1.0
 * @category errors
 */
export class UnavailableError extends Schema.TaggedError<UnavailableError>(
  "@scenesystems/effect-math/Autodiff/UnavailableError"
)("AutodiffUnavailableError", {
  operation: Schema.String,
  requestedMode: Schema.String,
  availableModes: Schema.Array(Schema.String),
  message: Schema.String
}) {}

/**
 * Supplies autodiff policy and capabilities.
 *
 * @since 0.1.0
 * @category services
 */
export class Autodiff extends Context.Tag("@scenesystems/effect-math/Autodiff")<Autodiff, Settings>() {}

/**
 * Prefers reverse mode before forward mode and permits finite differences.
 *
 * Both autodiff modes are available as planning metadata. This setting does
 * not install autodiff or finite-difference implementations.
 *
 * @since 0.1.0
 * @category defaults
 */
export const defaultSettings = Schema.decodeUnknownSync(Settings)({
  policy: {
    preferredOrder: Array.make("reverse", "forward"),
    allowFiniteDifferenceFallback: true
  },
  capabilities: Array.make(
    { mode: "reverse", available: true },
    { mode: "forward", available: true }
  )
})

/**
 * Provides the default autodiff settings.
 *
 * The layer acquires no resources and cannot fail.
 *
 * @since 0.1.0
 * @category layers
 */
export const layer = Layer.succeed(Autodiff, defaultSettings)

const dedupeModes = Array.dedupeWith(String.Equivalence)

/**
 * Selects the first available autodiff mode or finite-difference fallback.
 *
 * A caller preference precedes policy order and duplicate candidates retain
 * their first position. Resolution ignores `maxInputDimension` because the
 * request has no dimension. If no mode is available, finite differences are
 * selected only when allowed; otherwise resolution fails. The result is
 * metadata and does not execute differentiation.
 *
 * @since 0.1.0
 * @category resolution
 */
export const resolve = (request: Request) =>
  Effect.gen(function*() {
    const settings = yield* Autodiff
    const ordered = dedupeModes(
      Option.match(Option.fromNullable(request.preferredMode), {
        onNone: () => settings.policy.preferredOrder,
        onSome: (mode) => Array.prepend(settings.policy.preferredOrder, mode)
      })
    )
    const resolved = Array.findFirst(ordered, (mode) =>
      Array.some(
        settings.capabilities,
        (candidate) => Boolean.and(String.Equivalence(candidate.mode, mode), candidate.available)
      ))
    const available = Array.map(
      Array.filter(settings.capabilities, (candidate) => candidate.available),
      (candidate) => candidate.mode
    )

    return yield* Option.match(resolved, {
      onNone: () =>
        Match.value(settings.policy.allowFiniteDifferenceFallback).pipe(
          Match.when(true, () =>
            Effect.succeed<Resolution>({
              method: "finite-difference",
              mode: Option.none(),
              usedFiniteDifferenceFallback: true
            })),
          Match.when(false, () =>
            Effect.fail(
              new UnavailableError({
                operation: request.operation,
                requestedMode: Option.getOrElse(
                  Option.fromNullable(request.preferredMode),
                  () => "policy-default"
                ),
                availableModes: available,
                message: "No autodiff mode is currently available"
              })
            )),
          Match.exhaustive
        ),
      onSome: (mode) =>
        Effect.succeed<Resolution>({
          method: "autodiff",
          mode: Option.some(mode),
          usedFiniteDifferenceFallback: false
        })
    })
  })
