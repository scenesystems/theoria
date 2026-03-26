/**
 * Checkpoint schemas for sampler variants.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { BuiltInAcquisitionNameSchema } from "./options.js"

/**
 * Minimal state needed to resume a random sampler.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RandomSamplerCheckpointSchema = Schema.TaggedStruct("Random", {
  seed: Schema.Number
})

/**
 * Minimal state needed to resume a grid sampler.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GridSamplerCheckpointSchema = Schema.TaggedStruct("Grid", {
  seed: Schema.Number,
  shuffle: Schema.Boolean
})

/**
 * Minimal state needed to resume a TPE sampler.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TpeSamplerCheckpointSchema = Schema.TaggedStruct("Tpe", {
  seed: Schema.Number,
  nStartupTrials: Schema.Number,
  nEiCandidates: Schema.Number
})

/**
 * Minimal state needed to resume a CMA-ES sampler.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CmaEsSamplerCheckpointSchema = Schema.TaggedStruct("CmaEs", {
  seed: Schema.Number,
  sigma: Schema.Number,
  populationSize: Schema.Number
})

/**
 * Minimal state needed to resume a GP-BO sampler.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GpBoSamplerCheckpointSchema = Schema.TaggedStruct("GpBo", {
  seed: Schema.Number,
  nStartupTrials: Schema.Number,
  nCandidates: Schema.Number,
  lengthScale: Schema.Number,
  noise: Schema.Number,
  acquisition: Schema.optional(BuiltInAcquisitionNameSchema)
})

/**
 * Union schema over all algorithm-specific checkpoint variants.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SamplerCheckpointSchema = Schema.Union(
  RandomSamplerCheckpointSchema,
  GridSamplerCheckpointSchema,
  TpeSamplerCheckpointSchema,
  CmaEsSamplerCheckpointSchema,
  GpBoSamplerCheckpointSchema
)

/**
 * Discriminated union of all algorithm-specific checkpoint states.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SamplerCheckpoint = Schema.Schema.Type<typeof SamplerCheckpointSchema>
