import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as EffectNumber, Option, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
  argmaxIndex,
  argmaxValidated,
  between,
  clamp,
  expm1,
  expm1WithPolicies,
  log,
  log1p,
  log1pWithPolicies,
  logValidated,
  safeDivide,
  safeDivideFinite,
  safeDivideValidated,
  sum,
  sumValidated,
  sumWithPolicies,
  unsafeDivide,
  unsafeDivideValidated
} from "../../src/Numeric/operations.js"

const strictTypedArrayLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "strict",
  backend: "typed-array",
  diagnostics: "enabled"
})

const relaxedScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

describe("Numeric / safeDivide", () => {
  it.effect("returns Some for valid division", () =>
    Effect.gen(function*() {
      const result = safeDivide(10, 3)
      expect(Option.isSome(result)).toStrictEqual(true)
      expect(Option.getOrThrow(result)).toBeCloseTo(10 / 3)
    }))

  it.effect("returns None for zero divisor", () =>
    Effect.gen(function*() {
      expect(Option.isNone(safeDivide(10, 0))).toStrictEqual(true)
    }))

  it.effect("supports dual API", () =>
    Effect.gen(function*() {
      const divideByTwo = safeDivide(2)
      expect(Option.getOrThrow(divideByTwo(10))).toStrictEqual(5)
    }))
})

describe("Numeric / unsafeDivide", () => {
  it.effect("returns result for valid division", () =>
    Effect.gen(function*() {
      expect(unsafeDivide(10, 2)).toStrictEqual(5)
    }))

  it.effect("supports dual API", () =>
    Effect.gen(function*() {
      expect(unsafeDivide(4)(20)).toStrictEqual(5)
    }))
})

describe("Numeric / safeDivideFinite", () => {
  it.effect("returns None when dividend is Infinity", () =>
    Effect.gen(function*() {
      expect(Option.isNone(safeDivideFinite(Infinity, 2))).toStrictEqual(true)
    }))

  it.effect("returns None when divisor is NaN", () =>
    Effect.gen(function*() {
      expect(Option.isNone(safeDivideFinite(1, NaN))).toStrictEqual(true)
    }))

  it.effect("returns Some for valid finite division", () =>
    Effect.gen(function*() {
      expect(Option.getOrThrow(safeDivideFinite(10, 4))).toStrictEqual(2.5)
    }))
})

describe("Numeric / sum", () => {
  it.effect("sums an array", () =>
    Effect.gen(function*() {
      expect(sum([1, 2, 3, 4, 5])).toStrictEqual(15)
    }))

  it.effect("returns 0 for empty iterable", () =>
    Effect.gen(function*() {
      expect(sum([])).toStrictEqual(0)
    }))

  it.effect("produces identical results to Number.sumAll", () =>
    Effect.gen(function*() {
      const values = [0.1, 0.2, 0.3]
      expect(EffectNumber.Equivalence(sum(values), EffectNumber.sumAll(values))).toStrictEqual(true)
    }))
})

describe("Numeric / argmaxIndex", () => {
  it.effect("returns index of maximum element", () =>
    Effect.gen(function*() {
      expect(Option.getOrThrow(argmaxIndex([1, 5, 3, 2]))).toStrictEqual(1)
    }))

  it.effect("returns None for empty array", () =>
    Effect.gen(function*() {
      expect(Option.isNone(argmaxIndex([]))).toStrictEqual(true)
    }))

  it.effect("returns first index on ties", () =>
    Effect.gen(function*() {
      expect(Option.getOrThrow(argmaxIndex([5, 5, 5]))).toStrictEqual(0)
    }))

  it.effect("handles single element", () =>
    Effect.gen(function*() {
      expect(Option.getOrThrow(argmaxIndex([42]))).toStrictEqual(0)
    }))
})

