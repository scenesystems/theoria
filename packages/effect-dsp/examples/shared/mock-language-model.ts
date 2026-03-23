/**
 * Shared mock language-model layer helper for examples.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { MockLanguageModel, type ResponseStrategy } from "effect-dsp/test"

const DEFAULT_STRATEGY = MockLanguageModel.fixed({ answer: "mock" })

export const mockLanguageModelLayer = (strategy: ResponseStrategy = DEFAULT_STRATEGY) =>
  MockLanguageModel.layer(LanguageModel.LanguageModel, strategy)
