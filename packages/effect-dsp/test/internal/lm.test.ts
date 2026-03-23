/**
 * LM adapter tests: ensure generateObject/generateText dispatch paths.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Ref, Schema } from "effect"
import { MockLanguageModel } from "effect-dsp/test"
import { callLm, callLmText } from "../../src/internal/lm.js"

const AnswerSchema = Schema.Struct({ answer: Schema.String })

describe("internal/lm", () => {
  it.effect("callLm routes through LanguageModel.generateObject", () =>
    Effect.gen(function*() {
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )

      const result = yield* callLm(
        "What is the capital of France?",
        AnswerSchema
      ).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      const calls = yield* Ref.get(mock.calls)

      expect(result).toEqual({ answer: "Paris" })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe("generateObject")
    }))

  it.effect("callLmText routes through LanguageModel.generateText", () =>
    Effect.gen(function*() {
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed("Paris")
      )

      const result = yield* callLmText("Answer with one token").pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      const calls = yield* Ref.get(mock.calls)

      expect(result).toBe("Paris")
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe("generateText")
    }))

  it.effect("failing strategy uses typed UnknownError channel", () =>
    Effect.gen(function*() {
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.failing("forced failure")
      )

      const recovered = yield* callLmText("Answer with one token").pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service)),
        Effect.catchTag("UnknownError", (error) => Effect.succeed(error.message))
      )

      const calls = yield* Ref.get(mock.calls)

      expect(recovered).toContain("MockLanguageModel.failing strategy requested an expected failure")
      expect(calls).toEqual([])
    }))

  it.effect("empty sequence strategy uses typed UnknownError channel", () =>
    Effect.gen(function*() {
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([])
      )

      const recovered = yield* callLmText("Answer with one token").pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service)),
        Effect.catchTag("UnknownError", (error) => Effect.succeed(error.message))
      )

      const calls = yield* Ref.get(mock.calls)

      expect(recovered).toContain("MockLanguageModel.sequence requires at least one response")
      expect(calls).toEqual([])
    }))
})
