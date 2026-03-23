/**
 * Signature.make: creation, field extraction, type-level correctness.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"
import * as Signature from "effect-dsp/Signature"

describe("Signature", () => {
  describe("make", () => {
    it.effect("creates a signature with input and output fields", () =>
      Effect.gen(function*() {
        const sig = yield* Signature.make(
          "Answer questions",
          { question: Schema.String },
          { answer: Schema.String }
        )

        expect(sig.description).toBe("Answer questions")
        expect(sig.fields).toHaveLength(2)
      }))

    it.effect("extracts field names", () =>
      Effect.gen(function*() {
        const sig = yield* Signature.make(
          "test",
          { x: Schema.Number },
          { y: Schema.String }
        )

        const names = sig.fields.map((f) => f.name)
        expect(names).toContain("x")
        expect(names).toContain("y")
      }))

    it.effect("preserves input and output schemas", () =>
      Effect.gen(function*() {
        const sig = yield* Signature.make(
          "test",
          { question: Schema.String },
          { answer: Schema.String }
        )

        expect(sig.inputSchema).toBeDefined()
        expect(sig.outputSchema).toBeDefined()
      }))
  })

  describe("describe", () => {
    it.effect("attaches description annotation to a field", () =>
      Effect.gen(function*() {
        const sig = yield* Signature.make(
          "QA",
          { question: Signature.describe(Schema.String, "The question to answer") },
          { answer: Signature.describe(Schema.String, "A concise answer") }
        )
        const questionField = sig.fields.find((f) => f.name === "question")
        const description = Option.flatMap(Option.fromNullable(questionField), (field) => field.description)

        expect(description).toEqual(Option.some("The question to answer"))
      }))
  })
})
