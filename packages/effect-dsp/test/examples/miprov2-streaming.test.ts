/**
 * Example contract: MIPROv2 stream progression with mock provider and
 * effect-search runtime composition.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Ref, Schema, Stream } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

const trainset = Arr.make(
  new Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  }),
  new Example({
    input: { question: "What is the capital of Italy?" },
    output: { answer: "Rome" }
  })
)

const responseForPrompt = (prompt: string) =>
  prompt.includes("[miprov2-proposal:")
    ? "Answer with concise factual city names"
    : prompt.includes("What is the capital of France?")
    ? { answer: "Paris" }
    : prompt.includes("What is the capital of Japan?")
    ? { answer: "Tokyo" }
    : prompt.includes("What is the capital of Italy?")
    ? { answer: "Rome" }
    : { answer: "Unknown" }

const runMiproTagTrace = Effect.gen(function*() {
  const signature = yield* Signature.make(
    "Answer geography questions with concise city names",
    {
      question: Signature.describe(Schema.String, "Question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "Short factual answer")
    }
  )
  const module = yield* Module.predict("qa-mipro-stream", signature)
  const params = yield* Ref.get(module.params)

  yield* Ref.set(
    module.params,
    new ModuleParams({
      instructions: params.instructions,
      demos: params.demos,
      outputStrategy: "structured"
    })
  )

  const mock = yield* MockLanguageModel.make(
    MockLanguageModel.map(responseForPrompt)
  )
  const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

  const tags = yield* Stream.runCollect(
    Optimizer.miprov2Stream({
      module,
      trainset,
      valset: trainset,
      metric: Metric.exactMatch("answer"),
      numCandidates: 3,
      numInstructions: 3,
      trialBudget: 4,
      seed: 21
    })
  ).pipe(
    Effect.provide(layer),
    Effect.map((events) => Arr.map(Arr.fromIterable(events), (event) => event._tag))
  )

  return tags
})

describe("examples/06-optimize-miprov2-stream-mock", () => {
  it.effect("emits deterministic canonical phase progression", () =>
    Effect.gen(function*() {
      const first = yield* runMiproTagTrace
      const second = yield* runMiproTagTrace

      expect(first).toEqual(second)
      expect(first).toContain("Phase1Started")
      expect(first).toContain("Phase2Started")
      expect(first).toContain("Phase3Started")
      expect(first).toContain("Phase3Completed")
      expect(first.indexOf("Phase1Started")).toBeLessThan(first.indexOf("Phase2Started"))
      expect(first.indexOf("Phase2Started")).toBeLessThan(first.indexOf("Phase3Started"))
      expect(first[first.length - 1]).toBe("Phase3Completed")
    }))
})
