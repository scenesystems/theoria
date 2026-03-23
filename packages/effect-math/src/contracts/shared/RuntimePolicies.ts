import { Schema } from "effect"

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
  precisionPolicy: Schema.String,
  backendPolicy: Schema.String,
  diagnosticsPolicy: Schema.String
})

/**
 * Shared runtime policy type.
 *
 * @since 0.1.0
 * @category models
 */
export type RuntimePoliciesType = typeof RuntimePolicies.Type
