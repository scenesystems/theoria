/**
 * Defines runtime configuration services shared by policy-aware operations.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Context, Effect, Layer, Schema } from "effect"

import { Seed } from "./BrandedScalars.js"

const PrecisionPolicy = Schema.Literal("strict", "relaxed")
const BackendPolicy = Schema.Literal("typed-array", "scalar")
const DiagnosticsPolicy = Schema.Literal("enabled", "disabled")

/**
 * Accepts one RNG, precision, backend, and diagnostics policy snapshot.
 *
 * @remarks
 * The deterministic branch records a {@link Seed}. It does not construct or
 * advance a random-number generator. Backend and diagnostics fields configure
 * consumers; the aggregate itself performs no dispatch or logging.
 *
 * @since 0.1.0
 * @category contracts
 */
export const RuntimePolicies = Schema.Struct({
  rngPolicy: Schema.Union(
    Schema.Struct({
      policy: Schema.Literal("deterministic"),
      seed: Seed
    }),
    Schema.Struct({
      policy: Schema.Literal("nondeterministic")
    })
  ),
  precisionPolicy: Schema.Struct({
    policy: PrecisionPolicy
  }),
  backendPolicy: Schema.Struct({
    policy: BackendPolicy
  }),
  diagnosticsPolicy: Schema.Struct({
    policy: DiagnosticsPolicy
  })
})

/**
 * Records nondeterministic selection or a deterministic selection with a seed.
 *
 * @remarks
 * Consumers decide how to initialize and advance a random-number generator.
 *
 * @since 0.1.0
 * @category contracts
 */
export const RngPolicySchema = Schema.Union(
  Schema.Struct({
    policy: Schema.Literal("deterministic"),
    seed: Seed
  }),
  Schema.Struct({
    policy: Schema.Literal("nondeterministic")
  })
)

/**
 * Selects strict or relaxed floating-point result handling.
 *
 * @remarks
 * Policy-aware operations define which result fields strict mode checks.
 *
 * @since 0.1.0
 * @category contracts
 */
export const PrecisionPolicySchema = Schema.Struct({
  policy: PrecisionPolicy
})

/**
 * Selects scalar-first or typed-array-first backend preference.
 *
 * @remarks
 * The policy allocates no backend. Individual operations may use the value
 * only for diagnostics; {@link resolveBackendKind} uses it for planner order.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BackendPolicySchema = Schema.Struct({
  policy: BackendPolicy
})

/**
 * Selects whether policy-aware operations may emit diagnostic logs.
 *
 * @remarks
 * Log annotations and timing vary by operation.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DiagnosticsPolicySchema = Schema.Struct({
  policy: DiagnosticsPolicy
})

/**
 * Supplies RNG selection metadata to an Effect execution.
 *
 * @remarks
 * The service does not contain a random-number generator.
 *
 * @since 0.1.0
 * @category contracts
 */
export class RngPolicyService extends Context.Tag("effect-math/contracts/shared/RngPolicyService")<
  RngPolicyService,
  typeof RngPolicySchema.Type
>() {}

/**
 * Supplies strict or relaxed result handling to policy-aware operations.
 *
 * @since 0.1.0
 * @category contracts
 */
export class PrecisionPolicyService extends Context.Tag("effect-math/contracts/shared/PrecisionPolicyService")<
  PrecisionPolicyService,
  typeof PrecisionPolicySchema.Type
>() {}

/**
 * Supplies backend preference metadata without allocating an execution backend.
 *
 * @since 0.1.0
 * @category contracts
 */
export class BackendPolicyService extends Context.Tag("effect-math/contracts/shared/BackendPolicyService")<
  BackendPolicyService,
  typeof BackendPolicySchema.Type
>() {}

/**
 * Supplies the diagnostic logging selection to policy-aware operations.
 *
 * @since 0.1.0
 * @category contracts
 */
export class DiagnosticsPolicyService extends Context.Tag("effect-math/contracts/shared/DiagnosticsPolicyService")<
  DiagnosticsPolicyService,
  typeof DiagnosticsPolicySchema.Type
>() {}

/**
 * Accepts the configuration used to construct deterministic runtime-policy Layers.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DeterministicRuntimePoliciesInputSchema = Schema.Struct({
  seed: Seed,
  precision: PrecisionPolicy,
  backend: BackendPolicy,
  diagnostics: DiagnosticsPolicy
})

type DeterministicRuntimePoliciesInputType = typeof DeterministicRuntimePoliciesInputSchema.Type

/**
 * Accepts the configuration used to construct nondeterministic runtime-policy Layers.
 *
 * @since 0.1.0
 * @category contracts
 */
export const NondeterministicRuntimePoliciesInputSchema = Schema.Struct({
  precision: PrecisionPolicy,
  backend: BackendPolicy,
  diagnostics: DiagnosticsPolicy
})

