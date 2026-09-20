import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Exit, FastCheck, MutableRef, Number, Schema } from "effect"

import * as Numeric from "../../src/Numeric.js"
import {
  bisect,
  bisectValidated,
  bisectWithPolicies,
  goldenSection,
  goldenSectionValidated,
  goldenSectionWithPolicies
} from "../../src/Optimization.js"
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

const kernelTolerance = 1e-10

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Numeric.abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

// ---------------------------------------------------------------------------
// Trusted operations — bisect
// ---------------------------------------------------------------------------

describe("Optimization / bisect", () => {
  it.effect("root of x²−2 ≈ √2", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.subtract(Number.multiply(x, x), 2)
      expectClose(bisect(f, 0, 2), Numeric.sqrt(2), kernelTolerance)
    }))

  it.effect("root of cos in [0,2] ≈ π/2", () =>
    Effect.gen(function*() {
      expectClose(bisect(Numeric.cos, 0, 2), Number.multiply(Numeric.pi, 0.5), kernelTolerance)
    }))

  it.effect("preserves bracket signs when products of function values underflow", () =>
    Effect.gen(function*() {
      const increasing = (x: number) => Number.multiply(1e-200, Number.subtract(x, 1.75))
      const decreasing = (x: number) => Number.negate(increasing(x))
      expectClose(bisect(increasing, 0, 2), 1.75, kernelTolerance)
      expectClose(bisect(decreasing, 0, 2), 1.75, kernelTolerance)
      expectClose(bisect(increasing, 2, 0), 1.75, kernelTolerance)
    }))

  it.effect("returns endpoint roots without evaluating the opposite endpoint", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const firstRoot = bisect(
        (x) => {
          MutableRef.increment(evaluations)
          return x
        },
        0,
        2
      )
      expect(firstRoot).toStrictEqual(0)
      expect(MutableRef.get(evaluations)).toStrictEqual(1)

      MutableRef.set(evaluations, 0)
      const secondRoot = bisect(
        (x) => {
          MutableRef.increment(evaluations)
          return Number.subtract(x, 2)
        },
        0,
        2
      )
      expect(secondRoot).toStrictEqual(2)
      expect(MutableRef.get(evaluations)).toStrictEqual(2)
    }))

  it.effect("stops at an asymmetric exact root without an extra callback", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const root = bisect(
        (x) => {
          MutableRef.increment(evaluations)
          return Number.subtract(x, 0.25)
        },
        0,
        2,
        1e-30,
        64
      )
      expect(root).toStrictEqual(0.25)
      expect(MutableRef.get(evaluations)).toStrictEqual(5)
    }))

  it.effect("continues narrowing when the interval width equals the tolerance", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const result = bisect(
        (x) => {
          MutableRef.increment(evaluations)
          return Number.subtract(x, 1.75)
        },
        0,
        2,
        2,
        1
      )
      expect(result).toBe(1.5)
      expect(MutableRef.get(evaluations)).toBe(3)
    }))

  it.effect("preserves reversed brackets and exact iteration-budget boundaries", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const f = (x: number) => Number.subtract(Number.multiply(x, x), 2)
      expectClose(bisect(f, 2, 0), Numeric.sqrt(2), kernelTolerance)

      const counted = (x: number) => {
        MutableRef.increment(evaluations)
        return f(x)
      }
      expect(bisect(counted, 0, 2, 1e-30, 0)).toStrictEqual(1)
      expect(MutableRef.get(evaluations)).toStrictEqual(2)

      MutableRef.set(evaluations, 0)
      expect(bisect(f, 0, 2, 1e-30, 1)).toStrictEqual(1.5)
      expect(bisect(counted, 0, 2, 1e-30, 1)).toStrictEqual(1.5)
      expect(MutableRef.get(evaluations)).toStrictEqual(3)

      MutableRef.set(evaluations, 0)
      expect(bisect(counted, 0, 2, 1e-30, 2)).toStrictEqual(1.25)
      expect(MutableRef.get(evaluations)).toStrictEqual(4)
    }))

  it.effect("rounds fractional iteration budgets up across batch boundaries", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const counted = () => {
        MutableRef.increment(evaluations)
        return 1
      }

      expect(bisect(counted, 0, 1, -1, 0.5)).toStrictEqual(0.75)
      expect(MutableRef.get(evaluations)).toStrictEqual(3)

      MutableRef.set(evaluations, 0)
      expect(bisect(counted, 0, 1, -1, 63.5)).toStrictEqual(1)
      expect(MutableRef.get(evaluations)).toStrictEqual(66)

      MutableRef.set(evaluations, 0)
      expect(bisect(counted, 0, 1, -1, 64.5)).toStrictEqual(1)
      expect(MutableRef.get(evaluations)).toStrictEqual(67)
    }))

  it.effect("routes a NaN midpoint by Number.Order for a finite bracket", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const result = bisect(
        (x) => {
          MutableRef.increment(evaluations)
          const centered = Number.subtract(x, 1)
          return Number.unsafeDivide(centered, Numeric.abs(centered))
        },
        0,
        2,
        -1,
        1
      )
      expect(result).toStrictEqual(0.5)
      expect(MutableRef.get(evaluations)).toStrictEqual(3)
    }))

  it.effect.prop("honors callback budgets on both sides of iteration-batch boundaries", {
    maxIterations: FastCheck.integer({ min: 60, max: 130 })
  }, ({ maxIterations }) =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const result = bisect(
        () => {
          MutableRef.increment(evaluations)
          return 1
        },
        0,
        1,
        -1,
        maxIterations
      )
      expect(result).toStrictEqual(1)
      expect(MutableRef.get(evaluations)).toStrictEqual(Number.sum(maxIterations, 2))
    }))

  it.effect("preserves capped nonfinite bracket behavior", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const maxIterations = 3
      const result = bisect(
        (x) => {
          MutableRef.increment(evaluations)
          return x
        },
        Number.unsafeDivide(0, 0),
        2,
        -1,
        maxIterations
      )
      expect(result).toBeNaN()
      expect(MutableRef.get(evaluations)).toStrictEqual(Number.sum(maxIterations, 2))
    }))

  it.effect("is stack safe for a large finite nonconverging budget", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const maxIterations = 50_000
      const result = bisect(
        () => {
          MutableRef.increment(evaluations)
          return 1
        },
        0,
        1,
        -1,
        maxIterations
      )
      expect(result).toStrictEqual(1)
      expect(MutableRef.get(evaluations)).toStrictEqual(Number.sum(maxIterations, 2))
    }))
})

