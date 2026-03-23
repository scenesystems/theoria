import { Context, Layer, Schema } from "effect"

import { Seed } from "./BrandedScalars.js"

const PrecisionPolicy = Schema.Literal("strict", "relaxed")
const BackendPolicy = Schema.Literal("typed-array", "scalar")
const DiagnosticsPolicy = Schema.Literal("enabled", "disabled")

/**
 * Shared runtime policy declarations for cross-domain effectful orchestration.
 *
 * M4 runtime services (RNG, backend, precision, diagnostics) derive from this
 * contract so deterministic layers can be composed in tests and integrations.
 *
 * @since 0.1.0
 * @category contracts
 */
export const RuntimePolicies = Schema.Struct({
  precisionPolicy: PrecisionPolicy,
  backendPolicy: BackendPolicy,
  diagnosticsPolicy: DiagnosticsPolicy
})

/**
 * RNG runtime policy contract.
 *
 * @since 0.1.0
 * @category contracts
 */
export const RngPolicySchema = Schema.Struct({
  policy: Schema.Literal("deterministic", "nondeterministic"),
  seed: Seed
})

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
 * Shared runtime policy service type.
 *
 * @since 0.1.0
 * @category models
 */
export type RngPolicy = typeof RngPolicySchema.Type

/**
 * Shared runtime policy service type.
 *
 * @since 0.1.0
 * @category models
 */
export type PrecisionPolicyType = typeof PrecisionPolicySchema.Type

/**
 * Shared runtime policy service type.
 *
 * @since 0.1.0
 * @category models
 */
export type BackendPolicyType = typeof BackendPolicySchema.Type

/**
 * Shared runtime policy service type.
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
