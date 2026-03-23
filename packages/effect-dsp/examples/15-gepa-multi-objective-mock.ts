/**
 * GEPA multi-objective optimization with a deterministic mock provider.
 *
 * Demonstrates:
 * - `Optimizer.gepaStream` for streaming GEPA lifecycle events
 * - `Metric.fromEffect` for feedback-rich scoring (required by GEPA reflection)
 * - `Metric.compose` for multi-metric evaluation
 * - Baseline vs optimized evaluation via `Evaluate.run`
 * - Deterministic seeded execution for reproducible runs
 *
 * Run: bun run examples/15-gepa-multi-objective-mock.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Option, Predicate, Ref, Schema, Stream } from "effect"
import { Evaluate, Example, Metric, Module, Optimizer, Signature } from "effect-dsp"
import { MockLanguageModel } from "effect-dsp/test"
import { mockLanguageModelLayer } from "./shared/mock-language-model.js"

const fieldText = (record: Readonly<Record<string, unknown>>, field: string): string =>
  Option.getOrElse(
    Option.fromNullable(record[field]).pipe(Option.filter(Predicate.isString)),
    () => ""
  )

const trainset = Arr.make(
  new Example.Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example.Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  }),
  new Example.Example({
    input: { question: "What is the capital of Germany?" },
    output: { answer: "Berlin" }
  })
)

const valset = Arr.make(
  new Example.Example({
    input: { question: "What is the capital of Italy?" },
    output: { answer: "Rome" }
  }),
  new Example.Example({
    input: { question: "What is the capital of Spain?" },
    output: { answer: "Madrid" }
  })
)

const responseForPrompt = (prompt: string): Readonly<Record<string, string>> =>
  prompt.includes("France")
    ? { answer: "Paris" }
    : prompt.includes("Japan")
    ? { answer: "Tokyo" }
    : prompt.includes("Germany")
    ? { answer: "Berlin" }
    : prompt.includes("Italy")
    ? { answer: "Rome" }
    : prompt.includes("Spain")
    ? { answer: "Madrid" }
    : { answer: "Unknown" }

const feedbackMetric = Metric.fromEffect(
  "feedback-exact",
  (prediction, expected) =>
    Effect.sync(() => {
      const predicted = fieldText(prediction, "answer")
      const expectedAnswer = fieldText(expected, "answer")
      const correct = predicted === expectedAnswer

      return new Metric.Result({
        score: correct ? 1 : 0,
        feedback: correct
          ? "correct"
          : `expected ${expectedAnswer}, got ${predicted}`
      })
    })
)

const program = Effect.gen(function*() {
  const qaSignature = yield* Signature.make(
    "Answer geography questions with concise capital city names",
    {
      question: Signature.describe(Schema.String, "Geography question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "The capital city name")
    }
  )

  const qa = yield* Module.predict("qa-gepa-multi", qaSignature)

  const exactMatchMetric = Metric.exactMatch("answer")
  const composedMetric = Metric.compose({ exactMatch: exactMatchMetric, feedback: feedbackMetric })

  const baseline = yield* Evaluate.run({
    module: qa,
    examples: valset,
    metrics: { exactMatch: exactMatchMetric },
    concurrency: 1
  })

  const events = yield* Stream.runCollect(
    Optimizer.gepaStream({
      module: qa,
      trainset,
      metric: feedbackMetric,
      maxIterations: 3,
      seed: 42
    })
  )

  const eventList = Arr.fromIterable(events)
  const paretoUpdates = Arr.filter(eventList, Optimizer.GEPAEvent.$is("ParetoUpdated"))

  const optimized = yield* Evaluate.run({
    module: qa,
    examples: valset,
    metrics: { exactMatch: exactMatchMetric, composed: composedMetric },
    concurrency: 1
  })

  const finalParams = yield* Ref.get(qa.params)

  yield* Effect.log("gepa-multi-objective-mock", {
    baselineExactMatch: baseline.overallScores.exactMatch,
    optimizedExactMatch: optimized.overallScores.exactMatch,
    optimizedComposed: optimized.overallScores.composed,
    paretoUpdateCount: paretoUpdates.length,
    totalEvents: eventList.length,
    finalInstructions: finalParams.instructions
  })
})

BunRuntime.runMain(
  program.pipe(
    Effect.provide(
      mockLanguageModelLayer(
        MockLanguageModel.map(responseForPrompt)
      )
    )
  )
)
