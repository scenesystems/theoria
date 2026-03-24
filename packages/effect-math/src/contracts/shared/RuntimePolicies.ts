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
 * Shared runtime policy declarations for cross-domain effectful orchestration.
 *
 * Runtime services (RNG, backend, precision, diagnostics) derive from this
 * contract so deterministic layers can be composed in tests and integrations.
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
 * RNG runtime policy contract.
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
 * Precision runtime policy contract.
 *
 * @since 0.1.0
 * @category contracts
 */
export const PrecisionPolicySchema = Schema.Struct({
  policy: PrecisionPolicy
})

/**
 * Backend runtime policy contract.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BackendPolicySchema = Schema.Struct({
  policy: BackendPolicy
})

/**
 * Diagnostics runtime policy contract.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DiagnosticsPolicySchema = Schema.Struct({
  policy: DiagnosticsPolicy
})

/**
 * RNG runtime policy service seam.
 *
 * @since 0.1.0
 * @category contracts
 */
export class RngPolicyService extends Context.Tag("effect-math/contracts/shared/RngPolicyService")<
  RngPolicyService,
  typeof RngPolicySchema.Type
>() {}

/**
 * Precision runtime policy service seam.
 *
 * @since 0.1.0
 * @category contracts
 */
export class PrecisionPolicyService extends Context.Tag("effect-math/contracts/shared/PrecisionPolicyService")<
  PrecisionPolicyService,
  typeof PrecisionPolicySchema.Type
>() {}

/**
 * Backend runtime policy service seam.
 *
 * @since 0.1.0
 * @category contracts
 */
export class BackendPolicyService extends Context.Tag("effect-math/contracts/shared/BackendPolicyService")<
  BackendPolicyService,
  typeof BackendPolicySchema.Type
>() {}

/**
 * Diagnostics runtime policy service seam.
 *
 * @since 0.1.0
 * @category contracts
 */
export class DiagnosticsPolicyService extends Context.Tag("effect-math/contracts/shared/DiagnosticsPolicyService")<
  DiagnosticsPolicyService,
  typeof DiagnosticsPolicySchema.Type
>() {}

/**
 * Deterministic runtime policy input schema.
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
 * Nondeterministic runtime policy input schema.
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
 * Deterministic runtime policy layer constructor for tests and reproducible execution.
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
 * Nondeterministic runtime policy layer constructor.
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
 * Resolves all runtime policy services into a single typed object.
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
 * Shared runtime policy type.
 *
 * @since 0.1.0
 * @category models
 */
export type RuntimePoliciesType = typeof RuntimePolicies.Type
