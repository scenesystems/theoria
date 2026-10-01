import { expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import * as CanonicalJson from "@scenesystems/digest/CanonicalJson"
import * as ContentDigest from "@scenesystems/digest/ContentDigest"

it.effect("serializes an actual canonicalization failure without its rejected key", () =>
  Effect.gen(function*() {
    const failure = yield* Effect.flip(CanonicalJson.encode({ ["private\ud800"]: true }))
    const wire = yield* Schema.encode(CanonicalJson.Error)(failure)
    expect(wire).toStrictEqual({ _tag: "InvalidUnicode", kind: "lone-high-surrogate", codeUnitIndex: 7 })
    expect(yield* Schema.decode(CanonicalJson.Error)(wire)).toStrictEqual(failure)
  }))

it.effect("preserves invalid-limit versus oversized-preimage failures in the error wire", () =>
  Effect.gen(function*() {
    const invalid = yield* Effect.flip(ContentDigest.fromSchemaWithByteLimit(Schema.String, "private", -1))
    const oversized = yield* Effect.flip(ContentDigest.fromSchemaWithByteLimit(Schema.String, "private", 1))
    expect(yield* Schema.encodeUnknown(CanonicalJson.ByteLimitError)(invalid)).toStrictEqual({
      _tag: "InvalidCanonicalByteLimit"
    })
    expect(yield* Schema.encodeUnknown(CanonicalJson.ByteLimitError)(oversized)).toStrictEqual({
      _tag: "CanonicalByteLimitExceeded"
    })
  }))
