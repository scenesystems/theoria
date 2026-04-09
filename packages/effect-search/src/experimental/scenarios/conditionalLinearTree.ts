/**
 * Conditional search space scenario choosing between linear and tree model configurations.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../SearchSpace/index.js"

/** @since 0.1.0 @category models */
export const LinearTreeModelChoices: ["linear", "tree"] = ["linear", "tree"]

/** @since 0.1.0 @category schemas */
export const LinearConfigSchema = Schema.Struct({
  model: Schema.Literal("linear"),
  learningRate: Schema.Number,
  regularization: Schema.Number
})

/** @since 0.1.0 @category schemas */
export const TreeConfigSchema = Schema.Struct({
  model: Schema.Literal("tree"),
  maxDepth: Schema.Number,
  minSamplesLeaf: Schema.Number
})

/** @since 0.1.0 @category schemas */
export const LinearTreeConditionalConfigSchema = Schema.Union(LinearConfigSchema, TreeConfigSchema)

/**
 * @since 0.1.0
 * @category type-level
 */
export type LinearTreeConditionalConfig = Schema.Schema.Type<typeof LinearTreeConditionalConfigSchema>

/** @since 0.1.0 @category utils */
export const decodeLinearTreeConditionalConfig = Schema.decodeUnknownSync(LinearTreeConditionalConfigSchema)

/** @since 0.1.0 @category utils */
export const decodeLinearTreeConditionalConfigEffect = Schema.decodeUnknown(LinearTreeConditionalConfigSchema)

/**
 * Scenario-owned constructor for the conditional linear-vs-tree search space.
 *
 * @since 0.1.0
 * @category constructors
 */
export const LinearTreeConditionalSpace = {
  make: () =>
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
}
