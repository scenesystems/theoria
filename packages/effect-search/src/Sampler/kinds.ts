/**
 * Schemas, tagged unions, and checkpoint definitions for the sampler algorithm variants (Random, Grid, TPE).
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

/**
 * Configuration schema for the random sampler. The optional `seed` field
 * controls deterministic replay — when set, repeated runs with the same
 * seed produce identical suggestion sequences.
 *
 * @see {@link RandomOptions} for the inferred type
 * @see {@link Random} constructor
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
 * @see {@link RandomOptionsSchema}
 * @see {@link Random} constructor
 *
 * @since 0.1.0
 * @category type-level
 */
export type RandomOptions = Schema.Schema.Type<typeof RandomOptionsSchema>

/**
 * Configuration schema for the grid sampler. When `shuffle` is true the
 * Cartesian-product traversal order is randomized, which can improve
 * early-stopping quality by avoiding correlated sweeps. The `seed` field
 * makes shuffled order reproducible.
 *
 * @see {@link GridOptions} for the inferred type
 * @see {@link Grid} constructor
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
 * @see {@link GridOptionsSchema}
 * @see {@link Grid} constructor
 *
 * @since 0.1.0
 * @category type-level
 */
export type GridOptions = Schema.Schema.Type<typeof GridOptionsSchema>

/**
 * Configuration schema for the TPE (Tree-structured Parzen Estimator) sampler.
 *
 * - `nStartupTrials` — number of random trials before Bayesian modeling begins
 * - `nEiCandidates` — candidate count when evaluating the Expected Improvement acquisition function (higher = more precise but slower)
 * - `multivariate` — when true, models joint distributions across dimensions instead of independent marginals
 * - `groupDimensions` — when true, groups correlated dimensions for joint modeling
 * - `noiseAware` — enables noise-aware optimization for stochastic objectives
 * - `noiseAlpha` — controls the noise prior strength (only meaningful when `noiseAware` is true)
 * - `constraintsCount` — number of constraint functions guiding feasibility
 * - `seed` — deterministic replay seed
 *
 * @see {@link TpeOptions} for the inferred type
 * @see {@link Tpe} constructor
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
 * @see {@link TpeOptionsSchema}
 * @see {@link Tpe} constructor
 *
 * @since 0.1.0
 * @category type-level
 */
export type TpeOptions = Schema.Schema.Type<typeof TpeOptionsSchema>

/**
 * Tagged union schema identifying which optimization algorithm is active
 * and its algorithm-specific options. Discriminated on `_tag` with variants
 * `"Random"`, `"Grid"`, and `"Tpe"`.
 *
 * @see {@link SamplerKind} for the inferred type
 * @see {@link SamplerKindSchema} members: {@link RandomOptionsSchema}, {@link GridOptionsSchema}, {@link TpeOptionsSchema}
 *
 * @since 0.1.0
 * @category schemas
 */
export const SamplerKindSchema = Schema.Union(
  Schema.TaggedStruct("Random", {
    options: RandomOptionsSchema
  }),
  Schema.TaggedStruct("Grid", {
    options: GridOptionsSchema
  }),
  Schema.TaggedStruct("Tpe", {
    options: TpeOptionsSchema
  })
)

/**
 * Minimal state needed to resume a random sampler: the current PRNG seed
 * so the next suggestion continues the original sequence.
 *
 * @see {@link SamplerCheckpointSchema}
 * @see {@link RandomOptionsSchema}
 *
 * @since 0.1.0
 * @category schemas
 */
export const RandomSamplerCheckpointSchema = Schema.TaggedStruct("Random", {
  seed: Schema.Number
})

/**
 * Minimal state needed to resume a grid sampler: the PRNG seed and
 * shuffle flag so the traversal order is reconstructed exactly.
 *
 * @see {@link SamplerCheckpointSchema}
 * @see {@link GridOptionsSchema}
 *
 * @since 0.1.0
 * @category schemas
 */