describe("Numeric / clamp", () => {
  it.effect("clamps below minimum", () =>
    Effect.gen(function*() {
      expect(clamp(-5, { minimum: 0, maximum: 10 })).toStrictEqual(0)
    }))

  it.effect("clamps above maximum", () =>
    Effect.gen(function*() {
      expect(clamp(15, { minimum: 0, maximum: 10 })).toStrictEqual(10)
    }))

  it.effect("passes through values within range", () =>
    Effect.gen(function*() {
      expect(clamp(5, { minimum: 0, maximum: 10 })).toStrictEqual(5)
    }))
})

describe("Numeric / between", () => {
  it.effect("returns true for value in range", () =>
    Effect.gen(function*() {
      expect(between(5, { minimum: 0, maximum: 10 })).toStrictEqual(true)
    }))

  it.effect("returns false for value outside range", () =>
    Effect.gen(function*() {
      expect(between(15, { minimum: 0, maximum: 10 })).toStrictEqual(false)
    }))
})

describe("Numeric / log", () => {
  it.effect("computes natural logarithm", () =>
    Effect.gen(function*() {
      expect(log(Math.E)).toBeCloseTo(1)
    }))
})

describe("Numeric / log1p", () => {
  it.effect("is numerically stable near zero", () =>
    Effect.gen(function*() {
      const tiny = 1e-15
      expect(Number.isFinite(log1p(tiny))).toStrictEqual(true)
      expect(log1p(tiny)).not.toStrictEqual(0)
    }))
})

describe("Numeric / expm1", () => {
  it.effect("is numerically stable near zero", () =>
    Effect.gen(function*() {
      const tiny = 1e-15
      expect(Number.isFinite(expm1(tiny))).toStrictEqual(true)
      expect(expm1(tiny)).not.toStrictEqual(0)
    }))
})

describe("Numeric / safeDivideValidated", () => {
  it.effect("decodes valid input and returns Option.Some", () =>
    Effect.gen(function*() {
      const result = yield* safeDivideValidated({ dividend: 10, divisor: 4 })
      expect(Option.getOrThrow(result)).toStrictEqual(2.5)
    }))

  it.effect("rejects excess properties with NumericDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        safeDivideValidated({ dividend: 10, divisor: 4, extra: true })
      )
      expect(error._tag).toStrictEqual("NumericDecodeError")
      expect(error.operation).toStrictEqual("safeDivide")
    }))

  it.effect("rejects non-finite input with NumericDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        safeDivideValidated({ dividend: Infinity, divisor: 2 })
      )
      expect(error._tag).toStrictEqual("NumericDecodeError")
    }))
})

describe("Numeric / unsafeDivideValidated", () => {
  it.effect("succeeds for valid division", () =>
    Effect.gen(function*() {
      expect(yield* unsafeDivideValidated({ dividend: 10, divisor: 5 })).toStrictEqual(2)
    }))

  it.effect("fails with NumericDomainViolationError on zero divisor", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        unsafeDivideValidated({ dividend: 10, divisor: 0 })
      )
      expect(error._tag).toStrictEqual("NumericDomainViolationError")
      expect(error.operation).toStrictEqual("unsafeDivide")
    }))
})

describe("Numeric / logValidated", () => {
  it.effect("succeeds for positive finite input", () =>
    Effect.gen(function*() {
      expect(yield* logValidated({ value: Math.E })).toBeCloseTo(1)
    }))

  it.effect("rejects non-positive input", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(logValidated({ value: -1 }))
      expect(error._tag).toStrictEqual("NumericDecodeError")
      expect(error.operation).toStrictEqual("log")
    }))
})

describe("Numeric / sumValidated", () => {
  it.effect("sums a non-empty finite vector", () =>
    Effect.gen(function*() {
      expect(yield* sumValidated({ values: [1, 2, 3] })).toStrictEqual(6)
    }))

  it.effect("rejects empty array", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(sumValidated({ values: [] }))
      expect(error._tag).toStrictEqual("NumericDecodeError")
      expect(error.operation).toStrictEqual("sum")
    }))
})

describe("Numeric / argmaxValidated", () => {
  it.effect("returns index of maximum in non-empty vector", () =>
    Effect.gen(function*() {
      expect(Option.getOrThrow(yield* argmaxValidated({ values: [1, 5, 3] }))).toStrictEqual(1)
    }))

  it.effect("rejects NaN in vector", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(argmaxValidated({ values: [1, NaN, 3] }))
      expect(error._tag).toStrictEqual("NumericDecodeError")
    }))
})

