import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Exit, Schema, Tuple } from "effect"

import {
  CanonicalByteLimitError,
  CanonicalizationError,
  canonicalize,
  digestSchemaValueWithByteLimit,
  InvalidUnicode
} from "../../src/index.js"

it.effect("serializes an actual canonicalization failure without its rejected key", () =>
  Effect.gen(function*() {
    const failure = yield* Effect.flip(canonicalize({ ["private\ud800"]: true }))
    const wire = yield* Schema.encode(CanonicalizationError)(failure)
    expect(wire).toStrictEqual({ _tag: "InvalidUnicode", kind: "lone-high-surrogate", codeUnitIndex: 7 })
    expect(yield* Schema.decode(CanonicalizationError)(wire)).toStrictEqual(failure)
  }))

it.effect("preserves invalid-limit versus oversized-preimage failures in the error wire", () =>
  Effect.gen(function*() {
    const invalid = yield* Effect.flip(digestSchemaValueWithByteLimit(Schema.String, "private", -1))
    const oversized = yield* Effect.flip(digestSchemaValueWithByteLimit(Schema.String, "private", 1))
    expect(yield* Schema.encodeUnknown(CanonicalByteLimitError)(invalid)).toStrictEqual({
      _tag: "InvalidCanonicalByteLimit"
    })
    expect(yield* Schema.encodeUnknown(CanonicalByteLimitError)(oversized)).toStrictEqual({
      _tag: "CanonicalByteLimitExceeded"
    })
  }))

it.effect.each(Arr.make(
  Tuple.make("negative", -1),
  Tuple.make("fractional", 0.5),
  Tuple.make("unsafe", 9_007_199_254_740_992)
))("rejects a %s code-unit index in a received Unicode diagnostic", ([, codeUnitIndex]) =>
  Effect.gen(function*() {
    expect(
      yield* Effect.exit(
        Schema.decodeUnknown(InvalidUnicode)({
          _tag: "InvalidUnicode",
          kind: "lone-low-surrogate",
          codeUnitIndex
        })
      )
    ).toSatisfy(Exit.isFailure)
    expect(
      yield* Schema.decode(InvalidUnicode)({
        _tag: "InvalidUnicode",
        kind: "lone-low-surrogate",
        codeUnitIndex: 0
      })
    ).toStrictEqual(new InvalidUnicode({ kind: "lone-low-surrogate", codeUnitIndex: 0 }))
  }))
