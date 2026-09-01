/**
 * Schemas and tagged constructors for sampler algorithm variants.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

import {
  CmaEsOptionsSchema,
  GpBoOptionsSchema,
  GridOptionsSchema,
  RandomOptionsSchema,
  TpeOptionsSchema
} from "./options.js"

/**
 * Re-export sampler checkpoint schemas and types.
 *
 * @since 0.1.0
 * @category re-exports
 */
export * from "./checkpoints.js"
/**
 * Re-export sampler option schemas and types.
 *
 * @since 0.1.0
 * @category re-exports
 */
export * from "./options.js"

/**
 * Tagged union schema identifying which optimization algorithm is active
 * and its algorithm-specific options.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SamplerKindSchema = Schema.Union(
  Schema.TaggedStruct("Random", { options: RandomOptionsSchema }),
  Schema.TaggedStruct("Grid", { options: GridOptionsSchema }),
  Schema.TaggedStruct("Tpe", { options: TpeOptionsSchema }),
  Schema.TaggedStruct("CmaEs", { options: CmaEsOptionsSchema }),
  Schema.TaggedStruct("GpBo", { options: GpBoOptionsSchema })
)

/**
 * Discriminated union carrying the algorithm tag and algorithm-specific
 * options used by {@link Sampler} to identify the active strategy.
 *
 * @since 0.1.0
 * @category models
 */
export type SamplerKind = Schema.Schema.Type<typeof SamplerKindSchema>

const SamplerKinds = Data.taggedEnum<SamplerKind>()

export const {
  /** Constructs a random-sampler kind with random-sampler options. @since 0.1.0 @category constructors */
  Random,
  /** Constructs a grid-sampler kind with grid enumeration options. @since 0.1.0 @category constructors */
  Grid,
  /** Constructs a tree-structured Parzen estimator kind with TPE options. @since 0.1.0 @category constructors */
  Tpe,
  /** Constructs a covariance matrix adaptation kind with CMA-ES options. @since 0.1.0 @category constructors */
  CmaEs,
  /** Constructs a Gaussian-process Bayesian optimization kind with GP-BO options. @since 0.1.0 @category constructors */
  GpBo,
  /** Creates a predicate that narrows a sampler kind by algorithm tag. @since 0.1.0 @category guards */
  $is: isSamplerKind,
  /** Creates an exhaustive matcher over sampler algorithm kinds. @since 0.1.0 @category pattern-matching */
  $match: matchSamplerKind
} = SamplerKinds
