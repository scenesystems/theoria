import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import * as BootstrapRS from "@scenesystems/effect-dsp/BootstrapRS"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Boolean as Bool, Effect, Layer, Match, Option, Ref, Schema, String as Str } from "effect"

import { BootstrapRSCandidateCatalogFixtureSchema, loadFixture } from "../helpers/dspy-fixtures/index.js"

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

const toExamples = (entries: ReadonlyArray<{ readonly question: string; readonly answer: string }>) =>
  Arr.map(
    entries,
    (entry) =>
      new Example({
        input: { question: entry.question },
        output: { answer: entry.answer }
      })
  )

describe("BootstrapRS.run DSPy parity", () => {
  it.effect("matches fixture-backed candidate catalog and best-candidate selection contracts", () =>
    Effect.gen(function*() {
      const rawFixture = yield* loadFixture("dspy.bootstraprs.candidate-catalog.seed-9")
      const fixture = yield* Schema.decodeUnknown(BootstrapRSCandidateCatalogFixtureSchema)(rawFixture)

      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa-bootstraprs-dspy-parity", signature)
      const initial = yield* Ref.get(module.params)

      yield* Ref.set(
        module.params,
        new ModuleParameters({
          instructions: initial.instructions,
          demos: initial.demos,
          outputStrategy: "structured"
        })
      )
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Match.value(prompt).pipe(
            Match.when(Str.includes("What is the capital of France?"), () => ({ answer: "Paris" })),
            Match.when(Str.includes("What is the capital of Japan?"), () => ({ answer: "Tokyo" })),
            Match.when(Str.includes("Name the capital of Japan in one word"), (prompt) =>
              Bool.match(Str.includes("Tokyo")(prompt), {
                onTrue: () => ({ answer: "Tokyo" }),
                onFalse: () => ({ answer: "London" })
              })),
            Match.orElse(() => ({ answer: "London" }))
          )
        )
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const optimized = yield* BootstrapRS.run({
        module,
        trainset: toExamples(fixture.payload.trainset),
        valset: toExamples(fixture.payload.valset),
        metric: Metric.exactMatch("answer"),
        numCandidates: fixture.payload.numCandidates,
        seeds: fixture.payload.seeds,
        maxRounds: fixture.payload.maxRounds,
        maxBootstrappedDemos: fixture.payload.maxBootstrappedDemos,
        maxLabeledDemos: fixture.payload.maxLabeledDemos,
        threshold: fixture.payload.threshold,
        fallbackToLabeledFewShot: false
      }).pipe(Effect.provide(lmLayer))

      const params = yield* Ref.get(optimized.params)
      const calls = yield* Ref.get(mock.calls)
      const demoQuestions = Arr.map(
        params.demos,
        (demo) => String(Option.getOrElse(Option.fromNullable(demo.input.question), () => ""))
      )

      expect(demoQuestions).toStrictEqual(fixture.payload.expectedBestDemoQuestions)
      expect(calls).toHaveLength(fixture.payload.expectedCallCount)
    }))
})
