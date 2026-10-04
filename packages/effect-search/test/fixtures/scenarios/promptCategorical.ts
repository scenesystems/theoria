/**
 * Defines a fixed categorical fixture for prompt strategy selection.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../../src/SearchSpace.js"

/**
 * Lists the instruction strategies used by the schema and search space.
 *
 * @since 0.1.0
 * @category models
 */
export const PromptInstructionChoices = Schema.Literals(["baseline", "rewrite", "counterexample", "socratic"]).literals

/**
 * Lists the demonstration-set choices used by the schema and search space.
 *
 * @since 0.1.0
 * @category models
 */
export const PromptDemoChoices = Schema.Literals(["none", "few", "curated"]).literals

/**
 * Lists the scoring strategies used by the schema and search space.
 *
 * @since 0.1.0
 * @category models
 */
export const PromptScoringChoices = Schema.Literals(["strict", "balanced", "recall"]).literals

/**
 * Decodes one declared instruction, demonstration-set, and scoring choice.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PromptCategoricalConfig = Schema.Struct({
  /** Prompt instruction strategy. */
  instruction: Schema.Literals(PromptInstructionChoices),
  /** Demonstration-set selection. */
  demos: Schema.Literals(PromptDemoChoices),
  /** Output scoring strategy. */
  scoring: Schema.Literals(PromptScoringChoices)
})

/**
 * Carries the instruction, demonstration, and scoring choices for one fixture run.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PromptCategoricalConfig = Schema.Schema.Type<typeof PromptCategoricalConfig>

/**
 * Decodes an unknown prompt configuration with schema violations in the Effect error channel.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodePromptCategoricalConfig = Schema.decodeUnknownEffect(PromptCategoricalConfig)

/**
 * Builds a categorical space from the exported instruction, demonstration, and scoring choices.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makePromptCategoricalSpace = SearchSpace.make({
  instruction: SearchSpace.categorical(PromptInstructionChoices),
  demos: SearchSpace.categorical(PromptDemoChoices),
  scoring: SearchSpace.categorical(PromptScoringChoices)
})