// ---------------------------------------------------------------------------
// Pure kernel operations — goldenSection
// ---------------------------------------------------------------------------

describe("Optimization / goldenSection", () => {
  it.effect("minimum of x² is at 0", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.multiply(x, x)
      expectClose(goldenSection(f, -2, 2), 0, kernelTolerance)
    }))

  it.effect("minimum of (x−1)² is at 1", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.multiply(Number.subtract(x, 1), Number.subtract(x, 1))
      expectClose(goldenSection(f, -2, 4), 1, kernelTolerance)
    }))

  it.effect("caps an asymmetric objective without an extra callback", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const maxIterations = 3
      const result = goldenSection(
        (x) => {
          MutableRef.increment(evaluations)
          return Number.multiply(Number.subtract(x, 0.3), Number.subtract(x, 0.3))
        },
        0,
        2,
        1e-30,
        maxIterations
      )
      expectClose(result, 0.2360679774997897, 1e-15)
      expect(MutableRef.get(evaluations)).toStrictEqual(Number.sum(maxIterations, 2))
    }))

  it.effect("returns before narrowing when the initial interval satisfies tolerance", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const result = goldenSection(
        (x) => {
          MutableRef.increment(evaluations)
          return Number.multiply(Number.subtract(x, 0.3), Number.subtract(x, 0.3))
        },
        0,
        2,
        3,
        64
      )
      expect(result).toStrictEqual(1)
      expect(MutableRef.get(evaluations)).toStrictEqual(2)
    }))

  it.effect.prop("keeps the right-hand interval on ties at the tolerance boundary", {
    start: FastCheck.integer({ min: -128, max: 128 }),
    width: FastCheck.integer({ min: 1, max: 512 }),
    value: FastCheck.constantFrom(0, -0, 5, Number.unsafeDivide(0, 0))
  }, ({ start, width, value }) =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const result = goldenSection(
        () => {
          MutableRef.increment(evaluations)
          return value
        },
        start,
        Number.sum(start, width),
        width,
        1
      )
      // One right-hand contraction advances the midpoint by
      // width * (5 - sqrt(5)) / 4. Effect Order also selects that branch
      // for unordered objective values.
      expectClose(result, Number.sum(start, Number.multiply(width, 0.6909830056250525)), 2e-13)
      expect(MutableRef.get(evaluations)).toBe(3)
    }))

  it.effect("preserves capped nonfinite interval behavior", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const maxIterations = 3
      const infinity = Number.unsafeDivide(1, 0)
      const result = goldenSection(
        (x) => {
          MutableRef.increment(evaluations)
          return Number.multiply(x, x)
        },
        Number.negate(infinity),
        infinity,
        -1,
        maxIterations
      )
      expect(result).toBeNaN()
      expect(MutableRef.get(evaluations)).toStrictEqual(Number.sum(maxIterations, 2))
    }))

  it.effect("preserves reversed intervals and the zero-iteration callback budget", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const objective = (x: number) => {
        MutableRef.increment(evaluations)
        return Number.multiply(x, x)
      }
      expectClose(goldenSection(objective, 2, -2), 0, kernelTolerance)
      MutableRef.set(evaluations, 0)
      expect(goldenSection(objective, -2, 2, 1e-30, 0)).toStrictEqual(0)
      expect(MutableRef.get(evaluations)).toStrictEqual(2)
    }))

  it.effect("honors exact iteration-budget callback and interval boundaries", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const objective = (_x: number) => {
        MutableRef.increment(evaluations)
        return 1
      }
      const phi = Number.multiply(0.5, Number.subtract(Numeric.sqrt(5), 1))
      const complement = Number.subtract(1, phi)
      const x1 = Number.multiply(complement, 2)
      const x2 = Number.multiply(phi, 2)

      expect(goldenSection(objective, 0, 2, 1e-30, 0)).toStrictEqual(1)
      expect(MutableRef.get(evaluations)).toStrictEqual(2)

      MutableRef.set(evaluations, 0)
      expect(goldenSection(objective, 0, 2, 1e-30, 1)).toStrictEqual(
        Number.multiply(0.5, Number.sum(x1, 2))
      )
      expect(MutableRef.get(evaluations)).toStrictEqual(3)

      MutableRef.set(evaluations, 0)
      expect(goldenSection(objective, 0, 2, 1e-30, 2)).toStrictEqual(
        Number.multiply(0.5, Number.sum(x2, 2))
      )
      expect(MutableRef.get(evaluations)).toStrictEqual(4)
    }))

  it.effect.prop("honors callback budgets on both sides of iteration-batch boundaries", {
    maxIterations: FastCheck.integer({ min: 60, max: 130 })
  }, ({ maxIterations }) =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const result = goldenSection(
        () => {
          MutableRef.increment(evaluations)
          return 1
        },
        0,
        1,
        -1,
        maxIterations
      )
      expectClose(result, 1, kernelTolerance)
      expect(MutableRef.get(evaluations)).toStrictEqual(Number.sum(maxIterations, 2))
    }))

  it.effect("normalizes fractional budgets across the iteration-batch boundary", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const objective = () => {
        MutableRef.increment(evaluations)
        return 1
      }

      expectClose(goldenSection(objective, 0, 1, -1, 0.5), 0.6909830056250525, 1e-15)
      expect(MutableRef.get(evaluations)).toStrictEqual(3)

      MutableRef.set(evaluations, 0)
      expectClose(goldenSection(objective, 0, 1, -1, 63.5), 1, kernelTolerance)
      expect(MutableRef.get(evaluations)).toStrictEqual(66)

      MutableRef.set(evaluations, 0)
      expectClose(goldenSection(objective, 0, 1, -1, 64.5), 1, kernelTolerance)
      expect(MutableRef.get(evaluations)).toStrictEqual(67)
    }))

  it.effect("preserves the evaluation sequence when an objective runs a nested search", () =>
    Effect.gen(function*() {
      const baselineTrace = MutableRef.make(Chunk.empty<number>())
      const nestedTrace = MutableRef.make(Chunk.empty<number>())
      const nestedEvaluations = MutableRef.make(0)
      const evaluate = (x: number) => Number.multiply(Number.subtract(x, 0.3), Number.subtract(x, 0.3))
      const baseline = goldenSection(
        (x) => {
          MutableRef.update(baselineTrace, Chunk.append(x))
          return evaluate(x)
        },
        0,
        2,
        1e-30,
        65
      )
      const nested = goldenSection(
        (x) => {
          MutableRef.update(nestedTrace, Chunk.append(x))
          goldenSection(
            (y) => {
              MutableRef.increment(nestedEvaluations)
              return Number.multiply(Number.subtract(y, 0.25), Number.subtract(y, 0.25))
            },
            -1,
            1,
            1e-30,
            2
          )
          return evaluate(x)
        },
        0,
        2,
        1e-30,
        65
      )

      expect(nested).toStrictEqual(baseline)
      expect(Chunk.toReadonlyArray(MutableRef.get(nestedTrace))).toStrictEqual(
        Chunk.toReadonlyArray(MutableRef.get(baselineTrace))
      )
      expect(Chunk.size(MutableRef.get(nestedTrace))).toStrictEqual(67)
      expect(MutableRef.get(nestedEvaluations)).toStrictEqual(Number.multiply(67, 4))
    }))

  it.effect("is stack safe for a large finite nonconverging budget", () =>
    Effect.gen(function*() {
      const evaluations = MutableRef.make(0)
      const maxIterations = 50_000
      const result = goldenSection(
        () => {
          MutableRef.increment(evaluations)
          return 1
        },
        0,
        1,
        -1,
        maxIterations
      )
      expect(result).toStrictEqual(1)
      expect(MutableRef.get(evaluations)).toStrictEqual(Number.sum(maxIterations, 2))
    }))
})

