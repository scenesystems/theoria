/**
 * Snapshot metadata schema capturing study configuration at snapshot time.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { ObjectiveSpecSchema } from "../../contracts/ObjectiveSpec.js"
import { SamplerCheckpointSchema, SamplerKindSchema } from "../../Sampler/index.js"
import { StopModeSchema } from "../runtime/pruning.js"

/**
 * Decodes compatibility-critical resume metadata: the search-space fingerprint,
 * objective and stop semantics, and sampler kind/checkpoint. Restore logic
 * compares these fields with the requested study before accepting the snapshot.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SnapshotMetadataSchema = Schema.Struct({
  spaceFingerprint: Schema.String,
  objectiveSpec: ObjectiveSpecSchema,
  stopMode: StopModeSchema,
  samplerKind: SamplerKindSchema,
  samplerCheckpoint: SamplerCheckpointSchema
})

/**
 * Search-space, objective, stop-mode, and sampler identity stored with a snapshot.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SnapshotMetadata = Schema.Schema.Type<typeof SnapshotMetadataSchema>
