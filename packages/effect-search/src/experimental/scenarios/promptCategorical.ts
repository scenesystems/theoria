/**
 * Prompt instruction scenario with categorical prompt strategy and temperature parameters.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../SearchSpace/index.js"

/**
 * Instruction-strategy values accepted by the prompt scenario.
 *
 * @since 0.1.0
 * @category models
 */
export const PromptInstructionChoices: ["baseline", "rewrite", "counterexample", "socratic"] = [
  "baseline",
  "rewrite",
  "counterexample",
  "socratic"
]

/**
 * Demonstration-set values accepted by the prompt scenario.
 *
 * @since 0.1.0
 * @category models
 */
export const PromptDemoChoices: ["none", "few", "curated"] = ["none", "few", "curated"]

/**
 * Scoring-strategy values accepted by the prompt scenario.
 *
 * @since 0.1.0
 * @category models
 */
export const PromptScoringChoices: ["strict", "balanced", "recall"] = ["strict", "balanced", "recall"]

/**
 * Schema requiring one instruction, demonstration, and scoring choice.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PromptCategoricalConfigSchema = Schema.Struct({
  instruction: Schema.Literal(...PromptInstructionChoices),
  demos: Schema.Literal(...PromptDemoChoices),
  scoring: Schema.Literal(...PromptScoringChoices)
})

/**
 * Decoded configuration for {@link PromptCategoricalConfigSchema}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PromptCategoricalConfig = Schema.Schema.Type<typeof PromptCategoricalConfigSchema>

/**
 * Decodes an unknown configuration or throws a parse error.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodePromptCategoricalConfig = Schema.decodeUnknownSync(PromptCategoricalConfigSchema)

/**
 * Decodes an unknown configuration, returning schema violations in the Effect error channel.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodePromptCategoricalConfigEffect = Schema.decodeUnknown(PromptCategoricalConfigSchema)

/**
 * Constructs the categorical space described by the three exported choice tuples.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makePromptCategoricalSpace = () =>
  SearchSpace.unsafeMake({
    instruction: SearchSpace.categorical(PromptInstructionChoices),
    demos: SearchSpace.categorical(PromptDemoChoices),
    scoring: SearchSpace.categorical(PromptScoringChoices)
  })
