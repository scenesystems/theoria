/**
 * Defines the study identity checked before snapshot restoration.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { ObjectiveSpecSchema } from "../../contracts/ObjectiveSpec.js"
import { SamplerCheckpointSchema, SamplerKindSchema } from "../../Sampler/index.js"
import { StopModeSchema } from "../runtime/pruning.js"

/**
 * Decodes the search-space, objective, stop, and sampler metadata needed to resume a study.
 *
 * @remarks
 * Restoration rejects a different search-space fingerprint, objective specification,
 * stop mode, or sampler kind. The sampler checkpoint supplies the sampler's saved
 * state after those checks pass. This schema validates field structure and does
 * not establish that the fingerprint or checkpoint belongs to the other fields.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SnapshotMetadataSchema = Schema.Struct({
  /** Fingerprint produced from the search space used by the saved study. */
  spaceFingerprint: Schema.String,
  /** Objective directions and scalar or multi-objective mode used by the saved study. */
  objectiveSpec: ObjectiveSpecSchema,
  /** Stop behavior used by the saved study. */
  stopMode: StopModeSchema,
  /** Sampler implementation identity checked before restoring its checkpoint. */
  samplerKind: SamplerKindSchema,
  /** Sampler state captured after the saved trials. */
  samplerCheckpoint: SamplerCheckpointSchema
})

/**
 * Records the study and sampler identity required for compatible restoration.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SnapshotMetadata = Schema.Schema.Type<typeof SnapshotMetadataSchema>
