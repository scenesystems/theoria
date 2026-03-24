/**
 * Signature validation and default instruction derivation.
 */
import { describe, expect, it } from "@effect/vitest"
import { Cause, Effect, Exit, Option, Schema } from "effect"
import type { SignatureError } from "effect-dsp/Errors"
import * as Signature from "effect-dsp/Signature"

describe("Signature", () => {
  describe("validation", () => {
    it.effect("rejects empty input fields", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(
          Signature.make(
            "Answer questions",
            {},
            { answer: Schema.String }
          )
        )

        const failure = Exit.match(exit, {
          onFailure: Cause.failureOption,
          onSuccess: () => Option.none<SignatureError>()
        })

        expect(Option.isSome(failure)).toBe(true)
      }))

    it.effect("rejects empty output fields", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(
          Signature.make(
            "Answer questions",
            { question: Schema.String },
            {}
          )
        )

        const failure = Exit.match(exit, {
          onFailure: Cause.failureOption,
          onSuccess: () => Option.none<SignatureError>()
        })

        expect(Option.isSome(failure)).toBe(true)
      }))

    it.effect("rejects overlapping input and output field names", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(
          Signature.make(
            "Answer questions",
            { answer: Schema.String },
            { answer: Schema.String }
          )
        )

        const failure = Exit.match(exit, {
          onFailure: Cause.failureOption,
          onSuccess: () => Option.none<SignatureError>()
        })

        expect(Option.isSome(failure)).toBe(true)
      }))
  })

  describe("default instructions", () => {
    it.effect("derives instructions from description and field metadata", () =>
      Effect.gen(function*() {
        const signature = yield* Signature.make(
          "Answer questions with concise facts",
          {
            question: Signature.describe(Schema.String, "The question to answer"),
            context: Signature.describe(Schema.String, "Optional supporting context")
          },
          {
            answer: Signature.describe(Schema.String, "A short factual answer")
          }
        )

        expect(signature.instructions).toBe(
          "Task: Answer questions with concise facts\n" +
            "Input fields: question (The question to answer), context (Optional supporting context)\n" +
            "Output fields: answer (A short factual answer)"
        )
      }))
  })
})
