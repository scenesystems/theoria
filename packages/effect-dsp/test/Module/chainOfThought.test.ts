/**
 * Module.chainOfThought contracts.
 */
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Context, Effect, Number, Record, Ref, Schema, SchemaGetter } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"

class DecodeOffset extends Context.Service<DecodeOffset, number>()("chainOfThought/DecodeOffset") {}
class EncodeOffset extends Context.Service<EncodeOffset, number>()("chainOfThought/EncodeOffset") {}

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

describe("Module.chainOfThought", () => {
  it.effect("retains independent codec service channels and optional defaulted fields", () =>
    Effect.gen(function*() {
      const count = Schema.Finite.pipe(Schema.decodeTo(Schema.Finite, {
        decode: SchemaGetter.transformEffect((value) =>
          Effect.map(DecodeOffset, (offset) => Number.sum(value, offset))
        ),
        encode: SchemaGetter.transformEffect((value) =>
          Effect.map(EncodeOffset, (offset) => Number.subtract(value, offset))
        )
      }))
      const signature = yield* Signature.fromSchemas(
        "Count",
        Schema.Struct({ question: Schema.String }),
        Schema.Struct({
          count,
          label: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed("default")))
        }).pipe(Schema.encodeKeys({ count: "total" }))
      )
      const cot = yield* Module.chainOfThought("service-cot", signature)
      const decode = Schema.decodeEffect(cot.signature.outputSchema)({ reasoning: "Counted", total: 3 })
      expectTypeOf(decode).toEqualTypeOf<
        Effect.Effect<
          { readonly reasoning: string; readonly count: number; readonly label: string },
          Schema.SchemaError,
          DecodeOffset
        >
      >()
      const result = yield* decode.pipe(Effect.provideService(DecodeOffset, 7))
      const encode = Schema.encodeEffect(cot.signature.outputSchema)(result)
      expectTypeOf<Effect.Services<typeof encode>>().toEqualTypeOf<EncodeOffset>()
      const wire = yield* encode.pipe(Effect.provideService(EncodeOffset, 2))
      expect(result).toEqual({ reasoning: "Counted", count: 10, label: "default" })
      expect(wire).toEqual({ reasoning: "Counted", total: 8, label: "default" })
    }))

  it.effect("preserves renamed input and output codecs when adding reasoning", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.fromSchemas(
        "Count a question",
        Schema.Struct({ question: Schema.String }).pipe(Schema.encodeKeys({ question: "prompt" })),
        Schema.Struct({ count: Schema.FiniteFromString }).pipe(Schema.encodeKeys({ count: "total" }))
      )
      const cot = yield* Module.chainOfThought("renamed-cot", signature)
      const encodedInput = yield* Schema.encodeEffect(cot.signature.inputSchema)({ question: "Three?" })
      const output = yield* Schema.decodeEffect(cot.signature.outputSchema)({ reasoning: "Counted", total: "3" })
      const encodedOutput = yield* Schema.encodeEffect(cot.signature.outputSchema)(output)
      expect(encodedInput).toEqual({ prompt: "Three?" })
      expect(output).toEqual({ reasoning: "Counted", count: 3 })
      expect(encodedOutput).toEqual({ reasoning: "Counted", total: "3" })
      expect(cot.signature.instructions).toContain("prompt")
      expect(cot.signature.instructions).toContain("total")
    }))

  it.effect("extends the output contract with reasoning and preserves structured predict runtime behavior", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({
          reasoning: "Paris is the capital city of France.",
          answer: "Paris"
        })
      )
      const cot = yield* Module.chainOfThought("qa-cot", qa)

      const result = yield* cot.forward({
        question: "What is the capital of France?"
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
      const calls = yield* Ref.get(mock.calls)

      expect(result).toEqual({
        reasoning: "Paris is the capital city of France.",
        answer: "Paris"
      })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe("generateObject")
      expect(Record.keys(cot.signature.outputFields)).toEqual(["reasoning", "answer"])
      expect(cot.signature.instructions).toContain("reasoning")
    }))

  it.effect("uses the same text-mode prompt/parse contracts as predict when demos are present", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(
          "[[ ## reasoning ## ]]\nParis is the capital city of France.\n\n[[ ## answer ## ]]\nParis"
        )
      )
      const cot = yield* Module.chainOfThought("qa-cot", qa)

      yield* Ref.update(
        cot.parameters,
        (parameters) =>
          new ModuleParameters({
            instructions: parameters.instructions,
            outputStrategy: "auto",
            demos: [
              new Demonstration({
                input: { question: "What is the capital of France?" },
                output: {
                  reasoning: "France's capital city is Paris.",
                  answer: "Paris"
                }
              })
            ]
          })
      )

      const result = yield* cot.forward({
        question: "What is the capital of Japan?"
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
      const calls = yield* Ref.get(mock.calls)

      expect(result).toEqual({
        reasoning: "Paris is the capital city of France.",
        answer: "Paris"
      })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe("generateText")
      expect(calls[0]?.prompt).toContain("[[ ## reasoning ## ]]")
      expect(calls[0]?.prompt).toContain("[[ ## answer ## ]]")
    }))
})
