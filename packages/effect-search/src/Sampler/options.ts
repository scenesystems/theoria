/**
 * Serializable option records for built-in samplers.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { BuiltInAcquisitionNameSchema } from "../contracts/Acquisition.js"

export {
  /**
   * Decodes the `"ei"`, `"pi"`, and `"thompson"` acquisition names accepted by TPE and GP-BO.
   *
   * @since 0.1.0
   * @category schemas
   */
  BuiltInAcquisitionNameSchema
} from "../contracts/Acquisition.js"
export {
  /**
   * Names a built-in acquisition rule accepted by TPE and GP-BO.
   *
   * @since 0.1.0
   * @category models
   */
  type BuiltInAcquisitionName
} from "../contracts/Acquisition.js"

/**
 * Decodes an optional numeric seed for random sampling.
 *
 * @remarks
 * The schema does not apply the runtime default or normalize non-finite values.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RandomOptionsSchema = Schema.Struct({
  seed: Schema.optional(Schema.Number)
})

/**
 * Configures the seed used to derive each random suggestion.
 *
 * @remarks
 * {@link random} uses seed `0` when the field is absent. The seed, search space,
 * and next trial number determine the result.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RandomOptions = Schema.Schema.Type<typeof RandomOptionsSchema>

/**
 * Decodes optional grid traversal order and seed fields.
 *
 * @remarks
 * The schema does not apply constructor defaults.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GridOptionsSchema = Schema.Struct({
  shuffle: Schema.optional(Schema.Boolean),
  seed: Schema.optional(Schema.Number)
})

/**
 * Configures finite-grid traversal.
 *
 * @remarks
 * {@link grid} defaults to ordered traversal and seed `0`. The seed affects
 * order only when `shuffle` is true.
 *
 * @since 0.1.0
 * @category type-level
 */
export type GridOptions = Schema.Schema.Type<typeof GridOptionsSchema>

/**
 * Decodes the serializable fields retained for a TPE sampler.
 *
 * @remarks
 * Except for the non-negative `constraintsCount`, numeric range checks occur
 * when the sampler suggests a configuration. Defaults are also applied by the
 * sampler rather than by this schema.
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
 * Configures TPE startup, candidate scoring, model shape, noise handling, and seed.
 *
 * @remarks
 * {@link tpe} defaults to 10 startup trials, 24 candidates, seed `0`, and false
 * for each model flag. Startup trials must be a finite non-negative integer;
 * candidate count must be a finite positive integer. `noiseAlpha` defaults to
 * `1` and must be finite in the inclusive range 0 through 10. These checks run
 * when the sampler suggests a configuration. Runtime acquisition and constraint
 * functions are omitted from serializable options and checkpoints.
 *
 * @since 0.1.0
 * @category type-level
 */
export type TpeOptions = Schema.Schema.Type<typeof TpeOptionsSchema>

/**
 * Decodes optional CMA-ES seed, initial sigma, and population size fields.
 *
 * @remarks
 * The schema accepts any numbers; sampler validation enforces the model ranges.
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
 * Configures CMA-ES reproducibility and generation behavior.
 *
 * @remarks
 * {@link cmaEs} defaults to seed `0`, sigma `0.35`, and population size `12`.
 * Suggestion fails with `InvalidSamplerConfig` unless sigma is finite and
 * positive and population size is finite and at least 2.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CmaEsOptions = Schema.Schema.Type<typeof CmaEsOptionsSchema>

/**
 * Decodes serializable Gaussian-process and acquisition settings for GP-BO.
 *
 * @remarks
 * The schema checks field types and acquisition names. Runtime defaults and
 * numeric range checks are applied when the sampler is used.
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
 * Configures GP-BO startup, candidate search, kernel scale, noise, and acquisition.
 *
 * @remarks
 * {@link gpBo} defaults to seed `0`, 8 startup trials, 32 candidates, length
 * scale `0.25`, noise `0.01`, and `"ei"` acquisition. Suggestion fails with
 * `InvalidSamplerConfig` unless startup trials and noise are finite and
 * non-negative, candidate count is finite and at least 1, and length scale is
 * finite and positive.
 *
 * @since 0.1.0
 * @category type-level
 */
export type GpBoOptions = Schema.Schema.Type<typeof GpBoOptionsSchema>
