import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Exit, Schema } from "effect"

import {
  factorial,
  factorialValidated,
  factorialWithPolicies,
  gcd,
  gcdValidated,
  lcm,
  lcmValidated,
  polyDerivative,
  polyDerivativeValidated,
  polyEval,
  polyEvalValidated,
  polyEvalWithPolicies
} from "../../src/Algebra/operations.js"
import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"

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

// ---------------------------------------------------------------------------
// Pure kernel operations — polyEval
// ---------------------------------------------------------------------------

describe("Algebra / polyEval", () => {
  it.effect("evaluates constant polynomial", () =>
    Effect.gen(function*() {
      expect(polyEval(Chunk.fromIterable([5]), 3)).toStrictEqual(5)
    }))

  it.effect("evaluates linear polynomial", () =>
    Effect.gen(function*() {
      expect(polyEval(Chunk.fromIterable([2, 3]), 1)).toStrictEqual(5)
    }))

  it.effect("evaluates quadratic polynomial", () =>
    Effect.gen(function*() {
      expect(polyEval(Chunk.fromIterable([1, -2, 1]), 3)).toStrictEqual(4)
    }))

  it.effect("evaluates at x=0 returns a0", () =>
    Effect.gen(function*() {
      expect(polyEval(Chunk.fromIterable([1, 2, 3]), 0)).toStrictEqual(1)
    }))

  it.effect("evaluates empty coefficients as 0", () =>
    Effect.gen(function*() {
      expect(polyEval(Chunk.empty(), 5)).toStrictEqual(0)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — polyDerivative
// ---------------------------------------------------------------------------

describe("Algebra / polyDerivative", () => {
  it.effect("constant polynomial derivative is [0]", () =>
    Effect.gen(function*() {
      expect(Chunk.toReadonlyArray(polyDerivative(Chunk.fromIterable([5])))).toStrictEqual([0])
    }))

  it.effect("linear polynomial derivative", () =>
    Effect.gen(function*() {
      expect(Chunk.toReadonlyArray(polyDerivative(Chunk.fromIterable([3, 2])))).toStrictEqual([2])
    }))

  it.effect("quadratic polynomial derivative", () =>
    Effect.gen(function*() {
      expect(Chunk.toReadonlyArray(polyDerivative(Chunk.fromIterable([1, -2, 1])))).toStrictEqual([-2, 2])
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — gcd
// ---------------------------------------------------------------------------

describe("Algebra / gcd", () => {
  it.effect("gcd(12, 8) = 4", () =>
    Effect.gen(function*() {
      expect(gcd(12, 8)).toStrictEqual(4)
    }))

  it.effect("gcd(0, 5) = 5", () =>
    Effect.gen(function*() {
      expect(gcd(0, 5)).toStrictEqual(5)
    }))

  it.effect("gcd(5, 0) = 5", () =>
    Effect.gen(function*() {
      expect(gcd(5, 0)).toStrictEqual(5)
    }))

  it.effect("gcd of coprimes is 1", () =>
    Effect.gen(function*() {
      expect(gcd(7, 13)).toStrictEqual(1)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — lcm
// ---------------------------------------------------------------------------

describe("Algebra / lcm", () => {
  it.effect("lcm(12, 8) = 24", () =>
    Effect.gen(function*() {
      expect(lcm(12, 8)).toStrictEqual(24)
    }))

  it.effect("lcm(0, 5) = 0", () =>
    Effect.gen(function*() {
      expect(lcm(0, 5)).toStrictEqual(0)
    }))

  it.effect("lcm of coprimes is product", () =>
    Effect.gen(function*() {
      expect(lcm(7, 13)).toStrictEqual(91)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — factorial
// ---------------------------------------------------------------------------

describe("Algebra / factorial", () => {
  it.effect("0! = 1", () =>
    Effect.gen(function*() {
      expect(factorial(0)).toStrictEqual(1)
    }))

  it.effect("5! = 120", () =>
    Effect.gen(function*() {
      expect(factorial(5)).toStrictEqual(120)
    }))

  it.effect("10! = 3628800", () =>
    Effect.gen(function*() {
      expect(factorial(10)).toStrictEqual(3628800)
    }))
})

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

describe("Algebra / polyEvalValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* polyEvalValidated({ coefficients: [1, -2, 1], x: 3 })
      expect(result).toStrictEqual(4)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(polyEvalValidated({ coefficients: [1], x: 1, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

describe("Algebra / polyDerivativeValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* polyDerivativeValidated({ coefficients: [3, 2] })
      expect(Chunk.toReadonlyArray(result)).toStrictEqual([2])
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(polyDerivativeValidated({ coefficients: [1], extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

describe("Algebra / gcdValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* gcdValidated({ a: 12, b: 8 })
      expect(result).toStrictEqual(4)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(gcdValidated({ a: 12, b: 8, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

describe("Algebra / lcmValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* lcmValidated({ a: 12, b: 8 })
      expect(result).toStrictEqual(24)
    }))
})

describe("Algebra / factorialValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* factorialValidated({ n: 5 })
      expect(result).toStrictEqual(120)
    }))

  it.effect("rejects negative n", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(factorialValidated({ n: -1 }))
      expect(Exit.isFailure(result)).toBe(true)
    }))

  it.effect("rejects non-integer n", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(factorialValidated({ n: 2.5 }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Algebra / polyEvalWithPolicies", () => {
  it.effect("returns correct result under strict+typed-array", () =>
    Effect.gen(function*() {
      const result = yield* polyEvalWithPolicies(Chunk.fromIterable([1, -2, 1]), 3)
      expect(result).toStrictEqual(4)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const result = yield* polyEvalWithPolicies(Chunk.fromIterable([1, -2, 1]), 3)
      expect(result).toStrictEqual(4)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Algebra / factorialWithPolicies", () => {
  it.effect("returns correct result under strict", () =>
    Effect.gen(function*() {
      const result = yield* factorialWithPolicies(5)
      expect(result).toStrictEqual(120)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("returns correct result under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* factorialWithPolicies(5)
      expect(result).toStrictEqual(120)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("strict rejects non-finite result", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(factorialWithPolicies(200))
      expect(Exit.isFailure(result)).toBe(true)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("relaxed passes through non-finite result", () =>
    Effect.gen(function*() {
      const result = yield* factorialWithPolicies(200)
      expect(Number.isFinite(result)).toBe(false)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})
