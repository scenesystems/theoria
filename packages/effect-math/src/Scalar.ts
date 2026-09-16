/**
 * Selects scalar representations for computation plans.
 *
 * @since 0.1.0
 * @module
 */
import { Array, Boolean, Context, Effect, Layer, Match, Option, Schema, String } from "effect"

/**
 * Accepts scalar-lane labels understood by computation planning.
 *
 * These labels are metadata and do not install Float64 or BigDecimal kernels.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Kind = Schema.Literal("float64", "bigdecimal").annotations({
  identifier: "@scenesystems/effect-math/Scalar/Kind"
})

/**
 * A decoded scalar-lane label used in planning metadata.
 *
 * @since 0.1.0
 * @category models
 */
export type Kind = typeof Kind.Type

/**
 * Accepts operation families declared by scalar capabilities.
 *
 * @since 0.1.0
 * @category schemas
 */
export const OperationCategory = Schema.Literal(
  "numeric",
  "linear-algebra",
  "calculus",
  "optimization"
).annotations({ identifier: "@scenesystems/effect-math/Scalar/OperationCategory" })

/**
 * A decoded operation family used to select scalar capabilities.
 *
 * @since 0.1.0
 * @category models
 */
export type OperationCategory = typeof OperationCategory.Type

/**
 * Describes a scalar lane's supported operation families and arithmetic claims.
 *
 * Resolution consults only `kind` and `supportedCategories`;
 * `deterministic` and `supportsExactArithmetic` remain descriptive metadata.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Capability = Schema.Struct({
  kind: Kind,
  supportedCategories: Schema.NonEmptyArray(OperationCategory),
  deterministic: Schema.Boolean,
  supportsExactArithmetic: Schema.Boolean
}).annotations({ identifier: "@scenesystems/effect-math/Scalar/Capability" })

/**
 * Decoded capability metadata for one scalar lane.
 *
 * @since 0.1.0
 * @category models
 */
export type Capability = typeof Capability.Type

/**
 * Sets the primary scalar lane and ordered fallback candidates.
 *
 * At least one fallback is required, but duplicates are allowed and the
 * primary need not appear in `fallbackOrder`; resolution deduplicates later.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Policy = Schema.Struct({
  primaryKind: Kind,
  fallbackOrder: Schema.NonEmptyArray(Kind)
}).annotations({ identifier: "@scenesystems/effect-math/Scalar/Policy" })

/**
 * A decoded scalar lane selection policy.
 *
 * @since 0.1.0
 * @category models
 */
export type Policy = typeof Policy.Type

/**
 * Accepts provenance labels for explicit, primary, and fallback selection.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ResolutionSource = Schema.Literal("requested", "policy-primary", "policy-fallback").annotations({
  identifier: "@scenesystems/effect-math/Scalar/ResolutionSource"
})

/**
 * The request or policy branch that selected a scalar lane.
 *
 * @since 0.1.0
 * @category models
 */
export type ResolutionSource = typeof ResolutionSource.Type

/**
 * Describes a selected scalar lane and its selection provenance.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Resolution = Schema.Struct({ kind: Kind, source: ResolutionSource }).annotations({
  identifier: "@scenesystems/effect-math/Scalar/Resolution"
})

/**
 * A decoded scalar selection result.
 *
 * @since 0.1.0
 * @category models
 */
export type Resolution = typeof Resolution.Type

/**
 * Combines scalar selection policy with a non-empty capability table.
 *
 * The schema permits duplicate capability kinds and does not require every
 * policy lane to have a corresponding capability.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Settings = Schema.Struct({
  policy: Policy,
  capabilities: Schema.NonEmptyArray(Capability)
}).annotations({ identifier: "@scenesystems/effect-math/Scalar/Settings" })

/**
 * Decoded policy and capability state consumed by scalar selection.
 *
 * @since 0.1.0
 * @category models
 */
export type Settings = typeof Settings.Type

/**
 * Accepts operation metadata and an optional requested scalar lane.
 *
 * When `enforceRequestedKind` is true and a kind is present, no policy
 * fallback is attempted. The operation name is carried into failure details.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Request = Schema.Struct({
  operation: Schema.String,
  operationCategory: OperationCategory,
  requestedKind: Schema.optional(Kind),
  enforceRequestedKind: Schema.optional(Schema.Boolean)
}).annotations({ identifier: "@scenesystems/effect-math/Scalar/Request" })

/**
 * A decoded scalar selection request.
 *
 * @since 0.1.0
 * @category models
 */
export type Request = typeof Request.Type

/**
 * Reports that no configured scalar lane supports an operation category.
 *
 * `requestedKind` records the explicit lane or policy primary, while
 * `availableKinds` lists capabilities supporting the requested category.
 *
 * @since 0.1.0
 * @category errors
 */
