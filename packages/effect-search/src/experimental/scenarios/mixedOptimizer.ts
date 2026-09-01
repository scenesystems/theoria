/**
 * Mixed optimizer scenario with categorical optimizer selection and numeric hyperparameters.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../SearchSpace/index.js"

/**
 * Optimizer values accepted by the mixed scenario.
 *
 * @since 0.1.0
 * @category models
 */
export const MixedOptimizerChoices: ["adam", "sgd", "adamw"] = ["adam", "sgd", "adamw"]

/**
 * Schema for learning rate, depth, and optimizer configurations.
 *
 * @since 0.1.0
 * @category schemas
 */
export const MixedOptimizerConfigSchema = Schema.Struct({
  lr: Schema.Number,
  depth: Schema.Number,
  optimizer: Schema.Literal(...MixedOptimizerChoices)
})

/**
 * Decoded configuration for {@link MixedOptimizerConfigSchema}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type MixedOptimizerConfig = Schema.Schema.Type<typeof MixedOptimizerConfigSchema>

/**
 * Decodes an unknown configuration or throws a parse error.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeMixedOptimizerConfig = Schema.decodeUnknownSync(MixedOptimizerConfigSchema)

/**
 * Decodes an unknown configuration, returning schema violations in the Effect error channel.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeMixedOptimizerConfigEffect = Schema.decodeUnknown(MixedOptimizerConfigSchema)

/**
 * Constructs a space with learning rate in `[0.0005, 0.2]` on a log scale,
 * integer depth in `[1, 8]`, and the declared optimizer choices.
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
