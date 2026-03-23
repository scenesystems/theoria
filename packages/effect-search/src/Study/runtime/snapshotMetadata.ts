/**
 * Snapshot metadata construction from study options and sampler checkpoints.
 *
 * @since 0.1.0
 */
import type * as Sampler from "../../Sampler/index.js"
import * as SearchSpace from "../../SearchSpace/index.js"
import type { OptimizePlan, OptimizeSettings } from "../options.js"
import type { SnapshotMetadata } from "../snapshot/metadata.js"

/**
 * Constructs snapshot metadata from the current study options and sampler checkpoint for persistence.
 *
 * @since 0.1.0
 * @category constructors
 */
export const snapshotMetadataFromOptions = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<Config, Space>,
  settings: OptimizeSettings,
  samplerCheckpoint: Sampler.SamplerCheckpoint
): SnapshotMetadata => ({
  spaceFingerprint: SearchSpace.fingerprint(options.space),
  objectiveSpec: settings.objectiveSpec,
  stopMode: settings.stopMode,
  samplerKind: options.sampler.kind,
  samplerCheckpoint
})
