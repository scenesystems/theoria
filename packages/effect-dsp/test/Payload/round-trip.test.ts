import { describe, expect, it } from "@effect/vitest"
import { decode, encode, Payload } from "@scenesystems/effect-dsp/Payload"
import { Array as Arr, Context, Effect, FastCheck, Number, Option, Ref, Schema, String } from "effect"

const Facts = Schema.Struct({
  count: Schema.NumberFromString,
  countries: Schema.Array(Schema.String),
  details: Schema.Struct({ active: Schema.Boolean, missing: Schema.Null })
})

class Prefix extends Context.Tag("PayloadTest/Prefix")<Prefix, string>() {}

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

  it.effect.prop("round-trips nested values including escaped text", {
    count: FastCheck.integer(),
    countries: FastCheck.array(FastCheck.string()),
    active: FastCheck.boolean()
  }, ({ count, countries, active }) =>
    Effect.gen(function*() {
      const value = { count, countries, details: { active, missing: null } }
      const document = yield* encode(Facts, value)
      expect(yield* decode(Facts, document)).toEqual(value)
    }))

  it.effect("rejects lossy numeric JSON and malformed persisted documents", () =>
    Effect.gen(function*() {
      const schema = Schema.Struct({ score: Schema.NullOr(Schema.Number) })
      const infinity = yield* Schema.decode(Schema.NumberFromString)("Infinity")
      const failure = yield* encode(schema, { score: infinity }).pipe(Effect.flip)
      const malformed = yield* Schema.decode(Payload)("{\"unterminated\":").pipe(Effect.flip)
      expect(failure._tag).toBe("ParseError")
      expect(malformed._tag).toBe("ParseError")
      const valid = yield* encode(schema, { score: null })
      expect(yield* decode(schema, valid)).toEqual({ score: null })
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
      expect(failure._tag).toBe("ParseError")
    }))
})
