import { describe, expect, it } from "@effect/vitest"
import { Score } from "@scenesystems/effect-dsp/Metric"
import { decode, encode, Payload } from "@scenesystems/effect-dsp/Payload"
import { Arbitrary, Array as Arr, Context, Effect, Number, Option, Ref, Schema, SchemaGetter, String } from "effect"

const Facts = Schema.Struct({
  count: Schema.FiniteFromString,
  countries: Schema.Array(Schema.String),
  details: Schema.Struct({ active: Schema.Boolean, missing: Schema.Null })
})

class Prefix extends Context.Service<Prefix, string>()("PayloadTest/Prefix") {}

describe("schema-bound payloads", () => {
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

  it.effect("round-trips nested values including escaped text", () =>
    Effect.gen(function*() {
      const result = yield* Arbitrary.checkEffect(Arbitrary.schema(Facts), (value) =>
        Effect.gen(function*() {
          const document = yield* encode(Facts, value)
          return Schema.toEquivalence(Facts)(yield* decode(Facts, document), value)
        }), { runs: 100 })
      expect(Arbitrary.formatCheckFailure(result)).toBeUndefined()
    }))

  it.effect("rejects lossy numeric JSON and malformed persisted documents", () =>
    Effect.gen(function*() {
      const schema = Schema.Struct({ score: Schema.NullOr(Score.fields.value) })
      const infinity = yield* Effect.fromOption(Number.parse("Infinity"))
      const failure = yield* encode(schema, { score: infinity }).pipe(Effect.flip)
      const malformed = yield* Schema.decodeEffect(Payload)("{\"unterminated\":").pipe(Effect.flip)
      expect(failure._tag).toBe("SchemaError")
      expect(malformed._tag).toBe("SchemaError")
      const valid = yield* encode(schema, { score: null })
      expect(yield* decode(schema, valid)).toEqual({ score: null })
    }))

  it.effect("keeps schema service requirements through encoding and decoding", () =>
    Effect.gen(function*() {
      const decodes = yield* Ref.make(0)
      const schema = Schema.String.pipe(Schema.decodeTo(Schema.String, {
        decode: SchemaGetter.transformEffect((encoded: string) =>
          Effect.map(Prefix, (prefix) => String.slice(String.length(prefix))(encoded)).pipe(
            Effect.tap(() => Ref.update(decodes, Number.increment))
          )
        ),
        encode: SchemaGetter.transformEffect((decoded: string) =>
          Effect.map(Prefix, (prefix) => String.concat(prefix, decoded))
        )
      }))
      const document = yield* encode(schema, "with context").pipe(Effect.provideService(Prefix, "required:"))
      expect(yield* Ref.get(decodes)).toBe(0)
      const restored = yield* decode(schema, document).pipe(Effect.provideService(Prefix, "required:"))
      expect(document).toBe("\"required:with context\"")
      expect(restored).toBe("with context")
      expect(yield* Ref.get(decodes)).toBe(1)
    }))

  it.effect("preserves wire data without imposing bijective domain transformations", () =>
    Effect.gen(function*() {
      const schema = Schema.String.pipe(Schema.decodeTo(Schema.String, {
        decode: SchemaGetter.transform(String.toLowerCase),
        encode: SchemaGetter.passthrough()
      }))
      const document = yield* encode(schema, "MiXeD")
      expect(document).toBe("\"MiXeD\"")
      expect(yield* decode(schema, document)).toBe("mixed")
    }))

  it.effect("reports unsupported schema equivalence as a checked failure", () =>
    Effect.gen(function*() {
      const schema = Schema.String.annotate({ toEquivalence: () => Option.getOrThrow(Option.none()) })
      const failure = yield* encode(schema, "safe").pipe(Effect.flip)
      expect(failure._tag).toBe("SchemaError")
    }))
})
