/**
 * Post-execution runtime-evidence helpers.
 *
 * @since 0.1.0
 */
import type { ResolvedRuntimeDescriptor as ResolvedRuntimeDescriptorModel } from "../contracts/ResolvedRuntimeDescriptor.js"
import { RuntimeEvidence as RuntimeEvidenceContract } from "../contracts/RuntimeEvidence.js"
import type { RuntimeEvidence as RuntimeEvidenceModel } from "../contracts/RuntimeEvidence.js"
import type { RuntimeResolution } from "./services.js"

/**
 * Runtime-evidence assembly helpers anchored to the runtime-evidence noun.
 *
 * @since 0.1.0
 * @category constructors
 */
export const RuntimeEvidence = {
  fromResolution: (options: {
    readonly resolution: RuntimeResolution
    readonly resolvedRuntime: ResolvedRuntimeDescriptorModel
  }): RuntimeEvidenceModel =>
    RuntimeEvidenceContract.make({
      desired: options.resolution.desired,
      resolvedRoute: options.resolution.resolvedRoute,
      resolvedRuntime: options.resolvedRuntime,
      capabilities: options.resolution.capabilities
    })
}
