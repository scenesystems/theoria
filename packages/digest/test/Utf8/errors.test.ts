import { expect, it } from "@effect/vitest"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Array as Arr, Effect, Exit, Schema, Tuple } from "effect"

it.effect.each(Arr.make(
  Tuple.make("negative", -1),
  Tuple.make("fractional", 0.5),
  Tuple.make("unsafe", 9_007_199_254_740_992)
))("rejects a %s code-unit index in a received Unicode diagnostic", ([, codeUnitIndex]) =>
  Effect.gen(function*() {
    expect(
      yield* Effect.exit(
        Schema.decodeUnknown(Utf8.InvalidUnicode)({
          _tag: "InvalidUnicode",
          kind: "lone-low-surrogate",
          codeUnitIndex
        })
      )
    ).toSatisfy(Exit.isFailure)
    expect(
      yield* Schema.decode(Utf8.InvalidUnicode)({
        _tag: "InvalidUnicode",
        kind: "lone-low-surrogate",
        codeUnitIndex: 0
      })
    ).toStrictEqual(new Utf8.InvalidUnicode({ kind: "lone-low-surrogate", codeUnitIndex: 0 }))
  }))
