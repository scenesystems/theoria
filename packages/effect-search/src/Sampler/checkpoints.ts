/**
 * Serializable compatibility records used when a study resumes.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { BuiltInAcquisitionNameSchema } from "./options.js"

/**
 * Decodes the normalized seed required to resume a random sampler.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RandomSamplerCheckpointSchema = Schema.TaggedStruct("Random", {
  seed: Schema.Number
})

/**
 * Decodes the normalized seed and traversal order required to resume a grid sampler.
 *
 * @remarks
 * Grid position comes from the resumed study's next trial number rather than
 * this checkpoint.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GridSamplerCheckpointSchema = Schema.TaggedStruct("Grid", {
  seed: Schema.Number,
  shuffle: Schema.Boolean
})

/**
 * Decodes the seed and model-transition counts required to resume a TPE sampler.
 *
 * @remarks
 * Observations, model flags, noise options, acquisition functions, and
 * constraint evaluators are absent from this checkpoint. Study snapshots carry
 * trial history; restore validates only the fields declared here.
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
 * Decodes the seed, initial sigma, and population size required to resume CMA-ES.
 *
 * @remarks
 * Generation state is reconstructed from the resumed trial history.
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
 * Decodes the GP-BO settings compared during checkpoint restore.
 *
 * @remarks
 * An absent `acquisition` remains distinct from an explicit `"ei"`, although
 * both select expected improvement during suggestion.
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
 * Decodes a checkpoint for any built-in sampler algorithm.
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
 * Compatibility state captured by a built-in sampler.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SamplerCheckpoint = Schema.Schema.Type<typeof SamplerCheckpointSchema>
