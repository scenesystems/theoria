import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as N, Result, Schema, Tuple } from "effect"

import * as CanonicalJson from "@scenesystems/digest/CanonicalJson"
import * as ContentDigest from "@scenesystems/digest/ContentDigest"

const canonicalByteCountCases = Arr.make(
  Tuple.make("é", 4),
  Tuple.make("😀", 6),
  Tuple.make("\n", 4),
  Tuple.make("\u0000", 8),
  Tuple.make("\\\"", 6)
)

describe("ContentDigest.fromSchemaWithByteLimitResult", () => {
  it.effect("hashes the encoded preimage with an independent SHA-256 known answer", () => {
    const result = ContentDigest.fromSchemaWithByteLimitResult(Schema.FiniteFromString, 42, 4, "sha256")

    expect(Result.map(result, ({ digest }) => ContentDigest.toString(digest))).toStrictEqual(
      Result.succeed("sha256:gzTFVMcnb1lnSBC5L_9Rl81Gv2zL6HJ0L5sEyjHf49E")
    )
    return Effect.void
  })

  it.effect.each(canonicalByteCountCases)(
    "enforces exact multibyte and escape byte limits %#",
    ([value, canonicalByteLength]) => {
      const exact = ContentDigest.fromSchemaWithByteLimitResult(Schema.String, value, canonicalByteLength)
      const excess = ContentDigest.fromSchemaWithByteLimitResult(
        Schema.String,
        value,
        N.decrement(canonicalByteLength)
      )

      expect(Result.map(exact, (result) => result.canonicalByteLength)).toStrictEqual(
        Result.succeed(canonicalByteLength)
      )
      expect(excess).toStrictEqual(Result.fail(new CanonicalJson.ByteLimitExceeded({})))
      return Effect.void
    }
  )

  it.effect("returns Schema encoding failures as SchemaError", () => {
    const result = ContentDigest.fromSchemaWithByteLimitResult(Schema.Int, 1.5, 16)

    expect(Result.mapError(result, (error) => error._tag)).toStrictEqual(Result.fail("SchemaError"))
    return Effect.void
  })

  it.effect("rejects invalid limits", () => {
    const result = ContentDigest.fromSchemaWithByteLimitResult(Schema.String, "value", -1)

    expect(result).toStrictEqual(Result.fail(new CanonicalJson.InvalidByteLimit({})))
    return Effect.void
  })
})
