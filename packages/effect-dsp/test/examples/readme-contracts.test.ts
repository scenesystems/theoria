import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Ref, Schema, Stream } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import { SearchSpace } from "effect-search"

const BASELINE_INSTRUCTION = "Answer questions with concise facts"
const IMPROVED_INSTRUCTION = "Answer questions with concise facts and verify the city against geographic knowledge."

const optimizerTrainset = Arr.make(
  new Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  })
)

const moduleExampleResult = Effect.gen(function*() {
  const signature = yield* Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )
  const inner = yield* Module.predict("qa-readme-module-example-inner", signature)
  const parallel = yield* Module.parallel({
    name: "qa-readme-module-example",
    module: inner,
    concurrency: 2
  })

  return yield* parallel.forward({
    inputs: [
      { question: "What is the capital of France?" },
      { question: "What is the capital of Japan?" }
    ]
  }).pipe(
    Effect.provide(
      MockLanguageModel.layer(
        LanguageModel.LanguageModel,
        MockLanguageModel.sequence([{ answer: "Paris" }, { answer: "Tokyo" }])
      )
    )
  )
})

const coproResponseForPrompt = (prompt: string) =>
  prompt.includes("COPRO seed instruction proposer") || prompt.includes("COPRO refinement instruction proposer")
    ? { instruction: IMPROVED_INSTRUCTION }
    : prompt.includes("What is the capital of France?")
    ? { answer: "Paris" }
    : prompt.includes("What is the capital of Japan?") && prompt.includes(IMPROVED_INSTRUCTION)
    ? { answer: "Tokyo" }
    : prompt.includes("What is the capital of Japan?")
    ? { answer: "London" }
    : { answer: "Unknown" }

const optimizerExampleResult = Effect.gen(function*() {
  const signature = yield* Signature.make(
    BASELINE_INSTRUCTION,
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )
  const module = yield* Module.predict("qa-readme-copro-example", signature)
  const params = yield* Ref.get(module.params)

  yield* Ref.set(
    module.params,
    new ModuleParams({
      instructions: params.instructions,
      demos: params.demos,
      outputStrategy: "structured"
    })
  )

  const events = yield* Stream.runCollect(
    Optimizer.coproStream({
      module,
      trainset: optimizerTrainset,
      valset: optimizerTrainset,
      metric: Metric.exactMatch("answer"),
      numCandidates: 3,
      maxSteps: 2,
      seed: 17
    })
  ).pipe(
    Effect.provide(
      MockLanguageModel.layer(LanguageModel.LanguageModel, MockLanguageModel.map(coproResponseForPrompt))
    )
  )

  const eventList = yield* Schema.decodeUnknown(Schema.Array(Optimizer.COPROEventSchema))(Arr.fromIterable(events))
  const summary = Optimizer.COPROEventSummary.summarize(eventList)
  const optimizedParams = yield* Ref.get(module.params)

  return {
    bestInstruction: optimizedParams.instructions,
    completed: summary.completed,
    bestScore: summary.bestScore
  }
})

const interopExampleResult = Effect.scoped(
  Effect.gen(function*() {
    const space = yield* SearchSpace.make({
      x: SearchSpace.float(0, 1)
    })
    const sampler = Optimizer.effectSearchInterop.Sampler.tpe({
      seed: 345,
      acquisition: "thompson"
    })
    const handle = yield* Optimizer.effectSearchInterop.open({
      direction: "maximize",
      space,
      sampler,
      trials: 1,
      objective: (config) => Effect.succeed(config.x),
      concurrency: 1
    })
    const asked = yield* Optimizer.effectSearchInterop.ask(handle)

    yield* Optimizer.effectSearchInterop.tell(handle, asked.trialNumber, asked.config.x)

    return Optimizer.effectSearchInterop.resultSummary(
      yield* Optimizer.effectSearchInterop.result(handle)
    )
  })
)

describe("examples/readme-contracts", () => {
  it.effect("keeps a shipped module example runnable under mock layers", () =>
    Effect.gen(function*() {
      const result = yield* moduleExampleResult

      expect(result.outputs.map((entry) => entry.answer)).toStrictEqual(["Paris", "Tokyo"])
    }))

  it.effect("keeps the deterministic COPRO example runnable under mock layers", () =>
    Effect.gen(function*() {
      const result = yield* optimizerExampleResult

      expect(result.bestInstruction).toBe(IMPROVED_INSTRUCTION)
      expect(result.completed).toBe(true)
      expect(result.bestScore).toBe(1)
    }))

  it.effect("keeps the effect-search interop example runnable", () =>
    Effect.gen(function*() {
      const summary = yield* interopExampleResult

      expect(summary.kind).toBe("SingleObjective")
      expect(summary.trialCount).toBe(1)
      expect(summary.paretoCount).toBe(1)
    }))
})
