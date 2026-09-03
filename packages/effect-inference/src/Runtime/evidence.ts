/**
 * Assembly of post-execution runtime evidence.
 *
 * @since 0.1.0
 */
import type { ResolvedRuntimeDescriptor } from "../contracts/ResolvedRuntimeDescriptor.js"
import type { RuntimeEvidence } from "../contracts/RuntimeEvidence.js"
import type { RuntimeResolution } from "./services.js"

/**
 * Copies a pre-execution resolution and caller-supplied response observations
 * into one serializable record. It performs no decoding or verification.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeRuntimeEvidence = (options: {
  readonly resolution: RuntimeResolution
  readonly resolvedRuntime: ResolvedRuntimeDescriptor
}): RuntimeEvidence => ({
  desired: options.resolution.desired,
  resolvedRoute: options.resolution.resolvedRoute,
  resolvedRuntime: options.resolvedRuntime,
  capabilities: options.resolution.capabilities
})
