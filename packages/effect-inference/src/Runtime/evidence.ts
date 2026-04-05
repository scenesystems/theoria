/**
 * Post-execution runtime-evidence helpers.
 *
 * @since 0.1.0
 */
import type { ResolvedRuntimeDescriptor } from "../contracts/ResolvedRuntimeDescriptor.js"
import type { RuntimeEvidence } from "../contracts/RuntimeEvidence.js"
import type { RuntimeResolution } from "./services.js"

/**
 * Combines pre-execution resolution output with post-execution runtime truth
 * into one replay-safe runtime-evidence record.
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
