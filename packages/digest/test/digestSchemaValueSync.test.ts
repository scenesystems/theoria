/**
 * Synchronous Schema encoding and bounded preimage contracts.
 */

import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Number as N, Schema, Tuple } from "effect"

import {
  CanonicalByteLimitExceeded,
  digestSchemaValueWithByteLimitSync,
  InvalidCanonicalByteLimit,
  SchemaValueDigest
} from "../src/index.js"

const canonicalByteCountCases = Arr.make(
  Tuple.make("é", 4),
  Tuple.make("😀", 6),
  Tuple.make("\n", 4),
  Tuple.make("\u0000", 8),
  Tuple.make("\\\"", 6)
)

describe("digestSchemaValueWithByteLimitSync", () => {
  it.effect("hashes the encoded preimage with an independent SHA-256 known answer", () => {
    const result = digestSchemaValueWithByteLimitSync(Schema.NumberFromString, 42, 4, "sha256")

    expect(result).toStrictEqual(
      Either.right(
        new SchemaValueDigest({
          digest: "sha256:gzTFVMcnb1lnSBC5L_9Rl81Gv2zL6HJ0L5sEyjHf49E",
          canonicalByteLength: 4
        })
      )
    )
    return Effect.void
  })

  it.effect.each(canonicalByteCountCases)(
    "enforces exact multibyte and escape byte limits %#",
    ([value, canonicalByteLength]) => {
      const exact = digestSchemaValueWithByteLimitSync(Schema.String, value, canonicalByteLength)
      const excess = digestSchemaValueWithByteLimitSync(
        Schema.String,
        value,
        N.decrement(canonicalByteLength)
      )

      expect(Either.map(exact, (digest) => digest.canonicalByteLength)).toStrictEqual(
        Either.right(canonicalByteLength)
      )
      expect(excess).toStrictEqual(Either.left(new CanonicalByteLimitExceeded({})))
      return Effect.void
    }
  )

  it.effect("returns first-party Schema encoding failures as ParseError", () => {
    const result = digestSchemaValueWithByteLimitSync(Schema.Int, 1.5, 16)

    expect(Either.mapLeft(result, (error) => error._tag)).toStrictEqual(Either.left("ParseError"))
    return Effect.void
  })

  it.effect("rejects invalid limits", () => {
    const result = digestSchemaValueWithByteLimitSync(Schema.String, "value", -1)

    expect(result).toStrictEqual(Either.left(new InvalidCanonicalByteLimit({})))
    return Effect.void
  })
})
