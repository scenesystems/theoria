import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Number as N, Schema, Tuple } from "effect"

import * as CanonicalJson from "@scenesystems/digest/CanonicalJson"
import * as ContentDigest from "@scenesystems/digest/ContentDigest"

const canonicalByteCountCases = Arr.make(
  Tuple.make("é", 4),
  Tuple.make("😀", 6),
  Tuple.make("\n", 4),
  Tuple.make("\u0000", 8),
  Tuple.make("\\\"", 6)
)

describe("ContentDigest.fromSchemaWithByteLimitEither", () => {
  it.effect("hashes the encoded preimage with an independent SHA-256 known answer", () => {
    const result = ContentDigest.fromSchemaWithByteLimitEither(Schema.NumberFromString, 42, 4, "sha256")

    expect(Either.map(result, ({ digest }) => ContentDigest.toString(digest))).toStrictEqual(
      Either.right("sha256:gzTFVMcnb1lnSBC5L_9Rl81Gv2zL6HJ0L5sEyjHf49E")
    )
    return Effect.void
  })

  it.effect.each(canonicalByteCountCases)(
    "enforces exact multibyte and escape byte limits %#",
    ([value, canonicalByteLength]) => {
      const exact = ContentDigest.fromSchemaWithByteLimitEither(Schema.String, value, canonicalByteLength)
      const excess = ContentDigest.fromSchemaWithByteLimitEither(
        Schema.String,
        value,
        N.decrement(canonicalByteLength)
      )

      expect(Either.map(exact, (result) => result.canonicalByteLength)).toStrictEqual(
        Either.right(canonicalByteLength)
      )
      expect(excess).toStrictEqual(Either.left(new CanonicalJson.ByteLimitExceeded({})))
      return Effect.void
    }
  )

  it.effect("returns Schema encoding failures as ParseError", () => {
    const result = ContentDigest.fromSchemaWithByteLimitEither(Schema.Int, 1.5, 16)

    expect(Either.mapLeft(result, (error) => error._tag)).toStrictEqual(Either.left("ParseError"))
    return Effect.void
  })

  it.effect("rejects invalid limits", () => {
    const result = ContentDigest.fromSchemaWithByteLimitEither(Schema.String, "value", -1)

    expect(result).toStrictEqual(Either.left(new CanonicalJson.InvalidByteLimit({})))
    return Effect.void
  })
})
