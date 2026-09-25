/**
 * Signature validation and default instruction derivation.
 */
import { describe, expect, it } from "@effect/vitest"
import type { SignatureError } from "@scenesystems/effect-dsp/DspError"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Cause, Effect, Exit, FastCheck, Option, Ref, Schema } from "effect"

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
    it.effect.prop("keeps ordered string instructions distinct from symbol metadata on every construction", {
      requiredDescription: FastCheck.string(),
      optionalDescription: FastCheck.string(),
      hiddenDescription: FastCheck.string()
    }, ({ requiredDescription, optionalDescription, hiddenDescription }) =>
      Effect.gen(function*() {
        const hidden = Symbol.for("@scenesystems/effect-dsp/test/Signature/hidden")
        const fields = {
          "10": Signature.describe(Schema.String, requiredDescription),
          "2": Schema.optional(Schema.String).annotations({ [Signature.FieldDescriptionId]: optionalDescription }),
          zeta: Schema.propertySignature(Signature.describe(Schema.String, "value meaning")).annotations({
            [Signature.FieldDescriptionId]: "property meaning"
          }),
          alpha: Schema.UndefinedOr(Schema.String)
        }
        const operation = Signature.make("Ordered fields", fields, { answer: Schema.String })
        const first = yield* operation
        const repeated = yield* operation
        const withSymbol = yield* Signature.make("Ordered fields", {
          ...fields,
          [hidden]: Signature.describe(Schema.String, hiddenDescription)
        }, { answer: Schema.String })
        const expected =
          `Task: Ordered fields\nInput fields: 2 (${optionalDescription}), 10 (${requiredDescription}), zeta (property meaning), alpha\nOutput fields: answer`
        expect(first.instructions).toBe(expected)
        expect(repeated.instructions).toBe(expected)
        expect(withSymbol.instructions).toBe(expected)
        expect(Arr.map(first.fields, (field) => field.name)).toEqual(["2", "10", "zeta", "alpha", "answer"])
        expect(Arr.map(first.fields, (field) => field.isOptional)).toEqual([true, false, false, false, false])
        expect(Arr.map(first.fields, (field) => field.description)).toEqual([
          Option.some(optionalDescription),
          Option.some(requiredDescription),
          Option.some("property meaning"),
          Option.none(),
          Option.none()
        ])
        expect(Arr.map(withSymbol.fields, (field) => field.name)).toEqual([
          "2",
          "10",
          "zeta",
          "alpha",
          "Symbol(@scenesystems/effect-dsp/test/Signature/hidden)",
          "answer"
        ])
        expect(yield* Arr.head(repeated.fields)).not.toBe(yield* Arr.head(first.fields))
      }))

    it.effect.prop("preserves field metadata and wire instructions", {
      requiredDescription: FastCheck.string(),
      optionalDescription: FastCheck.string()
    }, ({ requiredDescription, optionalDescription }) =>
      Effect.gen(function*() {
        const signature = yield* Signature.make("Preserve metadata", {
          question: Schema.propertySignature(Signature.describe(Schema.String, requiredDescription)).pipe(
            Schema.fromKey("wire-question")
          ),
          context: Schema.optional(Schema.String).annotations({ [Signature.FieldDescriptionId]: optionalDescription })
        }, { answer: Schema.String })
        expect(signature.fields).toEqual(Arr.make(
          new Signature.FieldInfo({
            name: "question",
            description: Option.some(requiredDescription),
            isOptional: false
          }),
          new Signature.FieldInfo({ name: "context", description: Option.some(optionalDescription), isOptional: true }),
          new Signature.FieldInfo({ name: "answer", description: Option.none(), isOptional: false })
        ))
        expect(signature.instructions).toBe(
          `Task: Preserve metadata\nInput fields: wire-question (${requiredDescription}), context (${optionalDescription})\nOutput fields: answer`
        )
      }))

    it.effect("keeps metadata admission independent after a malformed annotation", () =>
      Effect.gen(function*() {
        const description = yield* Ref.make<unknown>(7)
        const operation = Effect.gen(function*() {
          const current = yield* Ref.get(description)
          return yield* Signature.make("Read current metadata", {
            question: Schema.String.annotations({ [Signature.FieldDescriptionId]: current })
          }, { answer: Schema.String })
        })
        const cause = yield* operation.pipe(Effect.sandbox, Effect.flip)
        expect(Cause.pretty(cause)).toContain("@scenesystems/effect-dsp/Signature/FieldInfo (Constructor)")
        expect(Cause.pretty(cause)).toContain("Expected string, actual 7")

        yield* Ref.set(description, "first meaning")
        const first = yield* Arr.head((yield* operation).fields)
        const repeated = yield* Arr.head((yield* operation).fields)
        expect(first).toEqual(
          new Signature.FieldInfo({
            name: "question",
            description: Option.some("first meaning"),
            isOptional: false
          })
        )
        expect(repeated).not.toBe(first)

        yield* Ref.set(description, "second meaning")
        const second = yield* Arr.head((yield* operation).fields)
        expect(second).toEqual(
          new Signature.FieldInfo({
            name: "question",
            description: Option.some("second meaning"),
            isOptional: false
          })
        )
        expect(second).not.toBe(first)
      }))

    it.effect("projects nested and suspended schemas without confusing value unions and optional properties", () =>
      Effect.gen(function*() {
        const signature = yield* Signature.make("Project ordinary fields", {
          maybe: Signature.describe(Schema.UndefinedOr(Schema.String), "required value union"),
          nested: Signature.describe(Schema.Struct({ count: Schema.NumberFromString }), "nested count"),
          tuple: Signature.describe(Schema.Tuple(Schema.NumberFromString), "tuple count"),
          union: Signature.describe(Schema.Union(Schema.NumberFromString, Schema.Boolean), "choice"),
          deferred: Signature.describe(Schema.suspend(() => Schema.NumberFromString), "deferred count"),
          optional: Schema.optional(Schema.String).annotations({ [Signature.FieldDescriptionId]: "optional property" })
        }, { answer: Schema.String })

        expect(signature.instructions).toBe(
          "Task: Project ordinary fields\nInput fields: maybe (required value union), nested (nested count), tuple (tuple count), union (choice), deferred (deferred count), optional (optional property)\nOutput fields: answer"
        )
        expect(Arr.map(signature.fields, (field) => field.isOptional)).toEqual(
          Arr.make(false, false, false, false, false, true, false)
        )
        expect(
          yield* Schema.decodeUnknown(signature.inputSchema)({
            maybe: undefined,
            nested: { count: "13" },
            tuple: ["7"],
            union: false,
            deferred: "29"
          })
        ).toEqual({ maybe: undefined, nested: { count: 13 }, tuple: [7], union: false, deferred: 29 })
      }))

    it.effect("retains domain description overrides and falls back to wire descriptions", () =>
      Effect.gen(function*() {
        const signature = yield* Signature.make("Resolve descriptions", {
          question: Schema.transform(
            Signature.describe(Schema.String, "wire question"),
            Signature.describe(Schema.String, "domain question"),
            { strict: true, decode: (value) => value, encode: (value) => value }
          ),
          context: Schema.transform(Signature.describe(Schema.String, "wire context"), Schema.String, {
            strict: true,
            decode: (value) => value,
            encode: (value) => value
          })
        }, { answer: Signature.describe(Schema.String, "answer meaning") })

        expect(signature.instructions).toBe(
          "Task: Resolve descriptions\nInput fields: question (domain question), context (wire context)\nOutput fields: answer (answer meaning)"
        )
        expect(Arr.map(signature.fields, (field) => field.description)).toEqual(
          Arr.make(Option.some("domain question"), Option.none(), Option.some("answer meaning"))
        )
      }))

    it.effect("rejects malformed wire annotations even when a valid domain description overrides them", () =>
      Effect.gen(function*() {
        const malformed = Schema.String.annotations({ [Signature.FieldDescriptionId]: 7 })
        const valid = Signature.describe(Schema.String, "valid description")
        const schemas = Arr.make(
          Schema.transform(malformed, valid, { strict: true, decode: (value) => value, encode: (value) => value }),
          Schema.transform(valid, malformed, { strict: true, decode: (value) => value, encode: (value) => value })
        )
        yield* Effect.forEach(schemas, (question) =>
          Effect.gen(function*() {
            const cause = yield* Signature.make("Reject malformed annotations", { question }, { answer: Schema.String })
              .pipe(Effect.sandbox, Effect.flip)
            expect(Cause.pretty(cause)).toContain("@scenesystems/effect-dsp/Signature/FieldInfo (Constructor)")
            expect(Cause.pretty(cause)).toContain("Expected string, actual 7")
          }))
      }))

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
