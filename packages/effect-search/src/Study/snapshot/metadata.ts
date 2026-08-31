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
 * Runtime schema for decoding and validating snapshot metadata.
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
