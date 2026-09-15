import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, Equal, Number, Option, Schema, Tuple } from "effect"

import { sqrt } from "../../src/Numeric/index.js"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
  backwardSubstitutionUpper,
  cholesky,
  dot,
  dotValidated,
  dotWithPolicies,
  forwardSubstitutionLower,
  frobeniusNorm,
  matvec,
  matvecValidated,
  normL1,
  normL2,
  normLinf,
  normValidated,
  normWithPolicies,
  solveSpd,
  transpose,
  transposeValidated,
  vectorAdd,
  vectorScale
} from "../../src/LinearAlgebra/operations.js"

const strictCompensatedLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(42),
  precision: "strict",
  backend: "compensated",
  diagnostics: "enabled"
})

const relaxedScalarLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

// ---------------------------------------------------------------------------
// Pure kernel operations
// ---------------------------------------------------------------------------

describe("LinearAlgebra / dot", () => {
  it.effect("computes dot product of two chunks", () =>
    Effect.gen(function*() {
      const a = Chunk.make(1, 2, 3)
      const b = Chunk.make(4, 5, 6)
      expect(dot(a, b)).toStrictEqual(32)
    }))

  it.effect("returns zero for orthogonal vectors", () =>
    Effect.gen(function*() {
      const a = Chunk.make(1, 0)
      const b = Chunk.make(0, 1)
      expect(dot(a, b)).toStrictEqual(0)
    }))

  it.effect("returns zero for empty chunks", () =>
    Effect.gen(function*() {
      expect(dot(Chunk.empty(), Chunk.empty())).toStrictEqual(0)
    }))
})

describe("LinearAlgebra / normL2", () => {
  it.effect("computes Euclidean norm of unit vector", () =>
    Effect.gen(function*() {
      expect(normL2(Chunk.make(1, 0, 0))).toStrictEqual(1)
    }))

  it.effect("computes Euclidean norm of [3, 4]", () =>
    Effect.gen(function*() {
      expect(normL2(Chunk.make(3, 4))).toStrictEqual(5)
    }))

  it.effect("avoids overflow while normalizing large finite components", () =>
    Effect.gen(function*() {
      const result = normL2(Chunk.make(1e308, 1e308))
      expect(Schema.is(Schema.Finite)(result)).toBe(true)
      expect(Number.greaterThan(result, 1e308)).toBe(true)
    }))
})

describe("LinearAlgebra / normL1", () => {
  it.effect("computes L1 norm", () =>
    Effect.gen(function*() {
      expect(normL1(Chunk.make(Number.negate(1), 2, Number.negate(3)))).toStrictEqual(6)
    }))
})

describe("LinearAlgebra / normLinf", () => {
  it.effect("computes infinity norm", () =>
    Effect.gen(function*() {
      expect(normLinf(Chunk.make(Number.negate(1), 5, Number.negate(3)))).toStrictEqual(5)
    }))
})

describe("LinearAlgebra / vectorAdd", () => {
  it.effect("adds two vectors elementwise", () =>
    Effect.gen(function*() {
      const result = vectorAdd(Chunk.make(1, 2, 3), Chunk.make(4, 5, 6))
      expect(Equal.equals(result, Chunk.make(5, 7, 9))).toBe(true)
    }))
})

describe("LinearAlgebra / vectorScale", () => {
  it.effect("scales vector by scalar", () =>
    Effect.gen(function*() {
      const result = vectorScale(2, Chunk.make(1, 2, 3))
      expect(Equal.equals(result, Chunk.make(2, 4, 6))).toBe(true)
    }))
})

describe("LinearAlgebra / matvec", () => {
  it.effect("multiplies identity matrix by vector", () =>
    Effect.gen(function*() {
      const identity = Chunk.make(1, 0, 0, 1)
      const x = Chunk.make(3, 7)
      const result = matvec(identity, 2, 2, x)
      expect(Equal.equals(result, x)).toBe(true)
    }))

  it.effect("multiplies 2x3 matrix by 3-vector", () =>
    Effect.gen(function*() {
      const data = Chunk.make(1, 2, 3, 4, 5, 6)
      const x = Chunk.make(1, 1, 1)
      const result = matvec(data, 2, 3, x)
      expect(Equal.equals(result, Chunk.make(6, 15))).toBe(true)
    }))
})