describe("Numeric / sumWithPolicies", () => {
  it.effect("typed-array backend computes finite sum", () =>
    Effect.gen(function*() {
      const result = yield* sumWithPolicies([0.1, 0.2, 0.3])
      expect(Number.isFinite(result)).toStrictEqual(true)
      expect(result).toBeCloseTo(0.6)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("scalar backend computes finite sum", () =>
    Effect.gen(function*() {
      const result = yield* sumWithPolicies([0.1, 0.2, 0.3])
      expect(Number.isFinite(result)).toStrictEqual(true)
      expect(result).toBeCloseTo(0.6)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("strict precision rejects non-finite sum", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(sumWithPolicies([Infinity, 1, 2]))
      expect(error._tag).toStrictEqual("NumericDomainViolationError")
      expect(error.operation).toStrictEqual("sumWithPolicies")
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("relaxed precision allows non-finite sum", () =>
    Effect.gen(function*() {
      expect(yield* sumWithPolicies([Infinity, 1, 2])).toStrictEqual(Infinity)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("typed-array and scalar backends produce equivalent results for finite inputs", () =>
    Effect.gen(function*() {
      const values = [0.1, 0.2, 0.3, 0.4, 0.5]
      const typedArrayResult = yield* sumWithPolicies(values).pipe(
        Effect.provide(strictTypedArrayLayer)
      )
      const scalarResult = yield* sumWithPolicies(values).pipe(
        Effect.provide(relaxedScalarLayer)
      )
      expect(typedArrayResult).toBeCloseTo(scalarResult)
    }))

  it.effect("deterministic replay produces identical results", () =>
    Effect.gen(function*() {
      const values = [1.1, 2.2, 3.3]
      const runA = yield* sumWithPolicies(values).pipe(Effect.provide(strictTypedArrayLayer))
      const runB = yield* sumWithPolicies(values).pipe(Effect.provide(strictTypedArrayLayer))
      expect(EffectNumber.Equivalence(runA, runB)).toStrictEqual(true)
    }))
})

describe("Numeric / log1pWithPolicies", () => {
  it.effect("strict precision preserves accuracy for small x", () =>
    Effect.gen(function*() {
      const smallX = 1e-10
      const result = yield* log1pWithPolicies(smallX)
      expect(Number.isFinite(result)).toStrictEqual(true)
      expect(result).not.toStrictEqual(0)
      expect(result).toBeCloseTo(smallX, 15)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("relaxed precision computes ln(2) for x=1", () =>
    Effect.gen(function*() {
      expect(yield* log1pWithPolicies(1.0)).toBeCloseTo(Math.log(2))
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("strict and relaxed converge for large x", () =>
    Effect.gen(function*() {
      const largeX = 100.0
      const strictResult = yield* log1pWithPolicies(largeX).pipe(Effect.provide(strictTypedArrayLayer))
      const relaxedResult = yield* log1pWithPolicies(largeX).pipe(Effect.provide(relaxedScalarLayer))
      expect(strictResult).toBeCloseTo(relaxedResult)
    }))
})

describe("Numeric / expm1WithPolicies", () => {
  it.effect("strict precision preserves accuracy for small x", () =>
    Effect.gen(function*() {
      const smallX = 1e-10
      const result = yield* expm1WithPolicies(smallX)
      expect(Number.isFinite(result)).toStrictEqual(true)
      expect(result).not.toStrictEqual(0)
      expect(result).toBeCloseTo(smallX, 15)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("strict and relaxed converge for large x", () =>
    Effect.gen(function*() {
      const largeX = 10.0
      const strictResult = yield* expm1WithPolicies(largeX).pipe(Effect.provide(strictTypedArrayLayer))
      const relaxedResult = yield* expm1WithPolicies(largeX).pipe(Effect.provide(relaxedScalarLayer))
      expect(strictResult).toBeCloseTo(relaxedResult)
    }))
})