export class UnsupportedError extends Schema.TaggedError<UnsupportedError>(
  "@scenesystems/effect-math/Scalar/UnsupportedError"
)("ScalarLaneUnsupportedError", {
  operation: Schema.String,
  requestedKind: Schema.String,
  availableKinds: Schema.Array(Schema.String),
  message: Schema.String
}) {}

/**
 * Supplies scalar selection policy and capabilities.
 *
 * @since 0.1.0
 * @category services
 */
export class Scalar extends Context.Tag("@scenesystems/effect-math/Scalar")<Scalar, Settings>() {}

/**
 * Selects Float64 before BigDecimal for every declared operation family.
 *
 * This is capability metadata only and installs no numerical kernels.
 *
 * @since 0.1.0
 * @category defaults
 */
export const defaultSettings = Schema.decodeUnknownSync(Settings)({
  policy: {
    primaryKind: "float64",
    fallbackOrder: Array.make("float64", "bigdecimal")
  },
  capabilities: Array.make(
    {
      kind: "float64",
      supportedCategories: Array.make("numeric", "linear-algebra", "calculus", "optimization"),
      deterministic: true,
      supportsExactArithmetic: false
    },
    {
      kind: "bigdecimal",
      supportedCategories: Array.make("numeric", "linear-algebra", "calculus", "optimization"),
      deterministic: true,
      supportsExactArithmetic: true
    }
  )
})

/**
 * Provides the default scalar selector settings.
 *
 * The layer acquires no resources and cannot fail.
 *
 * @since 0.1.0
 * @category layers
 */
export const layer = Layer.succeed(Scalar, defaultSettings)

const makeRequested = (kind: Kind): Resolution => ({ kind, source: "requested" })
const sourceFromPolicy = (kind: Kind, primaryKind: Kind): ResolutionSource =>
  Match.value(String.Equivalence(kind, primaryKind)).pipe(
    Match.withReturnType<ResolutionSource>(),
    Match.when(true, () => "policy-primary"),
    Match.when(false, () => "policy-fallback"),
    Match.exhaustive
  )
const dedupe = Array.dedupeWith((self: Resolution, that: Resolution) => String.Equivalence(self.kind, that.kind))
const supports = (capability: Capability, category: OperationCategory): boolean =>
  Array.containsWith(String.Equivalence)(capability.supportedCategories, category)

/**
 * Selects the first declared scalar lane supporting the requested operation family.
 *
 * An explicit request precedes the policy primary and fallback order. First
 * occurrences win when candidates repeat. With enforcement enabled, only the
 * explicit request is eligible. Resolution ignores arithmetic claim fields
 * and fails after every eligible lane lacks the operation category.
 *
 * @since 0.1.0
 * @category resolution
 */
export const resolve = (request: Request) =>
  Effect.gen(function*() {
    const settings = yield* Scalar
    const availableKinds = Array.map(
      Array.filter(settings.capabilities, (capability) => supports(capability, request.operationCategory)),
      (capability) => capability.kind
    )
    const requested = Option.match(Option.fromNullable(request.requestedKind), {
      onNone: () => Array.empty<Resolution>(),
      onSome: (kind) => Array.of(makeRequested(kind))
    })
    const policy = dedupe(
      Array.prepend(
        Array.map(settings.policy.fallbackOrder, (kind) => ({
          kind,
          source: sourceFromPolicy(kind, settings.policy.primaryKind)
        })),
        { kind: settings.policy.primaryKind, source: "policy-primary" }
      )
    )
    const ordered = Match.value(
      Boolean.and(
        Option.getOrElse(Option.fromNullable(request.enforceRequestedKind), () => false),
        Option.isSome(Option.fromNullable(request.requestedKind))
      )
    ).pipe(
      Match.when(true, () => requested),
      Match.when(false, () => dedupe(Array.appendAll(requested, policy))),
      Match.exhaustive
    )
    const resolved = Array.findFirst(ordered, (candidate) =>
      Array.some(
        settings.capabilities,
        (capability) =>
          Boolean.and(
            String.Equivalence(capability.kind, candidate.kind),
            supports(capability, request.operationCategory)
          )
      ))
    const attempted = Array.join(Array.map(ordered, (candidate) => candidate.kind), " -> ")

    return yield* Option.match(resolved, {
      onNone: () =>
        Effect.fail(
          new UnsupportedError({
            operation: request.operation,
            requestedKind: Option.getOrElse(
              Option.fromNullable(request.requestedKind),
              () => settings.policy.primaryKind
            ),
            availableKinds,
            message: Array.join(
              Array.make("No scalar lane resolved for ", request.operationCategory, "; attempted order: ", attempted),
              ""
            )
          })
        ),
      onSome: Effect.succeed
    })
  })
