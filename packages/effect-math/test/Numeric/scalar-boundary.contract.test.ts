import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import {
  acoshValidated,
  acosValidated,
  asinValidated,
  atanhValidated,
  degreesToRadiansValidated,
  sinValidated
} from "../../src/Numeric/operations.js"

describe("Numeric scalar boundary contracts", () => {
  it.effect("rejects excess properties through Numeric decode errors", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(degreesToRadiansValidated({ value: 90, extra: true }))

      expect(error._tag).toStrictEqual("NumericDecodeError")
      expect(error.operation).toStrictEqual("degreesToRadians")
    }))

  it.effect("rejects non-finite scalar inputs through Numeric decode errors", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(sinValidated({ value: Infinity }))

      expect(error._tag).toStrictEqual("NumericDecodeError")
      expect(error.operation).toStrictEqual("sin")
    }))

  it.effect("rejects inverse circular inputs outside [-1, 1]", () =>
    Effect.gen(function*() {
      const asinError = yield* Effect.flip(asinValidated({ value: 2 }))
      const acosError = yield* Effect.flip(acosValidated({ value: -2 }))

      expect(asinError._tag).toStrictEqual("NumericDecodeError")
      expect(asinError.operation).toStrictEqual("asin")
      expect(acosError._tag).toStrictEqual("NumericDecodeError")
      expect(acosError.operation).toStrictEqual("acos")
    }))

  it.effect("rejects inverse hyperbolic inputs outside the schema-owned domains", () =>
    Effect.gen(function*() {
      const acoshError = yield* Effect.flip(acoshValidated({ value: 0.5 }))
      const atanhError = yield* Effect.flip(atanhValidated({ value: 1 }))

      expect(acoshError._tag).toStrictEqual("NumericDecodeError")
      expect(acoshError.operation).toStrictEqual("acosh")
      expect(atanhError._tag).toStrictEqual("NumericDecodeError")
      expect(atanhError.operation).toStrictEqual("atanh")
    }))
})