describe("LinearAlgebra / transpose", () => {
  it.effect("transposes a 2x3 matrix", () =>
    Effect.gen(function*() {
      const data = Chunk.make(1, 2, 3, 4, 5, 6)
      const result = transpose(data, 2, 3)
      expect(Equal.equals(result, Chunk.make(1, 4, 2, 5, 3, 6))).toBe(true)
    }))

  it.effect("double transpose is identity", () =>
    Effect.gen(function*() {
      const data = Chunk.make(1, 2, 3, 4, 5, 6)
      const first = transpose(data, 2, 3)
      const second = transpose(first, 3, 2)
      expect(Equal.equals(second, data)).toBe(true)
    }))
})

describe("LinearAlgebra / frobeniusNorm", () => {
  it.effect("computes Frobenius norm of identity matrix", () =>
    Effect.gen(function*() {
      const identity = Chunk.make(1, 0, 0, 1)
      expect(frobeniusNorm(identity, 2, 2)).toBeCloseTo(sqrt(2))
    }))
})

describe("LinearAlgebra / cholesky", () => {
  it.effect("decomposes SPD matrix into lower-triangular factor", () =>
    Effect.gen(function*() {
      const decomposed = cholesky(Chunk.make(4, 2, 2, 3), 2)
      expect(Option.isSome(decomposed)).toStrictEqual(true)
      Option.map(decomposed, (values) => {
        expect(Option.getOrElse(Chunk.get(values, 0), () => 0)).toBeCloseTo(2)
        expect(Option.getOrElse(Chunk.get(values, 1), () => 1)).toBeCloseTo(0)
        expect(Option.getOrElse(Chunk.get(values, 2), () => 0)).toBeCloseTo(1)
        expect(Option.getOrElse(Chunk.get(values, 3), () => 0)).toBeCloseTo(sqrt(2))
      })
    }))

  it.effect("returns none for non-SPD input", () =>
    Effect.gen(function*() {
      const decomposed = cholesky(Chunk.make(1, 2, 2, 1), 2)
      expect(Option.isNone(decomposed)).toStrictEqual(true)
    }))

  it.effect("returns none for non-symmetric input", () =>
    Effect.gen(function*() {
      const decomposed = cholesky(Chunk.make(2, 1, 0, 2), 2)
      expect(Option.isNone(decomposed)).toStrictEqual(true)
    }))

  it.effect("preserves row-major pivot order for a three-dimensional factor", () =>
    Effect.gen(function*() {
      const decomposed = cholesky(
        Chunk.make(25, 15, Number.negate(5), 15, 18, 0, Number.negate(5), 0, 11),
        3
      )
      expect(Option.isSome(decomposed)).toBe(true)
      Option.map(decomposed, (lower) =>
        expect(Equal.equals(
          lower,
          Chunk.make(5, 0, 0, 3, 3, 0, Number.negate(1), 1, 3)
        )).toBe(true))
    }))
})

describe("LinearAlgebra / forwardSubstitutionLower", () => {
  it.effect("solves lower-triangular systems", () =>
    Effect.gen(function*() {
      const lower = Chunk.make(2, 0, 1, 2)
      const rhs = Chunk.make(4, 5)
      const solved = forwardSubstitutionLower(lower, 2, rhs)
      expect(Option.isSome(solved)).toStrictEqual(true)

      Option.map(solved, (values) => expect(Equal.equals(values, Chunk.make(2, 1.5))).toBe(true))
    }))
})

describe("LinearAlgebra / backwardSubstitutionUpper", () => {
  it.effect("solves upper-triangular systems", () =>
    Effect.gen(function*() {
      const upper = Chunk.make(2, 1, 0, 2)
      const rhs = Chunk.make(5, 4)
      const solved = backwardSubstitutionUpper(upper, 2, rhs)
      expect(Option.isSome(solved)).toStrictEqual(true)

      Option.map(solved, (values) => expect(Equal.equals(values, Chunk.make(1.5, 2))).toBe(true))
    }))
})

