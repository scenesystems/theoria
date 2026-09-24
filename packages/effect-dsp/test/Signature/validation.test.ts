/**
 * Signature validation and default instruction derivation.
 */
import { describe, expect, it } from "@effect/vitest"
import type { SignatureError } from "@scenesystems/effect-dsp/DspError"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Cause, Effect, Exit, Option, Schema } from "effect"

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
    it.effect("keeps wire names paired with their own annotations and decoded defaults", () =>
      Effect.gen(function*() {
        const signature = yield* Signature.make("Project fields", {
          first: Schema.propertySignature(Signature.describe(Schema.String, "value fallback")).pipe(
            Schema.fromKey("zeta")
          ).annotations({ [Signature.FieldDescriptionId]: "property description" }),
          second: Schema.propertySignature(Schema.NumberFromString).pipe(Schema.fromKey("alpha")).annotations({
            [Signature.FieldDescriptionId]: "encoded count"
          }),
          optional: Schema.optionalWith(Schema.String, { default: () => "fallback" }).annotations({
            [Signature.FieldDescriptionId]: "default text"
          })
        }, {
          answer: Schema.propertySignature(Signature.describe(Schema.String, "result text")).pipe(
            Schema.fromKey("omega")
          )
        })

        expect(signature.instructions).toBe(
          "Task: Project fields\nInput fields: zeta (property description), alpha (encoded count), optional (default text)\nOutput fields: omega (result text)"
        )
        expect(Arr.map(signature.fields, (field) => field.name)).toEqual(
          Arr.make("first", "second", "optional", "answer")
        )
        expect(yield* Schema.decodeUnknown(signature.inputSchema)({ zeta: "input", alpha: "7" })).toEqual({
          first: "input",
          second: 7,
          optional: "fallback"
        })
      }))

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
          `Task: Answer questions with concise facts\nInput fields: question (The question to answer), context (Optional supporting context)\nOutput fields: answer (A short factual answer)`
        )
      }))
  })
})