// ---------------------------------------------------------------------------
// Validated boundary operations
// ---------------------------------------------------------------------------

describe("Optimization / bisectValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.subtract(Number.multiply(x, x), 2)
      const result = yield* bisectValidated(f, { a: 0, b: 2 })
      expectClose(result, Numeric.sqrt(2), kernelTolerance)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.subtract(Number.multiply(x, x), 2)
      const result = yield* Effect.exit(bisectValidated(f, { a: 0, b: 2, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))

  it.effect("maps failed callbacks to typed kernel failures", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(bisectValidated(
        () => Schema.decodeUnknownSync(Schema.Number)({ malformed: true }),
        { a: 0, b: 2 }
      ))
      expect(error._tag).toStrictEqual("KernelExecutionError")
      expect(error.operation).toStrictEqual("bisect")
    }))
})

describe("Optimization / goldenSectionValidated", () => {
  it.effect("decodes valid input", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.multiply(x, x)
      const result = yield* goldenSectionValidated(f, { a: -2, b: 2 })
      expectClose(result, 0, kernelTolerance)
    }))

  it.effect("rejects excess properties", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.multiply(x, x)
      const result = yield* Effect.exit(goldenSectionValidated(f, { a: -2, b: 2, extra: true }))
      expect(Exit.isFailure(result)).toBe(true)
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Optimization / bisectWithPolicies", () => {
  it.effect("returns correct result under strict+compensated", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.subtract(Number.multiply(x, x), 2)
      const result = yield* bisectWithPolicies(f, 0, 2)
      expectClose(result, Numeric.sqrt(2), kernelTolerance)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.subtract(Number.multiply(x, x), 2)
      const result = yield* bisectWithPolicies(f, 0, 2)
      expectClose(result, Numeric.sqrt(2), kernelTolerance)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})

describe("Optimization / goldenSectionWithPolicies", () => {
  it.effect("returns correct result under strict+compensated", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.multiply(x, x)
      const result = yield* goldenSectionWithPolicies(f, -2, 2)
      expectClose(result, 0, kernelTolerance)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("returns correct result under relaxed+scalar", () =>
    Effect.gen(function*() {
      const f = (x: number) => Number.multiply(x, x)
      const result = yield* goldenSectionWithPolicies(f, -2, 2)
      expectClose(result, 0, kernelTolerance)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("maps objective callback failures instead of producing defects", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(goldenSectionWithPolicies(
        () => Schema.decodeUnknownSync(Schema.Number)({ malformed: true }),
        -2,
        2
      ))
      expect(error._tag).toStrictEqual("KernelExecutionError")
      expect(error.operation).toStrictEqual("goldenSectionWithPolicies")
    }).pipe(Effect.provide(strictCompensatedLayer)))
})
