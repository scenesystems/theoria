/**
 * Defines a fixed optimizer, learning-rate, and depth fixture.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../SearchSpace/index.js"

/**
 * Lists the optimizer literals used by the schema and search space.
 *
 * @since 0.1.0
 * @category models
 */
export const MixedOptimizerChoices: ["adam", "sgd", "adamw"] = ["adam", "sgd", "adamw"]

/**
 * Decodes a numeric learning rate, an integer depth, and a declared optimizer.
 *
 * @remarks
 * The learning-rate and depth sampling ranges are not validation refinements.
 *
 * @since 0.1.0
 * @category schemas
 */
export const MixedOptimizerConfigSchema = Schema.Struct({
  /** Learning rate; standalone decoding does not enforce the sampling range. */
  lr: Schema.Number,
  /** Integer depth; standalone decoding does not enforce the sampling range. */
  depth: Schema.Int,
  /** Optimizer selected from {@link MixedOptimizerChoices}. */
  optimizer: Schema.Literal(...MixedOptimizerChoices)
})

/**
 * Carries optimizer, learning-rate, and depth settings decoded independently of sampling ranges.
 *
 * @since 0.1.0
 * @category type-level
 */
export type MixedOptimizerConfig = Schema.Schema.Type<typeof MixedOptimizerConfigSchema>

/**
 * Decodes an unknown mixed-optimizer configuration and throws on a schema violation.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeMixedOptimizerConfig = Schema.decodeUnknownSync(MixedOptimizerConfigSchema)

/**
 * Decodes an unknown mixed-optimizer configuration with schema violations in the Effect error channel.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeMixedOptimizerConfigEffect = Schema.decodeUnknown(MixedOptimizerConfigSchema)

/**
 * Builds a space with log-scaled learning rate from `0.0005` through `0.2`,
 * integer depth from `1` through `8`, and the declared optimizer choices.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeMixedOptimizerSpace = () =>
  SearchSpace.unsafeMake({
    lr: SearchSpace.float(0.0005, 0.2, { scale: "log" }),
    depth: SearchSpace.int(1, 8),
    optimizer: SearchSpace.categorical(MixedOptimizerChoices)
  })
