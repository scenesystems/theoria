/**
 * BootstrapFewShot optimization flow with a deterministic mock provider.
 *
 * Run: bun run examples/05-optimize-bootstrap-mock.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Ref, Schema } from "effect"
import { Evaluate, Example, Metric, Module, Optimizer, Signature } from "effect-dsp"
import { ModuleParams } from "effect-dsp/contracts"
import { MockLanguageModel } from "effect-dsp/test"
import { mockLanguageModelLayer } from "./shared/mock-language-model.js"

const trainset = Arr.make(
  new Example.Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example.Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  })
)

const evalset = Arr.make(
  new Example.Example({
    input: { question: "What is the capital of Italy?" },
    output: { answer: "Rome" }
  })
)

const responseForPrompt = (prompt: string) =>
  prompt.includes("What is the capital of France?")
    ? { answer: "Paris" }
    : prompt.includes("What is the capital of Japan?")
    ? { answer: "Tokyo" }
    : prompt.includes("What is the capital of Italy?")
    ? prompt.includes("Paris") && prompt.includes("Tokyo")
      ? { answer: "Rome" }
      : { answer: "Milan" }
    : { answer: "Unknown" }

const program = Effect.gen(function*() {
  const qaSignature = yield* Signature.make(
    "Answer geography questions with concise city names",
    {
      question: Signature.describe(Schema.String, "Question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "Short factual answer")
    }
  )

  const qa = yield* Module.predict("qa-bootstrap", qaSignature)
  const params = yield* Ref.get(qa.params)

  yield* Ref.set(
    qa.params,
    new ModuleParams({
      instructions: params.instructions,
      demos: params.demos,
      outputStrategy: "structured"
    })
  )

  const metrics = {
    exactMatch: Metric.exactMatch("answer")
  }
  const baseline = yield* Evaluate.run({
    module: qa,
    examples: evalset,
    metrics,
    concurrency: 1
  })

  yield* Optimizer.bootstrapFewShot({
    module: qa,
    trainset,
    metric: Metric.exactMatch("answer"),
    maxRounds: 2,
    maxBootstrappedDemos: 2,
    threshold: 1,
    fallbackToLabeledFewShot: false
  })

  const optimized = yield* Evaluate.run({
    module: qa,
    examples: evalset,
    metrics,
    concurrency: 1
  })
  const optimizedParams = yield* Ref.get(qa.params)

  yield* Effect.log("optimize-bootstrap-mock", {
    baselineExactMatch: baseline.overallScores.exactMatch,
    optimizedExactMatch: optimized.overallScores.exactMatch,
    learnedDemoCount: optimizedParams.demos.length
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
