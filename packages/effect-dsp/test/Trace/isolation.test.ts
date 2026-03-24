/**
 * Trace isolation contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Schema } from "effect"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"

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

describe("Trace isolation", () => {
  it.effect("keeps concurrent trace scopes isolated per wrapped execution", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const module = yield* Module.predict("qa", qa)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const questions = [
        "What is the capital of France?",
        "What is the capital of Japan?"
      ]

      const tracedRuns = yield* Effect.forEach(
        questions,
        (question) =>
          Trace.withTracing(
            module.forward({ question }).pipe(
              Effect.provide(lmLayer)
            )
          ),
        { concurrency: "unbounded" }
      )

      yield* Effect.forEach(
        Arr.zip(questions, tracedRuns),
        ([question, traced]) =>
          Effect.sync(() => {
            const entries = traced[1]
            expect(entries).toHaveLength(1)
            expect(entries[0]?.prompt).toContain(question)
          }),
        { discard: true }
      )
    }))
})
