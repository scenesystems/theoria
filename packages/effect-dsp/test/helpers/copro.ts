import * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect, Layer, Ref, Schema } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { Example } from "effect-dsp/Example"
import type * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

export const BASELINE_INSTRUCTION = "Answer questions with concise facts"
export const IMPROVED_INSTRUCTION =
  "Answer questions with concise facts and verify the city against geographic knowledge."
export const ALTERNATE_INSTRUCTION = "Answer questions with concise facts and prefer exact country-capital matches."

export const capitalCityQaSignature = Signature.make(
  BASELINE_INSTRUCTION,
  {
    question: Signature.describe(Schema.String, "The question to answer")
  },
  {
    answer: Signature.describe(Schema.String, "A concise factual answer")
  }
)

export const capitalCityTrainset = [
  new Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  })
]

export const prepareStructuredModule = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  module: Module.Module<I, O>
) =>
  Ref.update(module.params, (params) =>
    new ModuleParams({
      instructions: params.instructions,
      demos: params.demos,
      outputStrategy: "structured"
    }))

const paris = { answer: "Paris" }
const tokyo = { answer: "Tokyo" }
const london = { answer: "London" }

export const fullRunResponses = [
  paris,
  london,
  { instruction: "Always answer Paris." },
  { instruction: IMPROVED_INSTRUCTION },
  paris,
  london,
  paris,
  paris,
  paris,
  tokyo,
  paris,
  tokyo,
  { instruction: ALTERNATE_INSTRUCTION },
  { instruction: "Always answer Paris." },
  paris,
  tokyo,
  paris,
  tokyo,
  paris,
  paris,
  paris,
  tokyo
]

export const firstLegResponses = fullRunResponses.slice(0, 12)

export const resumeTailResponses = [
  { answer: "Paris" },
  { answer: "Tokyo" },
  ...fullRunResponses.slice(12)
]

export const SequenceLanguageModel = {
  layer: (responses: ReadonlyArray<unknown>) =>
    Layer.effect(
      LanguageModel.LanguageModel,
      MockLanguageModel.make(MockLanguageModel.sequence(responses)).pipe(
        Effect.map((runtime) => runtime.service)
      )
    )
}
