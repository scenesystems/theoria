/**
 * Option schemas for sampler variants.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { BuiltInAcquisitionNameSchema } from "../contracts/Acquisition.js"

export {
  /**
   * Shared built-in acquisition strategy schema used across samplers.
   *
   * @since 0.1.0
   * @category schemas
   */
  BuiltInAcquisitionNameSchema
} from "../contracts/Acquisition.js"
export {
  /**
   * Shared built-in acquisition strategy type used across samplers.
   *
   * @since 0.1.0
   * @category models
   */
  type BuiltInAcquisitionName
} from "../contracts/Acquisition.js"

/**
 * Configuration schema for the random sampler.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RandomOptionsSchema = Schema.Struct({
  seed: Schema.optional(Schema.Number)
})

/**
 * Inferred options type for the random sampler.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RandomOptions = Schema.Schema.Type<typeof RandomOptionsSchema>

/**
 * Configuration schema for the grid sampler.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GridOptionsSchema = Schema.Struct({
  shuffle: Schema.optional(Schema.Boolean),
  seed: Schema.optional(Schema.Number)
})

/**
 * Inferred options type for the grid sampler.
 *
 * @since 0.1.0
 * @category type-level
 */
export type GridOptions = Schema.Schema.Type<typeof GridOptionsSchema>

/**
 * Configuration schema for the TPE sampler.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TpeOptionsSchema = Schema.Struct({
  nStartupTrials: Schema.optional(Schema.Number),
  nEiCandidates: Schema.optional(Schema.Number),
  multivariate: Schema.optional(Schema.Boolean),
  groupDimensions: Schema.optional(Schema.Boolean),
  noiseAware: Schema.optional(Schema.Boolean),
  noiseAlpha: Schema.optional(Schema.Number),
  constraintsCount: Schema.optional(Schema.NonNegative),
  seed: Schema.optional(Schema.Number)
})

/**
 * Inferred options type for the TPE sampler.
 *
 * @since 0.1.0
 * @category type-level
 */
export type TpeOptions = Schema.Schema.Type<typeof TpeOptionsSchema>

/**
 * Configuration schema for the CMA-ES sampler.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CmaEsOptionsSchema = Schema.Struct({
  seed: Schema.optional(Schema.Number),
  sigma: Schema.optional(Schema.Number),
  populationSize: Schema.optional(Schema.Number)
})

/**
 * Inferred options type for the CMA-ES sampler.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CmaEsOptions = Schema.Schema.Type<typeof CmaEsOptionsSchema>

/**
 * Configuration schema for the GP-BO sampler.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GpBoOptionsSchema = Schema.Struct({
  seed: Schema.optional(Schema.Number),
  nStartupTrials: Schema.optional(Schema.Number),
  nCandidates: Schema.optional(Schema.Number),
  lengthScale: Schema.optional(Schema.Number),
  noise: Schema.optional(Schema.Number),
  acquisition: Schema.optional(BuiltInAcquisitionNameSchema)
})

/**
 * Inferred options type for the GP-BO sampler.
 *
 * @since 0.1.0
 * @category type-level
 */
export type GpBoOptions = Schema.Schema.Type<typeof GpBoOptionsSchema>