describe("LinearAlgebra / solveSpd", () => {
  it.effect("solves SPD systems with Cholesky path", () =>
    Effect.gen(function*() {
      const matrix = Chunk.make(4, 1, 1, 3)
      const rhs = Chunk.make(1, 2)
      const solved = solveSpd(matrix, 2, rhs)
      expect(Option.isSome(solved)).toStrictEqual(true)

      Option.map(solved, (values) => {
        expect(Option.getOrElse(Chunk.get(values, 0), () => 0)).toBeCloseTo(Number.unsafeDivide(1, 11))
        expect(Option.getOrElse(Chunk.get(values, 1), () => 0)).toBeCloseTo(Number.unsafeDivide(7, 11))
      })
    }))

  it.effect("returns none for invalid matrix shape", () =>
    Effect.gen(function*() {
      const solved = solveSpd(Chunk.make(1, 0, 0), 2, Chunk.make(1, 2))
      expect(Option.isNone(solved)).toStrictEqual(true)
    }))

  it.effect("returns none for non-symmetric matrix", () =>
    Effect.gen(function*() {
      const solved = solveSpd(Chunk.make(2, 1, 0, 2), 2, Chunk.make(1, 1))
      expect(Option.isNone(solved)).toStrictEqual(true)
    }))

  it.effect("solves an asymmetric-value three-dimensional SPD system in row-major order", () =>
    Effect.gen(function*() {
      const solved = solveSpd(
        Chunk.make(25, 15, Number.negate(5), 15, 18, 0, Number.negate(5), 0, 11),
        3,
        Chunk.make(40, 51, 28)
      )
      expect(Option.isSome(solved)).toBe(true)
      Option.map(solved, (solution) => {
        Chunk.forEach(Chunk.zip(solution, Chunk.make(1, 2, 3)), (pair) =>
          expect(Tuple.getFirst(pair)).toBeCloseTo(Tuple.getSecond(pair)))
      })
    }))
})

// ---------------------------------------------------------------------------
// Effect-wrapped operations
// ---------------------------------------------------------------------------

describe("LinearAlgebra / dotValidated", () => {
  it.effect("decodes valid input and computes dot product", () =>
    Effect.gen(function*() {
      const result = yield* dotValidated({ a: Array.make(1, 2, 3), b: Array.make(4, 5, 6) })
      expect(result).toStrictEqual(32)
    }))

  it.effect("rejects excess properties with LinearAlgebraDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        dotValidated({ a: Array.make(1, 2), b: Array.make(3, 4), extra: true })
      )
      expect(error._tag).toStrictEqual("LinearAlgebraDecodeError")
      expect(error.operation).toStrictEqual("dot")
    }))

  it.effect("rejects mismatched vector lengths with ShapeMismatchError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        dotValidated({ a: Array.make(1, 2, 3), b: Array.make(4, 5) })
      )
      expect(error._tag).toStrictEqual("ShapeMismatchError")
      expect(error.operation).toStrictEqual("dot")
    }))

  it.effect("rejects non-finite input with LinearAlgebraDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        dotValidated({ a: Array.make(1, Infinity), b: Array.make(3, 4) })
      )
      expect(error._tag).toStrictEqual("LinearAlgebraDecodeError")
    }))
})

describe("LinearAlgebra / matvecValidated", () => {
  it.effect("computes matrix-vector multiply with valid input", () =>
    Effect.gen(function*() {
      const result = yield* matvecValidated({
        rows: 2,
        cols: 2,
        data: Array.make(1, 0, 0, 1),
        x: Array.make(3, 7)
      })
      expect(Equal.equals(result, Chunk.make(3, 7))).toBe(true)
    }))

  it.effect("rejects data length mismatch with ShapeMismatchError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        matvecValidated({ rows: 2, cols: 2, data: Array.make(1, 0, 0), x: Array.make(3, 7) })
      )
      expect(error._tag).toStrictEqual("ShapeMismatchError")
      expect(error.operation).toStrictEqual("matvec")
    }))

  it.effect("rejects vector length mismatch with ShapeMismatchError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        matvecValidated({ rows: 2, cols: 2, data: Array.make(1, 0, 0, 1), x: Array.of(3) })
      )
      expect(error._tag).toStrictEqual("ShapeMismatchError")
      expect(error.operation).toStrictEqual("matvec")
    }))
})