type NondeterministicRuntimePoliciesInputType = typeof NondeterministicRuntimePoliciesInputSchema.Type

/**
 * Builds a Layer containing all runtime-policy services and a deterministic seed.
 *
 * @remarks
 * The function accepts its typed input directly and does not decode it. The
 * Layer acquires no resources and cannot fail. It records the seed but creates
 * no random-number generator.
 *
 * @example
 * ```ts
 * import { Effect, Schema } from "effect"
 * import {
 *   collectRuntimePolicies,
 *   makeDeterministicRuntimePoliciesLayer,
 *   Seed
 * } from "@scenesystems/effect-math/contracts"
 *
 * export const program = Effect.gen(function*() {
 *   const seed = yield* Schema.decodeUnknown(Seed)(42)
 *   return yield* collectRuntimePolicies.pipe(
 *     Effect.provide(makeDeterministicRuntimePoliciesLayer({
 *       seed,
 *       precision: "strict",
 *       backend: "scalar",
 *       diagnostics: "disabled"
 *     }))
 *   )
 * }).pipe(
 *   Effect.filterOrFail(
 *     (policies) => policies.rngPolicy.policy === "deterministic" &&
 *       policies.rngPolicy.seed === 42,
 *     () => "UnexpectedRngPolicy"
 *   )
 * )
 * ```
 *
 * @param input - Already typed policy values captured by the Layer.
 * @returns A resource-free Layer providing the four policy services.
 *
 * @since 0.1.0
 * @category contracts
 */
export const makeDeterministicRuntimePoliciesLayer = (
  input: DeterministicRuntimePoliciesInputType
) => {
  return Layer.mergeAll(
    Layer.succeed(RngPolicyService, {
      policy: "deterministic",
      seed: input.seed
    }),
    Layer.succeed(PrecisionPolicyService, {
      policy: input.precision
    }),
    Layer.succeed(BackendPolicyService, {
      policy: input.backend
    }),
    Layer.succeed(DiagnosticsPolicyService, {
      policy: input.diagnostics
    })
  )
}

/**
 * Builds a Layer containing all runtime-policy services and no RNG seed.
 *
 * @remarks
 * The function accepts its typed input directly and does not decode it. The
 * Layer acquires no resources and cannot fail. Consumers of
 * {@link RngPolicyService} decide how nondeterministic values are generated.
 *
 * @param input - Already typed policy values captured by the Layer.
 * @returns A resource-free Layer providing the four policy services.
 *
 * @since 0.1.0
 * @category contracts
 */
export const makeNondeterministicRuntimePoliciesLayer = (
  input: NondeterministicRuntimePoliciesInputType
) => {
  return Layer.mergeAll(
    Layer.succeed(RngPolicyService, {
      policy: "nondeterministic"
    }),
    Layer.succeed(PrecisionPolicyService, {
      policy: input.precision
    }),
    Layer.succeed(BackendPolicyService, {
      policy: input.backend
    }),
    Layer.succeed(DiagnosticsPolicyService, {
      policy: input.diagnostics
    })
  )
}

/**
 * Collects the current runtime-policy service values into one object.
 *
 * @remarks
 * Each execution reads {@link RngPolicyService}, {@link PrecisionPolicyService},
 * {@link BackendPolicyService}, and {@link DiagnosticsPolicyService} from its
 * context. The result retains the supplied service values and performs no
 * Schema decoding.
 *
 * @returns The four policy values from the current Effect context.
 *
 * @since 0.1.0
 * @category contracts
 */
export const collectRuntimePolicies = Effect.all({
  rngPolicy: RngPolicyService,
  precisionPolicy: PrecisionPolicyService,
  backendPolicy: BackendPolicyService,
  diagnosticsPolicy: DiagnosticsPolicyService
})

/**
 * Decoded RNG selection metadata, including a seed for deterministic selection.
 *
 * @since 0.1.0
 * @category models
 */
export type RngPolicy = typeof RngPolicySchema.Type

/**
 * Decoded strict or relaxed precision selection.
 *
 * @since 0.1.0
 * @category models
 */
export type PrecisionPolicyType = typeof PrecisionPolicySchema.Type

/**
 * Decoded typed-array-first or scalar-first backend preference.
 *
 * @since 0.1.0
 * @category models
 */
export type BackendPolicyType = typeof BackendPolicySchema.Type

/**
 * Decoded diagnostic logging selection.
 *
 * @since 0.1.0
 * @category models
 */
export type DiagnosticsPolicyType = typeof DiagnosticsPolicySchema.Type

/**
 * A decoded aggregate runtime-policy snapshot.
 *
 * @since 0.1.0
 * @category models
 */
export type RuntimePoliciesType = typeof RuntimePolicies.Type
