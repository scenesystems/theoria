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

export * from "./checkpoints.js"
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

/**
 * Destructured constructors, guards, and pattern matcher for the
 * {@link SamplerKind} tagged union.
 *
 * @since 0.1.0
 * @category constructors
 */
export const {
  Random,
  Grid,
  Tpe,
  CmaEs,
  GpBo,
  $is: isSamplerKind,
  $match: matchSamplerKind
} = SamplerKinds
