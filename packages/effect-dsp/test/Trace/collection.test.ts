/**
 * Trace collection contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"
import { conciseFactsQaSignature } from "../helpers/qa-signatures.js"

describe("Trace collection", () => {
  it.effect("collects entries only inside Trace.withTracing scope", () =>
    Effect.gen(function*() {
      const qa = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", qa)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      yield* module.forward({ question: "What is the capital of France?" }).pipe(
        Effect.provide(lmLayer)
      )

      const outsideTrace = yield* Trace.get
      const traced = yield* Trace.withTracing(
        module.forward({ question: "What is the capital of Japan?" }).pipe(
          Effect.provide(lmLayer)
        )
      )

      expect(outsideTrace).toEqual([])
      expect(traced[1]).toHaveLength(1)
      expect(traced[1][0]?.moduleName).toBe("qa")
    }))
})
