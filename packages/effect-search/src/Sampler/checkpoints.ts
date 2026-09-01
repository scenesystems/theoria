/**
 * Checkpoint schemas for sampler variants.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { BuiltInAcquisitionNameSchema } from "./options.js"

/**
 * Random checkpoint containing the seed that a resumed sampler must match.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RandomSamplerCheckpointSchema = Schema.TaggedStruct("Random", {
  seed: Schema.Number
})

/**
 * Grid checkpoint containing the seed and shuffle setting that a resumed
 * sampler must match. The next trial number in {@link SuggestContext} is the
 * grid cursor.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GridSamplerCheckpointSchema = Schema.TaggedStruct("Grid", {
  seed: Schema.Number,
  shuffle: Schema.Boolean
})

/**
 * TPE checkpoint containing startup, candidate-count, and seed settings that a
 * resumed sampler must match. Completed and pending observations remain study
 * snapshot data rather than checkpoint fields.
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
 * CMA-ES checkpoint containing the seed, sigma, and population size that a
 * resumed sampler must match. Generation state is derived from trial history.
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
 * GP-BO checkpoint containing all persisted model and acquisition settings
 * that a resumed sampler must match.
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
