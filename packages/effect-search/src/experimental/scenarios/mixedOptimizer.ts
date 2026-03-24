/**
 * Mixed optimizer scenario with categorical optimizer selection and numeric hyperparameters.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../SearchSpace/index.js"

/** @since 0.1.0 @category models */
export const MixedOptimizerChoices: ["adam", "sgd", "adamw"] = ["adam", "sgd", "adamw"]

/** @since 0.1.0 @category schemas */
export const MixedOptimizerConfigSchema = Schema.Struct({
  lr: Schema.Number,
  depth: Schema.Number,
  optimizer: Schema.Literal(...MixedOptimizerChoices)
})

/**
 * @since 0.1.0
 * @category type-level
 */
export type MixedOptimizerConfig = Schema.Schema.Type<typeof MixedOptimizerConfigSchema>

/** @since 0.1.0 @category utils */
export const decodeMixedOptimizerConfig = Schema.decodeUnknownSync(MixedOptimizerConfigSchema)

/** @since 0.1.0 @category utils */
export const decodeMixedOptimizerConfigEffect = Schema.decodeUnknown(MixedOptimizerConfigSchema)

/**
 * Constructs a mixed search space with log-scaled learning rate, integer depth, and categorical optimizer.
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
