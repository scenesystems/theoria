import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, Equal, Exit, FastCheck, Number, Predicate, Schema } from "effect"

import {
  factorial,
  factorialValidated,
  factorialWithPolicies,
  gcd,
  gcdValidated,
  gcdWithPolicies,
  lcm,
  lcmValidated,
  lcmWithPolicies,
  polyDerivative,
  polyDerivativeValidated,
  polyDerivativeWithPolicies,
  polyEval,
  polyEvalValidated,
  polyEvalWithPolicies
} from "../../src/Algebra.js"
import * as Policy from "../../src/Policy.js"

const strictCompensatedLayer = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "strict",
  backend: "compensated",
  diagnostics: "enabled"
})

const relaxedScalarLayer = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
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
      expect(polyEval(Chunk.of(5), 3)).toStrictEqual(5)
    }))

  it.effect("evaluates linear polynomial", () =>
    Effect.gen(function*() {
      expect(polyEval(Chunk.make(2, 3), 1)).toStrictEqual(5)
    }))

  it.effect("evaluates quadratic polynomial", () =>
    Effect.gen(function*() {
      expect(polyEval(Chunk.make(1, Number.negate(2), 1), 3)).toStrictEqual(4)
    }))

  it.effect("evaluates at x=0 returns a0", () =>
    Effect.gen(function*() {
      expect(polyEval(Chunk.make(1, 2, 3), 0)).toStrictEqual(1)
    }))

  it.effect("evaluates empty coefficients as 0", () =>
    Effect.gen(function*() {
      expect(polyEval(Chunk.empty(), 5)).toStrictEqual(0)
    }))

  it.effect("does not multiply a constant coefficient by a non-finite evaluation point", () =>
    Effect.gen(function*() {
      expect(polyEval(Chunk.of(Number.negate(7)), Number.unsafeDivide(1, 0))).toBe(Number.negate(7))
      expect(polyEval(Chunk.of(Number.negate(0)), Number.unsafeDivide(0, 0))).toBe(Number.negate(0))
      expect(polyEval(Chunk.empty(), Number.unsafeDivide(0, 0))).toBe(0)
    }))

  it.effect.prop("evaluates coefficients in lowest-degree-first order", {
    constant: FastCheck.integer({ min: Number.negate(20), max: 20 }),
    linear: FastCheck.integer({ min: Number.negate(20), max: 20 }),
    quadratic: FastCheck.integer({ min: Number.negate(20), max: 20 }),
    x: FastCheck.integer({ min: Number.negate(10), max: 10 })
  }, ({ constant, linear, quadratic, x }) =>
    Effect.gen(function*() {
      const expected = Number.sum(
        Number.sum(constant, Number.multiply(linear, x)),
        Number.multiply(quadratic, Number.multiply(x, x))
      )
      expect(polyEval(Chunk.make(constant, linear, quadratic), x)).toBe(expected)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — polyDerivative
// ---------------------------------------------------------------------------

describe("Algebra / polyDerivative", () => {
  it.effect("constant polynomial derivative is [0]", () =>
    Effect.gen(function*() {
      expect(Equal.equals(polyDerivative(Chunk.of(5)), Chunk.of(0))).toBe(true)
    }))

  it.effect("linear polynomial derivative", () =>
    Effect.gen(function*() {
      expect(Equal.equals(polyDerivative(Chunk.make(3, 2)), Chunk.of(2))).toBe(true)
    }))

  it.effect("quadratic polynomial derivative", () =>
    Effect.gen(function*() {
      expect(Equal.equals(polyDerivative(Chunk.make(1, Number.negate(2), 1)), Chunk.make(Number.negate(2), 2))).toBe(
        true
      )
    }))

  it.effect("differentiates the empty polynomial to a single zero coefficient", () =>
    Effect.gen(function*() {
      expect(polyDerivative(Chunk.empty())).toEqual(Chunk.of(0))
    }))

  it.effect("weights each nonconstant coefficient by its original degree", () =>
    Effect.gen(function*() {
      expect(Equal.equals(
        polyDerivative(Chunk.make(17, Number.negate(3), 5, Number.negate(2))),
        Chunk.make(Number.negate(3), 10, Number.negate(6))
      )).toBe(true)
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — gcd
// ---------------------------------------------------------------------------

describe("Algebra / gcd", () => {
  it.effect("normalizes signs and retains integers beyond the safe range", () =>
    Effect.gen(function*() {
      expect(gcd(Number.negate(12), 8)).toBe(4)
      expect(gcd(12, Number.negate(8))).toBe(4)
      expect(gcd(0, 0)).toBe(0)
      // The actual binary64 integer ends in 104, unlike the decimal 10^100.
      expect(gcd(1e100, 5)).toBe(1)
      expect(gcd(Number.negate(1e20), 0)).toBe(1e20)
      expect(gcd(1.5, 3)).toBeNaN()
    }))

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

  it.effect("normalizes a signed-zero result to positive zero", () =>
    Effect.gen(function*() {
      expect(Number.unsafeDivide(1, gcd(Number.negate(0), 0))).toBe(Infinity)
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
  it.effect("avoids intermediate product rounding and handles signed and zero operands", () =>
    Effect.gen(function*() {
      // 2^52 - 1 is divisible by three, but its product with three is not
      // representable in binary64. The exact lcm is the original operand.
      expect(lcm(4_503_599_627_370_495, 3)).toBe(4_503_599_627_370_495)
      expect(lcm(Number.negate(12), 8)).toBe(24)
      expect(lcm(12, Number.negate(8))).toBe(24)
      expect(lcm(0, 0)).toBe(0)
      expect(lcm(1e20, 5)).toBe(1e20)
    }))

  it.effect("lcm(12, 8) = 24", () =>
    Effect.gen(function*() {
      expect(lcm(12, 8)).toStrictEqual(24)
    }))

  it.effect("lcm(0, 5) = 0", () =>
    Effect.gen(function*() {
      expect(lcm(0, 5)).toStrictEqual(0)
    }))

  it.effect("returns positive zero when either lcm operand is signed zero", () =>
    Effect.gen(function*() {
      expect(Number.unsafeDivide(1, lcm(Number.negate(0), 5))).toBe(Infinity)
      expect(Number.unsafeDivide(1, lcm(5, Number.negate(0)))).toBe(Infinity)
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

  it.effect("returns numeric overflow instead of exhausting the call stack", () =>
    Effect.gen(function*() {
      expect(factorial(20_000)).toBe(Number.unsafeDivide(1, 0))
    }))

  it.effect("preserves the pure kernel's unit result for negative input", () =>
    Effect.gen(function*() {
      expect(factorial(Number.negate(3))).toBe(1)
    }))
})

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

describe("Algebra / polyEvalValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* polyEvalValidated({ coefficients: Array.make(1, Number.negate(2), 1), x: 3 })
      expect(result).toStrictEqual(4)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(polyEvalValidated({ coefficients: Array.of(1), x: 1, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))

  it.effect("rejects non-finite coefficients at the validated boundary", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(polyEvalValidated({ coefficients: Array.make(1, Infinity), x: 1 }))
      expect(error._tag).toBe("AlgebraDecodeError")
      expect(error.operation).toBe("polyEval")
    }))
})

describe("Algebra / polyDerivativeValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const result = yield* polyDerivativeValidated({ coefficients: Array.make(3, 2) })
      expect(Equal.equals(result, Chunk.of(2))).toBe(true)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(polyDerivativeValidated({ coefficients: Array.of(1), extra: true }))
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
      const result = yield* Effect.exit(factorialValidated({ n: Number.negate(1) }))
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
  it.effect("returns correct result under strict+compensated", () =>
    Effect.gen(function*() {
      const result = yield* polyEvalWithPolicies(Chunk.make(1, Number.negate(2), 1), 3)
      expect(result).toStrictEqual(4)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const result = yield* polyEvalWithPolicies(Chunk.make(1, Number.negate(2), 1), 3)
      expect(result).toStrictEqual(4)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Algebra / factorialWithPolicies", () => {
  it.effect("returns correct result under strict", () =>
    Effect.gen(function*() {
      const result = yield* factorialWithPolicies(5)
      expect(result).toStrictEqual(120)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns correct result under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* factorialWithPolicies(5)
      expect(result).toStrictEqual(120)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("strict rejects non-finite result", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(factorialWithPolicies(200))
      expect(Exit.isFailure(result)).toBe(true)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("reports large factorial overflow as a typed failure rather than a defect", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(factorialWithPolicies(20_000))
      expect(error._tag).toBe("AlgebraDomainViolationError")
      expect(error.operation).toBe("factorialWithPolicies")
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("relaxed passes through non-finite result", () =>
    Effect.gen(function*() {
      const result = yield* factorialWithPolicies(200)
      expect(Predicate.not(Schema.is(Schema.Finite))(result)).toBe(true)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Algebra / polyDerivativeWithPolicies", () => {
  it.effect("returns correct derivative under strict", () =>
    Effect.gen(function*() {
      const result = yield* polyDerivativeWithPolicies(Chunk.make(1, Number.negate(2), 1))
      expect(Equal.equals(result, Chunk.make(Number.negate(2), 2))).toBe(true)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns correct derivative under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* polyDerivativeWithPolicies(Chunk.make(3, 2))
      expect(Equal.equals(result, Chunk.of(2))).toBe(true)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Algebra / gcdWithPolicies", () => {
  it.effect("returns correct gcd under strict", () =>
    Effect.gen(function*() {
      const result = yield* gcdWithPolicies(12, 8)
      expect(result).toStrictEqual(4)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns correct gcd under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* gcdWithPolicies(7, 13)
      expect(result).toStrictEqual(1)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Algebra / lcmWithPolicies", () => {
  it.effect("returns correct lcm under strict", () =>
    Effect.gen(function*() {
      const result = yield* lcmWithPolicies(12, 8)
      expect(result).toStrictEqual(24)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns correct lcm under relaxed", () =>
    Effect.gen(function*() {
      const result = yield* lcmWithPolicies(7, 13)
      expect(result).toStrictEqual(91)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})
