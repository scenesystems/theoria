/**
 * MIPROv2 orchestration contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { ModuleParams } from "@scenesystems/effect-dsp/contracts"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import { Array as Arr, Effect, Layer, Ref, Schema } from "effect"
import { miprov2WithEvents } from "../../../src/optimizers/MIPROv2/index.js"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

const trainset = Arr.make(
  new Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  })
)

describe("MIPROv2 orchestration", () => {
  it.effect("executes Phase1 -> Phase2 -> Phase3 in canonical order", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const baselineParams = yield* Ref.get(module.params)

      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: baselineParams.instructions,
          demos: baselineParams.demos,
          outputStrategy: "structured"
        })
      )

      const events = yield* Ref.make<ReadonlyArray<string>>(Arr.empty<string>())
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          prompt.includes("[miprov2-proposal:")
            ? "Use concise and factual answers"
            : { answer: "Paris" }
        )
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const optimized = yield* miprov2WithEvents(
        {
          module,
          trainset,
          valset: trainset,
          metric: Metric.exactMatch("answer"),
          numCandidates: 4,
          numInstructions: 4,
          trialBudget: 6,
          seed: 31
        },
        (event) => Ref.update(events, (tags) => Arr.append(tags, event._tag))
      ).pipe(Effect.provide(layer))

      const tags = yield* Ref.get(events)

      expect(optimized).toBe(module)
      expect(tags).toContain("Phase1Started")
      expect(tags).toContain("Phase2Started")
      expect(tags).toContain("Phase3Started")
      expect(tags).toContain("Phase3Completed")
      expect(tags.indexOf("Phase1Started")).toBeLessThan(tags.indexOf("Phase2Started"))
      expect(tags.indexOf("Phase2Started")).toBeLessThan(tags.indexOf("Phase3Started"))
    }))
})
