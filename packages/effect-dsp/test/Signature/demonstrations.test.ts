import { describe, expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { encode, Payload } from "@scenesystems/effect-dsp/Payload"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Boolean, Effect, FastCheck, MutableRef, ParseResult, Ref, Schema, String, Tuple } from "effect"

describe("signature-owned demonstrations", () => {
  it.effect.prop("revalidates both comparison sides and short-circuits only unequal admitted inputs", {
    question: FastCheck.string(),
    answer: FastCheck.string()
  }, ({ question, answer }) =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Compare changing values", { question: Schema.String }, {
        answer: Schema.String
      })
      const contract = signature.demonstrationCodec
      const first = new Demonstration({ input: { question }, output: { answer } })
      const same = new Demonstration({ input: { question }, output: { answer } })
      const changedOutput = new Demonstration({ input: { question }, output: { answer: String.concat(answer, "!") } })
      const changedInput = new Demonstration({
        input: { question: String.concat(question, "!") },
        output: { answer: 7 }
      })
      const repeated = contract.equivalent(first, same)
      expect(yield* repeated).toBe(true)
      expect(yield* contract.equivalent(first, changedOutput)).toBe(false)
      expect(yield* contract.equivalent(first, changedInput)).toBe(false)
      yield* Effect.forEach(
        Arr.make(
          new Demonstration({ input: { question, extra: "reject" }, output: { answer } }),
          new Demonstration({ input: { question }, output: { answer, extra: "reject" } })
        ),
        (extra) =>
          Effect.gen(function*() {
            expect((yield* contract.equivalent(first, extra).pipe(Effect.flip)).message).toContain("extra")
            expect((yield* contract.equivalent(extra, first).pipe(Effect.flip)).message).toContain("extra")
          })
      )
      const invalid = new Demonstration({ input: { question: 17 }, output: { answer } })
      expect((yield* contract.equivalent(first, invalid).pipe(Effect.flip)).message).toContain("question")
      expect((yield* contract.equivalent(invalid, first).pipe(Effect.flip)).message).toContain("question")
      expect(yield* repeated).toBe(true)
    }))

  it.effect("defers and repeats asynchronous left/right decoding before comparing decoded values", () =>
    Effect.gen(function*() {
      const decoded = yield* Ref.make(Arr.empty<string>())
      const question = Schema.declare<string, string, []>([], {
        decode: () => (input) =>
          Effect.gen(function*() {
            yield* Effect.yieldNow()
            const value = yield* ParseResult.decodeUnknown(Schema.String)(input)
            yield* Ref.update(decoded, Arr.append(value))
            return String.toUpperCase(value)
          }),
        encode: () => ParseResult.decodeUnknown(Schema.String)
      }).annotations({ equivalence: () => String.Equivalence })
      const signature = yield* Signature.make("Decode comparisons", { question }, { answer: Schema.String })
      const left = new Demonstration({ input: { question: "lower-left" }, output: { answer: "yes" } })
      const right = new Demonstration({ input: { question: "LOWER-LEFT" }, output: { answer: "yes" } })
      const operation = signature.demonstrationCodec.equivalent(left, right)
      expect(yield* Ref.get(decoded)).toEqual([])
      expect(yield* operation).toBe(true)
      expect(yield* operation).toBe(true)
      expect(yield* Ref.get(decoded)).toEqual(["lower-left", "LOWER-LEFT", "lower-left", "LOWER-LEFT"])
    }))

  it.effect("prepares custom equivalence on every execution after admission and preserves failure recovery", () =>
    Effect.gen(function*() {
      const available = MutableRef.make(false)
      const preparations = MutableRef.make(0)
      const answer = Schema.String.annotations({
        equivalence: () => {
          MutableRef.increment(preparations)
          return Boolean.match(MutableRef.get(available), {
            onTrue: () => String.Equivalence,
            onFalse: () => Schema.decodeUnknownSync(Schema.Never)("unavailable")
          })
        }
      })
      const signature = yield* Signature.make("Changing equivalence", { question: Schema.String }, { answer })
      const left = new Demonstration({ input: { question: "France" }, output: { answer: "Paris" } })
      const right = new Demonstration({ input: { question: "France" }, output: { answer: "Paris" } })
      const other = new Demonstration({ input: { question: "Japan" }, output: { answer: 7 } })
      const operation = signature.demonstrationCodec.equivalent(left, right)
      expect(MutableRef.get(preparations)).toBe(0)
      expect(yield* signature.demonstrationCodec.equivalent(left, other)).toBe(false)
      expect(MutableRef.get(preparations)).toBe(0)
      expect((yield* operation.pipe(Effect.flip)).message).toContain("Demonstration schema equivalence is unavailable")
      MutableRef.set(available, true)
      expect(yield* operation).toBe(true)
      MutableRef.set(available, false)
      expect((yield* operation.pipe(Effect.flip)).message).toContain("Demonstration schema equivalence is unavailable")
      expect(MutableRef.get(preparations)).toBe(3)
    }))

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
