/**
 * Snapshot metadata construction from optimization options and sampler checkpoints.
 *
 * @since 0.1.0
 */
import type * as OptimizationSnapshot from "../../../OptimizationSnapshot.js"
import type * as Sampler from "../../../Sampler.js"
import * as SearchSpace from "../../../SearchSpace.js"
import type { OptimizePlan, OptimizeSettings } from "../options/plan.js"

/**
 * Constructs snapshot metadata from the current optimization options and sampler checkpoint for persistence.
 *
 * @since 0.1.0
 * @category constructors
 */
export const snapshotMetadataFromOptions = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<Config, Space>,
  settings: OptimizeSettings,
  samplerCheckpoint: Sampler.Checkpoint
): OptimizationSnapshot.Metadata => ({
  spaceFingerprint: SearchSpace.fingerprint(options.space),
  objectiveSpec: settings.objectiveSpec,
  stopMode: settings.stopMode,
  samplerKind: options.sampler.kind,
  samplerCheckpoint
})
