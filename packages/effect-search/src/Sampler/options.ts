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
 * Random-sampler options. `seed` defaults to `0`; the same seed, search space,
 * and trial number reproduce a suggestion.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RandomOptionsSchema = Schema.Struct({
  seed: Schema.optional(Schema.Number)
})

/**
 * Controls deterministic random traversal. An omitted `seed` is `0`; the same
 * seed, search space, and trial number reproduce the same suggestion.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RandomOptions = Schema.Schema.Type<typeof RandomOptionsSchema>

/**
 * Grid-sampler options. `shuffle` defaults to `false` and `seed` to `0`.
 * The seed is used only when shuffled traversal is enabled.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GridOptionsSchema = Schema.Struct({
  shuffle: Schema.optional(Schema.Boolean),
  seed: Schema.optional(Schema.Number)
})

/**
 * Controls finite-grid traversal. By default enumeration is ordered
 * (`shuffle: false`) with seed `0`; `seed` affects ordering only when shuffling,
 * and the sampler eventually fails with `SamplerExhausted` after every entry.
 *
 * @since 0.1.0
 * @category type-level
 */
export type GridOptions = Schema.Schema.Type<typeof GridOptionsSchema>

/**
 * Serializable TPE options. Defaults are 10 startup trials, 24 candidates,
 * seed `0`, and disabled multivariate, grouping, and noise-aware modes.
 * `nStartupTrials` must be non-negative, `nEiCandidates` at least one, and
 * `noiseAlpha` finite and between 0 and 10.
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
 * Serializable options accepted by {@link tpe}. The constructor additionally
 * accepts runtime acquisition and constraint functions, which are not part of
 * this schema or persisted checkpoint.
 *
 * @since 0.1.0
 * @category type-level
 */
export type TpeOptions = Schema.Schema.Type<typeof TpeOptionsSchema>

/**
 * CMA-ES options. Defaults are seed `0`, sigma `0.35`, and population size
 * `12`. Sigma must be finite and positive; population size must be finite and
 * at least two.
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
 * Controls CMA-ES reproducibility and generation behavior: `seed` defaults to
 * `0`, global step size `sigma` to `0.35`, and population size to `12`.
 * Construction rejects non-positive/non-finite sigma or populations below two.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CmaEsOptions = Schema.Schema.Type<typeof CmaEsOptionsSchema>

/**
 * GP-BO options. Defaults are seed `0`, 8 startup trials, 32 candidates,
 * length scale `0.25`, noise `0.01`, and expected improvement. Startup trials
 * and noise must be non-negative, candidate count at least one, and length
 * scale positive; all numeric model settings must be finite.
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
 * Controls GP-BO startup randomness, posterior candidate search, RBF kernel,
 * diagonal noise, and acquisition (`expected-improvement` by default). Defaults
 * are seed `0`, 8 startup trials, 32 candidates, length scale `0.25`, and noise
 * `0.01`; model counts/scales must satisfy the constraints on the schema summary.
 *
 * @since 0.1.0
 * @category type-level
 */
export type GpBoOptions = Schema.Schema.Type<typeof GpBoOptionsSchema>
