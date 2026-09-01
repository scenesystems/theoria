/**
 * Runtime policy contracts for cross-domain effectful orchestration.
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
 * Decoded aggregate shape returned by {@link collectRuntimePolicies}.
 *
 * @remarks
 * The deterministic RNG branch records a validated {@link Seed}; this contract
 * does not itself construct or advance a random-number generator.
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
 * Selects nondeterministic generation or deterministic generation carrying a validated seed.
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
 * Selects strict non-finite-result rejection or relaxed IEEE 754 pass-through.
 *
 * @since 0.1.0
 * @category contracts
 */
export const PrecisionPolicySchema = Schema.Struct({
  policy: PrecisionPolicy
})

/**
 * Selects scalar-first or typed-array-first backend ordering.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BackendPolicySchema = Schema.Struct({
  policy: BackendPolicy
})

/**
 * Enables or disables policy-guard logging and timing.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DiagnosticsPolicySchema = Schema.Struct({
  policy: DiagnosticsPolicy
})

/**
 * Context tag for one RNG policy value supplied for an Effect's execution.
 *
 * @since 0.1.0
 * @category contracts
 */
export class RngPolicyService extends Context.Tag("effect-math/contracts/shared/RngPolicyService")<
  RngPolicyService,
  typeof RngPolicySchema.Type
>() {}

/**
 * Context tag for the strict or relaxed result-validation policy.
 *
 * @since 0.1.0
 * @category contracts
 */
export class PrecisionPolicyService extends Context.Tag("effect-math/contracts/shared/PrecisionPolicyService")<
  PrecisionPolicyService,
  typeof PrecisionPolicySchema.Type
>() {}

/**
 * Context tag for backend ordering; it does not allocate a backend.
 *
 * @since 0.1.0
 * @category contracts
 */
export class BackendPolicyService extends Context.Tag("effect-math/contracts/shared/BackendPolicyService")<
  BackendPolicyService,
  typeof BackendPolicySchema.Type
>() {}

/**
 * Context tag controlling policy-guard debug logging and timing.
 *
 * @since 0.1.0
 * @category contracts
 */
export class DiagnosticsPolicyService extends Context.Tag("effect-math/contracts/shared/DiagnosticsPolicyService")<
  DiagnosticsPolicyService,
  typeof DiagnosticsPolicySchema.Type
>() {}

/**
 * Requires a seed plus precision, backend, and diagnostics selections for a deterministic layer.
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
 * Requires precision, backend, and diagnostics selections while recording no RNG seed.
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
 * Provides all four policy services with a deterministic seed.
 *
 * @remarks
 * Each call captures the supplied immutable configuration in a fresh Layer;
 * merging the providers is deterministic and performs no acquisition.
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
 * const policies = collectRuntimePolicies.pipe(
 *   Effect.provide(makeDeterministicRuntimePoliciesLayer({
 *     seed: Schema.decodeUnknownSync(Seed)(42),
 *     precision: "strict",
 *     backend: "scalar",
 *     diagnostics: "disabled"
 *   }))
 * )
 * ```
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
 * Provides all four policy services with the nondeterministic RNG branch.
 *
 * @remarks
 * This records policy selection only; random generation is owned by consumers
 * of {@link RngPolicyService}.
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
 * Reads all four policy services from the current Effect context.
 *
 * @remarks
 * The returned Effect requires {@link RngPolicyService},
 * {@link PrecisionPolicyService}, {@link BackendPolicyService}, and
 * {@link DiagnosticsPolicyService}; it neither caches nor acquires them.
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
 * RNG policy configuration — deterministic (with seed) or nondeterministic.
 *
 * @since 0.1.0
 * @category models
 */
export type RngPolicy = typeof RngPolicySchema.Type

/**
 * Precision policy configuration — strict or relaxed floating-point semantics.
 *
 * @since 0.1.0
 * @category models
 */
export type PrecisionPolicyType = typeof PrecisionPolicySchema.Type

/**
 * Backend policy configuration — typed-array or scalar execution strategy.
 *
 * @since 0.1.0
 * @category models
 */
export type BackendPolicyType = typeof BackendPolicySchema.Type

/**
 * Diagnostics policy configuration — enabled or disabled runtime tracing.
 *
 * @since 0.1.0
 * @category models
 */
export type DiagnosticsPolicyType = typeof DiagnosticsPolicySchema.Type

/**
 * The four policy values collected from the current Effect context.
 *
 * @since 0.1.0
 * @category models
 */
export type RuntimePoliciesType = typeof RuntimePolicies.Type
