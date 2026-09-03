/**
 * Defines a fixture whose model choice activates linear or tree parameters.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../SearchSpace/index.js"

/**
 * Lists the model discriminators used by the schema and search space.
 *
 * @since 0.1.0
 * @category models
 */
export const LinearTreeModelChoices: ["linear", "tree"] = ["linear", "tree"]

/**
 * Decodes the `linear` branch with numeric learning rate and regularization.
 *
 * @remarks
 * Numeric sampling ranges are not validation refinements on this schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LinearConfigSchema = Schema.Struct({
  /** Selects the linear branch. */
  model: Schema.Literal("linear"),
  /** Learning rate; any schema-valid number is accepted during standalone decoding. */
  learningRate: Schema.Number,
  /** Regularization value; any schema-valid number is accepted during standalone decoding. */
  regularization: Schema.Number
})

/**
 * Decodes the `tree` branch with integer depth and leaf size.
 *
 * @remarks
 * Numeric sampling ranges are not validation refinements on this schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TreeConfigSchema = Schema.Struct({
  /** Selects the tree branch. */
  model: Schema.Literal("tree"),
  /** Maximum tree depth; standalone decoding checks integer shape only. */
  maxDepth: Schema.Int,
  /** Minimum samples per leaf; standalone decoding checks integer shape only. */
  minSamplesLeaf: Schema.Int
})

/**
 * Decodes either fixture branch according to its `model` discriminator.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LinearTreeConditionalConfigSchema = Schema.Union(LinearConfigSchema, TreeConfigSchema)

/**
 * Preserves the selected model branch and only that branch's parameters.
 *
 * @since 0.1.0
 * @category type-level
 */
export type LinearTreeConditionalConfig = Schema.Schema.Type<typeof LinearTreeConditionalConfigSchema>

/**
 * Decodes an unknown fixture configuration and throws on a schema violation.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeLinearTreeConditionalConfig = Schema.decodeUnknownSync(LinearTreeConditionalConfigSchema)

/**
 * Decodes an unknown fixture configuration with schema violations in the Effect error channel.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeLinearTreeConditionalConfigEffect = Schema.decodeUnknown(LinearTreeConditionalConfigSchema)

/**
 * Builds a conditional space that samples only parameters for the selected model.
 *
 * @remarks
 * The linear branch samples log-scaled learning rates from `0.0001` through
 * `0.1` and regularization from `0` through `1`. The tree branch samples integer
 * depth from `2` through `12` and leaf size from `1` through `6`.
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
