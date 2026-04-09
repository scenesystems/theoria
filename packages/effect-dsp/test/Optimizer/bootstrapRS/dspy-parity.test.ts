import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Ref, Schema } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import { MockLanguageModel } from "effect-dsp/test"

import { BootstrapRSCandidateCatalogFixtureSchema, FixtureRegistry } from "../../helpers/dspy-fixtures/index.js"
import { conciseFactsQaSignature } from "../../helpers/qa-signatures.js"

const toExamples = (entries: ReadonlyArray<{ readonly question: string; readonly answer: string }>) =>
  Arr.map(
    entries,
    (entry) =>
      new Example({
        input: { question: entry.question },
        output: { answer: entry.answer }
      })
  )

describe("Optimizer.bootstrapRS DSPy parity", () => {
  it.effect("matches fixture-backed candidate catalog and best-candidate selection contracts", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const rawFixture = yield* registry.load("dspy.bootstraprs.candidate-catalog.seed-9")
      const fixture = yield* Schema.decodeUnknown(BootstrapRSCandidateCatalogFixtureSchema)(rawFixture)

      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa-bootstraprs-dspy-parity", signature)
      const initial = yield* Ref.get(module.params)

      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: initial.instructions,
          demos: initial.demos,
          outputStrategy: "structured"
        })
      )
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) => {
          if (prompt.includes("What is the capital of France?")) {
            return { answer: "Paris" }
          }

          if (prompt.includes("What is the capital of Japan?")) {
            return { answer: "Tokyo" }
          }

          if (prompt.includes("Name the capital of Japan in one word")) {
            return prompt.includes("Tokyo")
              ? { answer: "Tokyo" }
              : { answer: "London" }
          }

          return { answer: "London" }
        })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const optimized = yield* Optimizer.bootstrapRS({
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
      const demoQuestions = Arr.map(params.demos, (demo) => String(demo.input.question ?? ""))

      expect(fixture.payload.expectedCandidateLabels).toHaveLength(fixture.payload.numCandidates + 2)
      expect(fixture.payload.expectedCandidateLabels).toContain(fixture.payload.expectedBestCandidateLabel)
      expect(demoQuestions).toStrictEqual(fixture.payload.expectedBestDemoQuestions)
      expect(calls).toHaveLength(fixture.payload.expectedCallCount)
    }))
})
