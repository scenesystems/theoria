/**
 * Post-execution runtime-evidence helpers.
 *
 * @since 0.1.0
 */
import type { ResolvedRuntimeDescriptor } from "../contracts/ResolvedRuntimeDescriptor.js"
import type { RuntimeEvidence } from "../contracts/RuntimeEvidence.js"
import type { RuntimeResolution } from "./services.js"

/**
 * Combines a pre-execution resolution with caller-supplied post-execution
 * evidence. The function copies data without decoding or verifying it; callers
 * must derive `resolvedRuntime` from the actual provider response.
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
