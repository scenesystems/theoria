import { describe, expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { encode, Payload } from "@scenesystems/effect-dsp/Payload"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Effect, MutableRef, Schema, String, Tuple } from "effect"

describe("signature-owned demonstrations", () => {
  it.effect("validates destination wire fields and restores trace documents without domain decoding", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Nested values", {
        facts: Schema.Struct({ count: Schema.NumberFromString })
      }, { answers: Schema.Array(Schema.String) })
      const input = yield* encode(signature.inputSchema, { facts: { count: 7 } })
      const output = yield* encode(signature.outputSchema, { answers: Arr.make("Paris", "Tokyo") })
      const demo = yield* signature.demonstrationCodec.decodeDocuments(input, output)
      expect(demo.input).toEqual({ facts: { count: "7" } })
      expect(demo.output).toEqual({ answers: Arr.make("Paris", "Tokyo") })
      const leadingZeroDemo = new Demonstration({
        input: { facts: { count: "007" } },
        output: { answers: Arr.make("Paris", "Tokyo") }
      })
      const documents = yield* signature.demonstrationCodec.encode(leadingZeroDemo)
      expect(Tuple.getFirst(documents)).toBe("{\"facts\":{\"count\":\"007\"}}")
      expect(yield* signature.demonstrationCodec.decodeDocuments(Tuple.getFirst(documents), Tuple.getSecond(documents)))
        .toEqual(
          leadingZeroDemo
        )
      const failure = yield* signature.demonstrationCodec.decode({
        input: { question: "wrong stage" },
        output: demo.output
      })
        .pipe(Effect.flip)
      expect(failure._tag).toBe("ParseError")
    }))

  it.effect("rejects nested excess fields in trace documents rather than silently projecting them away", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Nested values", {
        facts: Schema.Struct({ count: Schema.NumberFromString })
      }, { answer: Schema.Struct({ label: Schema.String }) })
      const input = yield* Schema.decode(Payload)("{\"facts\":{\"count\":\"007\"}}")
      const output = yield* Schema.decode(Payload)("{\"answer\":{\"label\":\"yes\"}}")
      const extraInput = yield* Schema.decode(Payload)("{\"facts\":{\"count\":\"007\",\"provenance\":\"source-A\"}}")
      const extraOutput = yield* Schema.decode(Payload)("{\"answer\":{\"label\":\"yes\",\"confidence\":0.9}}")
      const inputFailure = yield* signature.demonstrationCodec.decodeDocuments(extraInput, output).pipe(Effect.flip)
      const outputFailure = yield* signature.demonstrationCodec.decodeDocuments(input, extraOutput).pipe(Effect.flip)
      expect(inputFailure.message).toContain("provenance")
      expect(outputFailure.message).toContain("confidence")
    }))

  it.effect("compares nested wire data structurally and skips output equality for different inputs", () =>
    Effect.gen(function*() {
      const comparisons = MutableRef.make(0)
      const answer = Schema.String.annotations({
        equivalence: () => (left, right) => {
          MutableRef.increment(comparisons)
          return String.Equivalence(left, right)
        }
      })
      const signature = yield* Signature.make("Compare wire values", {
        facts: Schema.Struct({ cities: Schema.Array(Schema.String) })
      }, { answer })
      const first = new Demonstration({
        input: { facts: { cities: Arr.make("Paris", "Tokyo") } },
        output: { answer: "yes" }
      })
      const same = new Demonstration({
        input: { facts: { cities: Arr.make("Paris", "Tokyo") } },
        output: { answer: "yes" }
      })
      const other = new Demonstration({ input: { facts: { cities: Arr.make("Rome") } }, output: { answer: "yes" } })
      expect(yield* signature.demonstrationCodec.equivalent(first, other)).toBe(false)
      expect(MutableRef.get(comparisons)).toBe(0)
      expect(yield* signature.demonstrationCodec.equivalent(first, same)).toBe(true)
      expect(MutableRef.get(comparisons)).toBe(1)
    }))
})
