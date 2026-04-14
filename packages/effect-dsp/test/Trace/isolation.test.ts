/**
 * Trace isolation contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer } from "effect"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"
import { conciseFactsQaSignature } from "../helpers/qa-signatures.js"

describe("Trace isolation", () => {
  it.effect("keeps concurrent trace scopes isolated per wrapped execution", () =>
    Effect.gen(function*() {
      const qa = yield* conciseFactsQaSignature
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
