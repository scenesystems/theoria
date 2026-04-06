/**
 * Module.parallel concurrency contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Ref, Schema } from "effect"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

import { branchForPrompt, loadParallelConcurrencyFixture } from "../helpers/parallel-fixtures.js"

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

describe("Module.parallel concurrency", () => {
  it.effect("proves the concurrency option is real, bounded, and order-preserving under deterministic delayed modules", () =>
    Effect.gen(function*() {
      const fixture = yield* loadParallelConcurrencyFixture
      const signature = yield* makeQaSignature()
      const active = yield* Ref.make(0)
      const maxActive = yield* Ref.make(0)
      const inner = yield* Module.predict("qa-parallel-concurrency-inner", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction((prompt) => {
          const branch = branchForPrompt(fixture, prompt)

          return Effect.acquireUseRelease(
            Ref.updateAndGet(active, (count) => count + 1),
            (currentActive) =>
              Effect.gen(function*() {
                yield* Ref.update(maxActive, (current) => Math.max(current, currentActive))
                yield* Effect.forEach(Arr.range(0, branch.yieldCount - 1), () => Effect.yieldNow(), {
                  discard: true
                })

                return { answer: branch.answer }
              }),
            () => Ref.update(active, (count) => count - 1)
          )
        })
      )
      const module = yield* Module.parallel({
        name: "qa-parallel-concurrency",
        module: inner,
        concurrency: fixture.payload.concurrency,
        failurePolicy: fixture.payload.failurePolicy
      })
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* module.forward({
        inputs: Arr.map(fixture.payload.branches, (branch) => ({ question: branch.question }))
      }).pipe(Effect.provide(lmLayer))
      const observedMaxActive = yield* Ref.get(maxActive)

      expect(observedMaxActive).toBe(fixture.payload.expectedMaxConcurrency)
      expect(result.outputs.map((entry) => entry.answer)).toStrictEqual(fixture.payload.expectedOutputAnswers)
    }))
})
