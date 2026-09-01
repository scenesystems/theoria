/**
 * Conditional search space scenario choosing between linear and tree model configurations.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../SearchSpace/index.js"

/**
 * Model discriminator values accepted by the conditional scenario.
 *
 * @since 0.1.0
 * @category models
 */
export const LinearTreeModelChoices: ["linear", "tree"] = ["linear", "tree"]

/**
 * Schema for the linear branch and its learning-rate and regularization parameters.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LinearConfigSchema = Schema.Struct({
  model: Schema.Literal("linear"),
  learningRate: Schema.Number,
  regularization: Schema.Number
})

/**
 * Schema for the tree branch and its depth and leaf-size parameters.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TreeConfigSchema = Schema.Struct({
  model: Schema.Literal("tree"),
  maxDepth: Schema.Number,
  minSamplesLeaf: Schema.Number
})

/**
 * Discriminated union schema for valid linear and tree configurations.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LinearTreeConditionalConfigSchema = Schema.Union(LinearConfigSchema, TreeConfigSchema)

/**
 * Decoded configuration for {@link LinearTreeConditionalConfigSchema}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type LinearTreeConditionalConfig = Schema.Schema.Type<typeof LinearTreeConditionalConfigSchema>

/**
 * Decodes an unknown configuration or throws a parse error.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeLinearTreeConditionalConfig = Schema.decodeUnknownSync(LinearTreeConditionalConfigSchema)

/**
 * Decodes an unknown configuration, returning schema violations in the Effect error channel.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeLinearTreeConditionalConfigEffect = Schema.decodeUnknown(LinearTreeConditionalConfigSchema)

/**
 * Constructs a conditional space where `model` activates only the parameters
 * belonging to the selected linear or tree branch.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeLinearTreeConditionalSpace = () =>
  SearchSpace.unsafeMakeConditional(
    {
      model: SearchSpace.categorical(LinearTreeModelChoices)
    },
    SearchSpace.switch("model", [
      SearchSpace.when(
        "linear",
        SearchSpace.unsafeMake({
          learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
          regularization: SearchSpace.float(0, 1)
        })
      ),
      SearchSpace.when(
        "tree",
        SearchSpace.unsafeMake({
          maxDepth: SearchSpace.int(2, 12),
          minSamplesLeaf: SearchSpace.int(1, 6)
        })
      )
    ])
  )
