import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Ref, Schema } from "effect"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import { MockLanguageModel } from "effect-dsp/test"

import {
  BootstrapDemoBudgetFixtureSchema,
  BootstrapThresholdFilteringFixtureSchema,
  FixtureRegistry
} from "../../helpers/dspy-fixtures/index.js"
import { conciseFactsQaSignature } from "../../helpers/qa-signatures.js"

const responseForPrompt = (
  cases: ReadonlyArray<{
    readonly question: string
    readonly teacherAnswer: string
  }>,
  prompt: string
): string =>
  Option.getOrElse(
    Arr.findFirst(cases, (entry) => prompt.includes(entry.question)).pipe(
      Option.map((entry) => entry.teacherAnswer)
    ),
    () => ""
  )

const toTrainset = (
  cases: ReadonlyArray<{
    readonly question: string
    readonly expectedAnswer: string
  }>
) =>
  Arr.map(
    cases,
    (entry) =>
      new Example({
        input: { question: entry.question },
        output: { answer: entry.expectedAnswer }
      })
  )

describe("Optimizer.bootstrapFewShot DSPy parity", () => {
  it.effect("matches demo budget contracts from committed fixture", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const rawFixture = yield* registry.load("dspy.bootstrap.demo-budget.basic")
      const fixture = yield* Schema.decodeUnknown(BootstrapDemoBudgetFixtureSchema)(rawFixture)

      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa-bootstrap-demo-budget-dspy-parity", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) => ({
          answer: responseForPrompt(fixture.payload.trainset, prompt)
        }))
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const optimized = yield* Optimizer.bootstrapFewShot({
        module,
        trainset: toTrainset(fixture.payload.trainset),
        metric: Metric.exactMatch("answer"),
        maxRounds: fixture.payload.maxRounds,
        maxBootstrappedDemos: fixture.payload.maxBootstrappedDemos,
        threshold: fixture.payload.threshold,
        fallbackToLabeledFewShot: false
      }).pipe(Effect.provide(layer))

      const params = yield* Ref.get(optimized.params)
      const calls = yield* Ref.get(mock.calls)
      const demoQuestions = Arr.map(params.demos, (demo) => String(demo.input.question ?? ""))

      expect(demoQuestions).toStrictEqual(fixture.payload.expectedAcceptedQuestions)
      expect(params.demos).toHaveLength(fixture.payload.expectedFinalDemoCount)
      expect(calls).toHaveLength(fixture.payload.expectedCallCount)
    }))

  it.effect("matches threshold filtering contracts from committed fixture", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const rawFixture = yield* registry.load("dspy.bootstrap.threshold-filtering.basic")
      const fixture = yield* Schema.decodeUnknown(BootstrapThresholdFilteringFixtureSchema)(rawFixture)

      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa-bootstrap-threshold-dspy-parity", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) => ({
          answer: responseForPrompt(fixture.payload.trainset, prompt)
        }))
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const optimized = yield* Optimizer.bootstrapFewShot({
        module,
        trainset: toTrainset(fixture.payload.trainset),
        metric: Metric.exactMatch("answer"),
        maxRounds: fixture.payload.maxRounds,
        maxBootstrappedDemos: fixture.payload.maxBootstrappedDemos,
        threshold: fixture.payload.threshold,
        fallbackToLabeledFewShot: false
      }).pipe(Effect.provide(layer))

      const params = yield* Ref.get(optimized.params)
      const calls = yield* Ref.get(mock.calls)
      const demoQuestions = Arr.map(params.demos, (demo) => String(demo.input.question ?? ""))

      expect(demoQuestions).toStrictEqual(fixture.payload.expectedAcceptedQuestions)
      expect(params.demos).toHaveLength(fixture.payload.expectedFinalDemoCount)
      expect(calls).toHaveLength(fixture.payload.expectedCallCount)
      expect(
        Arr.every(
          fixture.payload.expectedRejectedQuestions,
          (question) => !Arr.contains(demoQuestions, question)
        )
      ).toBe(true)
    }))
})
