/**
 * Example contract: mock-backed COPRO flow.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Ref, Schema, Stream } from "effect"
import { Evaluate, Example, Metric, Module, Optimizer, Signature } from "effect-dsp"
import { ModuleParams } from "effect-dsp/contracts"
import { MockLanguageModel } from "effect-dsp/test"

const BASELINE_INSTRUCTION = "Answer questions with concise facts"
const IMPROVED_INSTRUCTION = "Answer questions with concise facts and verify the city against geographic knowledge."

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

const proposalForPrompt = (prompt: string) =>
  prompt.includes("COPRO seed instruction proposer") || prompt.includes("COPRO refinement instruction proposer")
    ? { instruction: IMPROVED_INSTRUCTION }
    : undefined

const answerForPrompt = (prompt: string) =>
  prompt.includes("What is the capital of France?")
    ? { answer: "Paris" }
    : prompt.includes("What is the capital of Japan?") && prompt.includes(IMPROVED_INSTRUCTION)
    ? { answer: "Tokyo" }
    : prompt.includes("What is the capital of Japan?")
    ? { answer: "London" }
    : { answer: "Unknown" }

const responseForPrompt = (prompt: string) => proposalForPrompt(prompt) ?? answerForPrompt(prompt)

describe("examples/19-copro-mock", () => {
  it.effect("runs deterministic COPRO optimization and projects effect-search-compatible envelopes", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make(
        BASELINE_INSTRUCTION,
        {
          question: Signature.describe(Schema.String, "The question to answer")
        },
        {
          answer: Signature.describe(Schema.String, "A concise factual answer")
        }
      )
      const module = yield* Module.predict("qa-copro-example-test", signature)
      const initialParams = yield* Ref.get(module.params)

      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: initialParams.instructions,
          demos: initialParams.demos,
          outputStrategy: "structured"
        })
      )

      const baseline = yield* Evaluate.run({
        module,
        examples: trainset,
        metrics: {
          exactMatch: Metric.exactMatch("answer")
        },
        concurrency: 1
      }).pipe(
        Effect.provide(
          MockLanguageModel.layer(LanguageModel.LanguageModel, MockLanguageModel.map(responseForPrompt))
        )
      )

      const snapshotRef = yield* Ref.make(Option.none<Optimizer.COPROSnapshot>())
      const events = yield* Stream.runCollect(
        Optimizer.coproStream({
          module,
          trainset,
          valset: trainset,
          metric: Metric.exactMatch("answer"),
          numCandidates: 3,
          maxSteps: 2,
          seed: 17,
          snapshotSink: (snapshot) => Ref.set(snapshotRef, Option.some(snapshot))
        })
      ).pipe(
        Effect.provide(
          MockLanguageModel.layer(LanguageModel.LanguageModel, MockLanguageModel.map(responseForPrompt))
        )
      )

      const optimized = yield* Evaluate.run({
        module,
        examples: trainset,
        metrics: {
          exactMatch: Metric.exactMatch("answer")
        },
        concurrency: 1
      }).pipe(
        Effect.provide(
          MockLanguageModel.layer(LanguageModel.LanguageModel, MockLanguageModel.map(responseForPrompt))
        )
      )

      const eventList = yield* Schema.decodeUnknown(Schema.Array(Optimizer.COPROEventSchema))(Arr.fromIterable(events))
      const summary = Optimizer.COPROEventSummary.summarize(eventList)
      const optimizedParams = yield* Ref.get(module.params)
      const snapshotOption = yield* Ref.get(snapshotRef)

      expect(baseline.overallScores.exactMatch).toBe(0.5)
      expect(optimized.overallScores.exactMatch).toBe(1)
      expect(summary.completed).toBe(true)
      expect(summary.bestScore).toBe(1)
      expect(optimizedParams.instructions).toBe(IMPROVED_INSTRUCTION)
      expect(Option.isSome(snapshotOption)).toBe(true)

      if (Option.isNone(snapshotOption)) {
        return
      }

      expect(Optimizer.COPROSnapshot.projectStudyEvents(snapshotOption.value).at(-1)?._tag).toBe("StudyCompleted")
      expect(Optimizer.COPROSnapshot.projectStudySnapshot(snapshotOption.value).completedCount).toBeGreaterThan(0)
    }))
})