describe("LinearAlgebra / normValidated", () => {
  it.effect("computes L2 norm via schema-validated input", () =>
    Effect.gen(function*() {
      const result = yield* normValidated({ values: Array.make(3, 4), kind: "L2" })
      expect(result).toStrictEqual(5)
    }))

  it.effect("computes L1 norm via schema-validated input", () =>
    Effect.gen(function*() {
      const result = yield* normValidated({ values: Array.make(Number.negate(1), 2, Number.negate(3)), kind: "L1" })
      expect(result).toStrictEqual(6)
    }))

  it.effect("computes Linf norm via schema-validated input", () =>
    Effect.gen(function*() {
      const result = yield* normValidated({ values: Array.make(Number.negate(1), 5, Number.negate(3)), kind: "Linf" })
      expect(result).toStrictEqual(5)
    }))

  it.effect("rejects invalid norm kind with LinearAlgebraDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        normValidated({ values: Array.make(1, 2), kind: "L3" })
      )
      expect(error._tag).toStrictEqual("LinearAlgebraDecodeError")
    }))
})

describe("LinearAlgebra / transposeValidated", () => {
  it.effect("transposes with schema-validated input", () =>
    Effect.gen(function*() {
      const result = yield* transposeValidated({ rows: 2, cols: 3, data: Array.make(1, 2, 3, 4, 5, 6) })
      expect(Equal.equals(result, Chunk.make(1, 4, 2, 5, 3, 6))).toBe(true)
    }))

  it.effect("rejects data length mismatch with ShapeMismatchError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        transposeValidated({ rows: 2, cols: 3, data: Array.make(1, 2, 3) })
      )
      expect(error._tag).toStrictEqual("ShapeMismatchError")
      expect(error.operation).toStrictEqual("transpose")
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("LinearAlgebra / dotWithPolicies", () => {
  it.effect("computes its documented finite dot under compensated backend preference", () =>
    Effect.gen(function*() {
      const result = yield* dotWithPolicies(Chunk.make(1, 2, 3), Chunk.make(4, 5, 6))
      expect(Schema.is(Schema.Finite)(result)).toStrictEqual(true)
      expect(result).toStrictEqual(32)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("computes its documented finite dot under scalar backend preference", () =>
    Effect.gen(function*() {
      const result = yield* dotWithPolicies(Chunk.make(1, 2, 3), Chunk.make(4, 5, 6))
      expect(Schema.is(Schema.Finite)(result)).toStrictEqual(true)
      expect(result).toStrictEqual(32)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("strict precision rejects non-finite dot product", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        dotWithPolicies(Chunk.make(Infinity, 1), Chunk.make(1, 1))
      )
      expect(error._tag).toStrictEqual("LinearAlgebraDomainViolationError")
      expect(error.operation).toStrictEqual("dotWithPolicies")
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("relaxed precision allows non-finite dot product", () =>
    Effect.gen(function*() {
      expect(
        yield* dotWithPolicies(
          Chunk.make(Infinity, 1),
          Chunk.make(1, 1)
        )
      ).toStrictEqual(Infinity)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("deterministic replay produces identical results", () =>
    Effect.gen(function*() {
      const a = Chunk.make(0.1, 0.2, 0.3)
      const b = Chunk.make(0.4, 0.5, 0.6)
      const runA = yield* dotWithPolicies(a, b).pipe(Effect.provide(strictCompensatedLayer))
      const runB = yield* dotWithPolicies(a, b).pipe(Effect.provide(strictCompensatedLayer))
      expect(Number.Equivalence(runA, runB)).toStrictEqual(true)
    }))
})

describe("LinearAlgebra / normWithPolicies", () => {
  it.effect("computes L2 norm under strict precision", () =>
    Effect.gen(function*() {
      const result = yield* normWithPolicies(Chunk.make(3, 4), "L2")
      expect(result).toStrictEqual(5)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("strict precision rejects non-finite norm", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(normWithPolicies(Chunk.make(Infinity, 1), "L2"))
      expect(error._tag).toStrictEqual("LinearAlgebraDomainViolationError")
      expect(error.operation).toStrictEqual("normWithPolicies")
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("relaxed precision allows non-finite norm", () =>
    Effect.gen(function*() {
      expect(yield* normWithPolicies(Chunk.make(Infinity, 1), "L2")).toStrictEqual(Infinity)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})
