/**
 * Prompt instruction scenario with categorical prompt strategy and temperature parameters.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../SearchSpace/index.js"

/** @since 0.1.0 @category models */
export const PromptInstructionChoices: ["baseline", "rewrite", "counterexample", "socratic"] = [
  "baseline",
  "rewrite",
  "counterexample",
  "socratic"
]

/** @since 0.1.0 @category models */
export const PromptDemoChoices: ["none", "few", "curated"] = ["none", "few", "curated"]

/** @since 0.1.0 @category models */
export const PromptScoringChoices: ["strict", "balanced", "recall"] = ["strict", "balanced", "recall"]

/** @since 0.1.0 @category schemas */
export const PromptCategoricalConfigSchema = Schema.Struct({
  instruction: Schema.Literal(...PromptInstructionChoices),
  demos: Schema.Literal(...PromptDemoChoices),
  scoring: Schema.Literal(...PromptScoringChoices)
})

/**
 * @since 0.1.0
 * @category type-level
 */
export type PromptCategoricalConfig = Schema.Schema.Type<typeof PromptCategoricalConfigSchema>

/** @since 0.1.0 @category utils */
export const decodePromptCategoricalConfig = Schema.decodeUnknownSync(PromptCategoricalConfigSchema)

/** @since 0.1.0 @category utils */
export const decodePromptCategoricalConfigEffect = Schema.decodeUnknown(PromptCategoricalConfigSchema)

/**
 * Scenario-owned constructor for the categorical prompt-engineering search space.
 *
 * @since 0.1.0
 * @category constructors
 */
export const PromptCategoricalSpace = {
  make: () =>
    SearchSpace.unsafeMake({
      instruction: SearchSpace.categorical(PromptInstructionChoices),
      demos: SearchSpace.categorical(PromptDemoChoices),
      scoring: SearchSpace.categorical(PromptScoringChoices)
    })
}
