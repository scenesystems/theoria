/**
 * Serializable identities for built-in sampler algorithms.
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

export * from "./checkpoints.js"
export * from "./options.js"

/**
 * Decodes a built-in algorithm tag together with its serializable options.
 *
 * @remarks
 * The schema validates field shape only. Algorithm-specific numeric ranges are
 * checked when the sampler produces a suggestion.
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
 * Serializable algorithm identity retained by {@link Sampler}.
 *
 * @since 0.1.0
 * @category models
 */
export type SamplerKind = Schema.Schema.Type<typeof SamplerKindSchema>

const SamplerKinds = Data.taggedEnum<SamplerKind>()

export const {
  /** Identifies a random sampler and retains its seed option. @since 0.1.0 @category constructors */
  Random,
  /** Identifies a grid sampler and retains its traversal options. @since 0.1.0 @category constructors */
  Grid,
  /** Identifies a TPE sampler and retains its serializable options. @since 0.1.0 @category constructors */
  Tpe,
  /** Identifies a CMA-ES sampler and retains its serializable options. @since 0.1.0 @category constructors */
  CmaEs,
  /** Identifies a GP-BO sampler and retains its serializable options. @since 0.1.0 @category constructors */
  GpBo,
  /**
   * Narrows a sampler kind to the specified algorithm tag.
   *
   * @typeParam Tag - Discriminator selected for narrowing.
   * @since 0.1.0
   * @category guards
   */
  $is: isSamplerKind,
  /**
   * Applies the handler associated with a sampler kind's algorithm tag.
   *
   * @typeParam Cases - Exhaustive handler record whose return values determine the result union.
   * @since 0.1.0
   * @category pattern-matching
   */
  $match: matchSamplerKind
} = SamplerKinds
