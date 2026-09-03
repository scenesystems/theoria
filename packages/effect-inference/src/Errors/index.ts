/**
 * Classifies invalid runtime configuration, unmet model capabilities,
 * unsupported routes, and resolver implementations that are unavailable.
 *
 * @remarks
 * Each variant is a tagged Schema error for recovery in the Effect failure
 * channel. `InferenceErrorSchema` decodes the complete package-owned union at
 * serialization boundaries.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

export {
  /** @since 0.1.0 */
  CapabilityMismatch
} from "./Capability.js"
export {
  /** @since 0.1.0 */
  InvalidRuntimeConfig
} from "./Config.js"
export {
  /** @since 0.1.0 */
  RuntimeResolverNotImplemented,
  /** @since 0.1.0 */
  UnsupportedRoute
} from "./RuntimeResolver.js"

import { CapabilityMismatch } from "./Capability.js"
import { InvalidRuntimeConfig } from "./Config.js"
import { RuntimeResolverNotImplemented, UnsupportedRoute } from "./RuntimeResolver.js"

/**
 * Root inference error taxonomy for package-owned resolution and capability
 * failures.
 *
 * @since 0.1.0
 * @category schemas
 */
export const InferenceErrorSchema = Schema.Union(
  InvalidRuntimeConfig,
  CapabilityMismatch,
  UnsupportedRoute,
  RuntimeResolverNotImplemented
)

/**
 * Typed Effect failure channel for package-owned configuration, capability,
 * route-support, and resolver-availability failures. Provider transport and
 * model-response failures remain in their adapter channels.
 *
 * @since 0.1.0
 * @category type-level
 */
export type InferenceError = Schema.Schema.Type<typeof InferenceErrorSchema>