export const GridSamplerCheckpointSchema = Schema.TaggedStruct("Grid", {
  seed: Schema.Number,
  shuffle: Schema.Boolean
})

/**
 * Minimal state needed to resume a TPE sampler: the PRNG seed plus
 * the startup-trial and EI-candidate counts that were active when the
 * checkpoint was taken.
 *
 * @see {@link SamplerCheckpointSchema}
 * @see {@link TpeOptionsSchema}
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
 * Union schema over all algorithm-specific checkpoint variants. Used to
 * encode/decode checkpoints for persistence (e.g. to disk or a database)
 * so a study can be resumed without re-running completed trials.
 *
 * @see {@link SamplerCheckpoint} for the inferred type
 * @see {@link RandomSamplerCheckpointSchema}
 * @see {@link GridSamplerCheckpointSchema}
 * @see {@link TpeSamplerCheckpointSchema}
 *
 * @since 0.1.0
 * @category schemas
 */
export const SamplerCheckpointSchema = Schema.Union(
  RandomSamplerCheckpointSchema,
  GridSamplerCheckpointSchema,
  TpeSamplerCheckpointSchema
)

/**
 * Discriminated union of all algorithm-specific checkpoint states.
 * Persisting this value is sufficient to fully restore sampler state
 * and continue a study from where it left off.
 *
 * @see {@link SamplerCheckpointSchema}
 * @see {@link restoreCheckpoint} combinator
 *
 * @since 0.1.0
 * @category type-level
 */
export type SamplerCheckpoint = Schema.Schema.Type<typeof SamplerCheckpointSchema>

/**
 * Discriminated union carrying the algorithm tag and its algorithm-specific
 * options. Used by {@link Sampler} to identify which optimization strategy
 * is active and to reconstruct the algorithm from persisted configuration.
 *
 * @see {@link SamplerKindSchema}
 * @see {@link Sampler}
 *
 * @since 0.1.0
 * @category models
 */
export type SamplerKind = Schema.Schema.Type<typeof SamplerKindSchema>

const SamplerKinds = Data.taggedEnum<SamplerKind>()

/**
 * Destructured constructors, guards, and pattern matcher for the {@link SamplerKind} tagged union.
 *
 * @since 0.1.0
 * @category constructors
 */
export const {
  /**
   * Uniform random sampling — draws configurations independently from
   * the search space with no modeling of past results. Best for initial
   * exploration, baselines, and small search spaces.
   *
   * @see {@link RandomOptionsSchema}
   * @see {@link Sampler}
   *
   * @since 0.1.0
   * @category constructors
   */
  Random,
  /**
   * Exhaustive grid search over the Cartesian product of dimension
   * values. Guarantees full coverage of the discrete search space.
   * Optionally shuffled for randomized traversal order.
   *
   * @see {@link GridOptionsSchema}
   * @see {@link Sampler}
   *
   * @since 0.1.0
   * @category constructors
   */
  Grid,
  /**
   * Tree-structured Parzen Estimator — Bayesian optimization that models
   * the density ratio of promising vs unpromising configurations to focus
   * search on high-performing regions. Falls back to random sampling
   * during the startup phase (`nStartupTrials`).
   *
   * @see {@link TpeOptionsSchema}
   * @see {@link Sampler}
   *
   * @since 0.1.0
   * @category constructors
   */
  Tpe,
  /**
   * Type guard for SamplerKind variants. Narrows a value to a specific
   * algorithm tag (e.g. `isSamplerKind("Tpe")(kind)`).
   *
   * @see {@link SamplerKind}
   * @see {@link matchSamplerKind}
   *
   * @since 0.1.0
   * @category guards
   */
  $is: isSamplerKind,
  /**
   * Exhaustive pattern match on SamplerKind variants. Provide a handler
   * for each algorithm tag to branch on the active sampler type.
   *
   * @see {@link SamplerKind}
   * @see {@link isSamplerKind}
   *
   * @since 0.1.0
   * @category pattern-matching
   */
  $match: matchSamplerKind
} = SamplerKinds
