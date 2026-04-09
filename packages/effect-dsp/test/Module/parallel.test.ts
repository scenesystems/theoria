/**
 * Module.parallel contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Match, Ref } from "effect"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"
import { conciseFactsQaSignature } from "../helpers/qa-signatures.js"

const responseForPrompt = (prompt: string) =>
  Match.value(prompt).pipe(
    Match.when((candidate) => candidate.includes("Alpha"), () => ({ answer: "A" })),
    Match.when((candidate) => candidate.includes("Beta"), () => ({ answer: "B" })),
    Match.orElse(() => ({ answer: "C" }))
  )

const yieldsForPrompt = (prompt: string) =>
  Match.value(prompt).pipe(
    Match.when((candidate) => candidate.includes("Alpha"), () => 3),
    Match.when((candidate) => candidate.includes("Beta"), () => 1),
    Match.orElse(() => 2)
  )

describe("Module.parallel", () => {
  it.effect("preserves input ordering, bounded concurrency, and typed output aggregation across multiple inputs", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const active = yield* Ref.make(0)
      const maxActive = yield* Ref.make(0)
      const inner = yield* Module.predict("qa-parallel-inner", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction((prompt) =>
          Effect.acquireUseRelease(
            Ref.updateAndGet(active, (count) => count + 1),
            (currentActive) =>
              Effect.gen(function*() {
                yield* Ref.update(maxActive, (current) => Math.max(current, currentActive))
                yield* Effect.forEach(Arr.range(0, yieldsForPrompt(prompt) - 1), () => Effect.yieldNow(), {
                  discard: true
                })

                return responseForPrompt(prompt)
              }),
            () => Ref.update(active, (count) => count - 1)
          )
        )
      )
      const module = yield* Module.parallel({
        name: "qa-parallel",
        module: inner,
        concurrency: 2
      })
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* module.forward({
        inputs: [
          { question: "Alpha question" },
          { question: "Beta question" },
          { question: "Gamma question" }
        ]
      }).pipe(Effect.provide(lmLayer))
      const observedMaxActive = yield* Ref.get(maxActive)

      expect(result).toStrictEqual({
        outputs: [
          { answer: "A" },
          { answer: "B" },
          { answer: "C" }
        ]
      })
      expect(observedMaxActive).toBe(2)
    }))
})
