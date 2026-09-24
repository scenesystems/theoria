import { describe, expect, it } from "@effect/vitest"
import { decode, encode, makeEncoder, Payload } from "@scenesystems/effect-dsp/Payload"
import {
  Array as Arr,
  Context,
  Data,
  Effect,
  FastCheck,
  Hash,
  Inspectable,
  MutableRef,
  Number,
  Option,
  ParseResult,
  Record,
  Ref,
  Schema,
  String
} from "effect"

const Facts = Schema.Struct({
  count: Schema.NumberFromString,
  countries: Schema.Array(Schema.String),
  details: Schema.Struct({ active: Schema.Boolean, missing: Schema.Null })
})

class Prefix extends Context.Tag("PayloadTest/Prefix")<Prefix, string>() {}

describe("schema-bound payloads", () => {
  it.effect.prop("round-trips required string records including escaped code units", {
    question: FastCheck.string(),
    answer: FastCheck.string()
  }, ({ question, answer }) =>
    Effect.gen(function*() {
      const schema = Schema.Struct({ question: Schema.String, answer: Schema.String })
      const value = { question: String.concat(question, "\n\"\\\u0000\ud800"), answer: String.concat("Ω😀", answer) }
      const operation = makeEncoder(schema)(value)
      const document = yield* operation
      expect(yield* decode(schema, document)).toEqual(value)
      expect(yield* operation).toBe(document)
      expect(Schema.is(Payload)(document)).toBe(true)
    }))

  it.effect("projects ordinary records before JSON and checks custom excess-property serialization", () =>
    Effect.gen(function*() {
      const schema = Schema.Struct({ value: Schema.String })
      const value = Data.struct({ value: "original", toJSON: () => ({ value: "changed" }) })
      expect(yield* makeEncoder(schema)(value)).toBe("{\"value\":\"original\"}")
      const preserved = schema.annotations({ parseOptions: { onExcessProperty: "preserve" } })
      const failure = yield* makeEncoder(preserved)(value).pipe(Effect.flip)
      expect(failure.message).toContain("JSON encoding did not preserve encoded schema equivalence")
    }))

  it.effect("does not assume empty, symbolic, prototype-named or optional records are JSON-lossless", () =>
    Effect.gen(function*() {
      const operations = Arr.make(
        encode(Schema.Struct({}), { unmodeled: "value" }),
        encode(Schema.Struct({ [Hash.symbol]: Schema.String }), { [Hash.symbol]: "symbol value" }),
        encode(Schema.Struct(Record.singleton("__proto__", Schema.String)), Record.singleton("__proto__", "value")),
        encode(Schema.Struct({ value: Schema.optional(Schema.String) }), { value: undefined })
      )
      yield* Effect.forEach(operations, (operation) =>
        Effect.gen(function*() {
          expect((yield* operation.pipe(Effect.flip))._tag).toBe("ParseError")
        }))
    }))

  it.effect("prepared operations defer synchronous transforms and rerun them on every execution", () =>
    Effect.gen(function*() {
      const calls = MutableRef.make(0)
      const schema = Schema.transform(Schema.String, Schema.String, {
        strict: true,
        decode: (value) => value,
        encode: (value) => {
          MutableRef.increment(calls)
          return String.concat(Inspectable.toStringUnknown(MutableRef.get(calls)), value)
        }
      })
      const operation = makeEncoder(schema)(":value")
      expect(MutableRef.get(calls)).toBe(0)
      expect(yield* operation).toBe("\"1:value\"")
      expect(yield* operation).toBe("\"2:value\"")
      expect(MutableRef.get(calls)).toBe(2)
    }))

  it.effect("prepared encoders retain asynchronous per-value transforms and invocation services", () =>
    Effect.gen(function*() {
      const encodes = yield* Ref.make(0)
      const decodes = yield* Ref.make(0)
      const schema = Schema.transformOrFail(Schema.String, Schema.String, {
        strict: true,
        encode: (value) =>
          Effect.yieldNow().pipe(
            Effect.zipRight(Ref.update(encodes, Number.increment)),
            Effect.zipRight(Effect.map(Prefix, (prefix) => String.concat(prefix, value)))
          ),
        decode: (value) => Ref.update(decodes, Number.increment).pipe(Effect.as(value))
      })
      const prepared = makeEncoder(schema)
      expect(yield* Ref.get(encodes)).toBe(0)
      expect(yield* prepared("alpha").pipe(Effect.provideService(Prefix, "first:"))).toBe("\"first:alpha\"")
      expect(yield* prepared("beta").pipe(Effect.provideService(Prefix, "second:"))).toBe("\"second:beta\"")
      expect(yield* Ref.get(encodes)).toBe(2)
      expect(yield* Ref.get(decodes)).toBe(0)
    }))

  it.effect("prepared encoders still check each wire round trip after earlier success or failure", () =>
    Effect.gen(function*() {
      const prepared = makeEncoder(Schema.Struct({ score: Schema.NullOr(Schema.Number) }))
      const infinity = yield* Schema.decode(Schema.NumberFromString)("Infinity")
      expect(yield* prepared({ score: 7 })).toBe("{\"score\":7}")
      expect((yield* prepared({ score: infinity }).pipe(Effect.flip))._tag).toBe("ParseError")
      expect(yield* prepared({ score: null })).toBe("{\"score\":null}")
    }))

  it.effect("retains encoded structured fields and restores decoded signature values", () =>
    Effect.gen(function*() {
      const value = { count: 17, countries: Arr.make("France", "Japan"), details: { active: false, missing: null } }
      const document = yield* encode(Facts, value)
      const restored = yield* decode(Facts, document)
      expect(document).toBe(
        "{\"count\":\"17\",\"countries\":[\"France\",\"Japan\"],\"details\":{\"active\":false,\"missing\":null}}"
      )
      expect(restored).toEqual(value)
    }))

  it.effect.prop("round-trips nested values including escaped text", {
    count: FastCheck.integer(),
    countries: FastCheck.array(FastCheck.string()),
    active: FastCheck.boolean()
  }, ({ count, countries, active }) =>
    Effect.gen(function*() {
      const value = { count, countries, details: { active, missing: null } }
      const document = yield* encode(Facts, value)
      expect(Schema.is(Payload)(document)).toBe(true)
      expect(yield* decode(Facts, document)).toEqual(value)
    }))

  it.effect("does not substitute JSON syntax validity for wire encoding and equivalence", () =>
    Effect.gen(function*() {
      const rejecting = Schema.String.annotations({ equivalence: () => () => false })
      const validJsonFailure = yield* encode(rejecting, "valid JSON string").pipe(Effect.flip)
      expect(validJsonFailure.message).toContain("JSON encoding did not preserve encoded schema equivalence")

      const rejectingRecord = Schema.Struct({ value: Schema.String }).annotations({ equivalence: () => () => false })
      const recordFailure = yield* encode(rejectingRecord, { value: "valid JSON field" }).pipe(Effect.flip)
      expect(recordFailure.message).toContain("JSON encoding did not preserve encoded schema equivalence")

      const incrementing = Schema.declare<number, number, []>([], {
        decode: () => ParseResult.decodeUnknown(Schema.Number),
        encode: () => (value) => ParseResult.decodeUnknown(Schema.Number)(value).pipe(Effect.map(Number.increment))
      }, { equivalence: () => Number.Equivalence })
      const wireFailure = yield* encode(incrementing, 0).pipe(Effect.flip)
      expect(wireFailure.message).toContain("JSON encoding did not preserve encoded schema equivalence")
    }))

  it.effect("rejects lossy numeric JSON and malformed persisted documents", () =>
    Effect.gen(function*() {
      const schema = Schema.Struct({ label: Schema.String, score: Schema.NullOr(Schema.Number) })
      const infinity = yield* Schema.decode(Schema.NumberFromString)("Infinity")
      const failure = yield* encode(schema, { label: "retained", score: infinity }).pipe(Effect.flip)
      const malformed = yield* Schema.decode(Payload)("{\"unterminated\":").pipe(Effect.flip)
      expect(failure._tag).toBe("ParseError")
      expect(malformed._tag).toBe("ParseError")
      const valid = yield* encode(schema, { label: "retained", score: null })
      expect(yield* decode(schema, valid)).toEqual({ label: "retained", score: null })
    }))

  it.effect("keeps schema service requirements through encoding and decoding", () =>
    Effect.gen(function*() {
      const decodes = yield* Ref.make(0)
      const schema = Schema.transformOrFail(Schema.String, Schema.String, {
        strict: true,
        decode: (encoded) =>
          Effect.map(Prefix, (prefix) => String.slice(String.length(prefix))(encoded)).pipe(
            Effect.tap(() => Ref.update(decodes, Number.increment))
          ),
        encode: (decoded) => Effect.map(Prefix, (prefix) => String.concat(prefix, decoded))
      })
      const document = yield* encode(schema, "with context").pipe(Effect.provideService(Prefix, "required:"))
      expect(yield* Ref.get(decodes)).toBe(0)
      const restored = yield* decode(schema, document).pipe(Effect.provideService(Prefix, "required:"))
      expect(document).toBe("\"required:with context\"")
      expect(restored).toBe("with context")
      expect(yield* Ref.get(decodes)).toBe(1)
    }))

  it.effect("keeps invocation services and excess-property policy independent of JSON codec reuse", () =>
    Effect.gen(function*() {
      const schema = Schema.transformOrFail(Schema.String, Schema.String, {
        strict: true,
        decode: (encoded) => Effect.map(Prefix, (prefix) => String.slice(String.length(prefix))(encoded)),
        encode: (decoded) => Effect.map(Prefix, (prefix) => String.concat(prefix, decoded))
      })
      const operation = encode(schema, "value")
      const first = yield* operation.pipe(Effect.provideService(Prefix, "first:"))
      const second = yield* operation.pipe(Effect.provideService(Prefix, "second:"))
      expect(first).toBe("\"first:value\"")
      expect(second).toBe("\"second:value\"")
      expect(yield* decode(schema, second).pipe(Effect.provideService(Prefix, "second:"))).toBe("value")

      const document = yield* Schema.decode(Payload)("{\"value\":7,\"extra\":11}")
      const object = Schema.Struct({ value: Schema.Number })
      expect(yield* decode(object, document)).toEqual({ value: 7 })
      const failure = yield* decode(object, document, { onExcessProperty: "error" }).pipe(Effect.flip)
      expect(failure._tag).toBe("ParseError")
    }))

  it.effect("preserves wire data without imposing bijective domain transformations", () =>
    Effect.gen(function*() {
      const schema = Schema.transform(Schema.String, Schema.String, {
        strict: true,
        decode: String.toLowerCase,
        encode: (value) => value
      })
      const document = yield* encode(schema, "MiXeD")
      expect(document).toBe("\"MiXeD\"")
      expect(yield* decode(schema, document)).toBe("mixed")
    }))

  it.effect("reports unsupported schema equivalence as a checked failure", () =>
    Effect.gen(function*() {
      const schema = Schema.String.annotations({ equivalence: () => Option.getOrThrow(Option.none()) })
      const failure = yield* encode(schema, "safe").pipe(Effect.flip)
      const prepared = makeEncoder(schema)
      const preparedFailure = yield* prepared("also safe").pipe(Effect.flip)
      expect(failure._tag).toBe("ParseError")
      expect(preparedFailure._tag).toBe("ParseError")
    }))
})
