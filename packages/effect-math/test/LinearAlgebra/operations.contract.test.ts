import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number as N, Option, Schema } from "effect"

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
// Pure kernel operations
// ---------------------------------------------------------------------------

describe("LinearAlgebra / dot", () => {
  it.effect("computes dot product of two chunks", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([1, 2, 3])
      const b = Chunk.fromIterable([4, 5, 6])
      expect(dot(a, b)).toStrictEqual(32)
    }))

  it.effect("returns zero for orthogonal vectors", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([1, 0])
      const b = Chunk.fromIterable([0, 1])
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
      expect(normL2(Chunk.fromIterable([1, 0, 0]))).toStrictEqual(1)
    }))

  it.effect("computes Euclidean norm of [3, 4]", () =>
    Effect.gen(function*() {
      expect(normL2(Chunk.fromIterable([3, 4]))).toStrictEqual(5)
    }))
})

describe("LinearAlgebra / normL1", () => {
  it.effect("computes L1 norm", () =>
    Effect.gen(function*() {
      expect(normL1(Chunk.fromIterable([-1, 2, -3]))).toStrictEqual(6)
    }))
})

describe("LinearAlgebra / normLinf", () => {
  it.effect("computes infinity norm", () =>
    Effect.gen(function*() {
      expect(normLinf(Chunk.fromIterable([-1, 5, -3]))).toStrictEqual(5)
    }))
})

describe("LinearAlgebra / vectorAdd", () => {
  it.effect("adds two vectors elementwise", () =>
    Effect.gen(function*() {
      const result = vectorAdd(Chunk.fromIterable([1, 2, 3]), Chunk.fromIterable([4, 5, 6]))
      expect(Chunk.toReadonlyArray(result)).toStrictEqual([5, 7, 9])
    }))
})

describe("LinearAlgebra / vectorScale", () => {
  it.effect("scales vector by scalar", () =>
    Effect.gen(function*() {
      const result = vectorScale(2, Chunk.fromIterable([1, 2, 3]))
      expect(Chunk.toReadonlyArray(result)).toStrictEqual([2, 4, 6])
    }))
})

describe("LinearAlgebra / matvec", () => {
  it.effect("multiplies identity matrix by vector", () =>
    Effect.gen(function*() {
      const identity = Chunk.fromIterable([1, 0, 0, 1])
      const x = Chunk.fromIterable([3, 7])
      const result = matvec(identity, 2, 2, x)
      expect(Chunk.toReadonlyArray(result)).toStrictEqual([3, 7])
    }))

  it.effect("multiplies 2x3 matrix by 3-vector", () =>
    Effect.gen(function*() {
      const data = Chunk.fromIterable([1, 2, 3, 4, 5, 6])
      const x = Chunk.fromIterable([1, 1, 1])
      const result = matvec(data, 2, 3, x)
      expect(Chunk.toReadonlyArray(result)).toStrictEqual([6, 15])
    }))
})

describe("LinearAlgebra / transpose", () => {
  it.effect("transposes a 2x3 matrix", () =>
    Effect.gen(function*() {
      const data = Chunk.fromIterable([1, 2, 3, 4, 5, 6])
      const result = transpose(data, 2, 3)
      expect(Chunk.toReadonlyArray(result)).toStrictEqual([1, 4, 2, 5, 3, 6])
    }))

  it.effect("double transpose is identity", () =>
    Effect.gen(function*() {
      const data = Chunk.fromIterable([1, 2, 3, 4, 5, 6])
      const first = transpose(data, 2, 3)
      const second = transpose(first, 3, 2)
      expect(Chunk.toReadonlyArray(second)).toStrictEqual(Chunk.toReadonlyArray(data))
    }))
})

describe("LinearAlgebra / frobeniusNorm", () => {
  it.effect("computes Frobenius norm of identity matrix", () =>
    Effect.gen(function*() {
      const identity = Chunk.fromIterable([1, 0, 0, 1])
      expect(frobeniusNorm(identity, 2, 2)).toBeCloseTo(Math.sqrt(2))
    }))
})

describe("LinearAlgebra / cholesky", () => {
  it.effect("decomposes SPD matrix into lower-triangular factor", () =>
    Effect.gen(function*() {
      const decomposed = cholesky(Chunk.fromIterable([4, 2, 2, 3]), 2)
      expect(Option.isSome(decomposed)).toStrictEqual(true)

      if (Option.isSome(decomposed)) {
        const values = Chunk.toReadonlyArray(decomposed.value)
        expect(values[0]).toBeCloseTo(2)
        expect(values[1]).toBeCloseTo(0)
        expect(values[2]).toBeCloseTo(1)
        expect(values[3]).toBeCloseTo(Math.sqrt(2))
      }
    }))

  it.effect("returns none for non-SPD input", () =>
    Effect.gen(function*() {
      const decomposed = cholesky(Chunk.fromIterable([1, 2, 2, 1]), 2)
      expect(Option.isNone(decomposed)).toStrictEqual(true)
    }))

  it.effect("returns none for non-symmetric input", () =>
    Effect.gen(function*() {
      const decomposed = cholesky(Chunk.fromIterable([2, 1, 0, 2]), 2)
      expect(Option.isNone(decomposed)).toStrictEqual(true)
    }))
})

describe("LinearAlgebra / forwardSubstitutionLower", () => {
  it.effect("solves lower-triangular systems", () =>
    Effect.gen(function*() {
      const lower = Chunk.fromIterable([2, 0, 1, 2])
      const rhs = Chunk.fromIterable([4, 5])
      const solved = forwardSubstitutionLower(lower, 2, rhs)
      expect(Option.isSome(solved)).toStrictEqual(true)

      if (Option.isSome(solved)) {
        expect(Chunk.toReadonlyArray(solved.value)).toStrictEqual([2, 1.5])
      }
    }))
})

describe("LinearAlgebra / backwardSubstitutionUpper", () => {
  it.effect("solves upper-triangular systems", () =>
    Effect.gen(function*() {
      const upper = Chunk.fromIterable([2, 1, 0, 2])
      const rhs = Chunk.fromIterable([5, 4])
      const solved = backwardSubstitutionUpper(upper, 2, rhs)
      expect(Option.isSome(solved)).toStrictEqual(true)

      if (Option.isSome(solved)) {
        expect(Chunk.toReadonlyArray(solved.value)).toStrictEqual([1.5, 2])
      }
    }))
})

describe("LinearAlgebra / solveSpd", () => {
  it.effect("solves SPD systems with Cholesky path", () =>
    Effect.gen(function*() {
      const matrix = Chunk.fromIterable([4, 1, 1, 3])
      const rhs = Chunk.fromIterable([1, 2])
      const solved = solveSpd(matrix, 2, rhs)
      expect(Option.isSome(solved)).toStrictEqual(true)

      if (Option.isSome(solved)) {
        const values = Chunk.toReadonlyArray(solved.value)
        expect(values[0]).toBeCloseTo(1 / 11)
        expect(values[1]).toBeCloseTo(7 / 11)
      }
    }))

  it.effect("returns none for invalid matrix shape", () =>
    Effect.gen(function*() {
      const solved = solveSpd(Chunk.fromIterable([1, 0, 0]), 2, Chunk.fromIterable([1, 2]))
      expect(Option.isNone(solved)).toStrictEqual(true)
    }))

  it.effect("returns none for non-symmetric matrix", () =>
    Effect.gen(function*() {
      const solved = solveSpd(Chunk.fromIterable([2, 1, 0, 2]), 2, Chunk.fromIterable([1, 1]))
      expect(Option.isNone(solved)).toStrictEqual(true)
    }))
})

// ---------------------------------------------------------------------------
// Effect-wrapped operations
// ---------------------------------------------------------------------------

describe("LinearAlgebra / dotValidated", () => {
  it.effect("decodes valid input and computes dot product", () =>
    Effect.gen(function*() {
      const result = yield* dotValidated({ a: [1, 2, 3], b: [4, 5, 6] })
      expect(result).toStrictEqual(32)
    }))

  it.effect("rejects excess properties with LinearAlgebraDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        dotValidated({ a: [1, 2], b: [3, 4], extra: true })
      )
      expect(error._tag).toStrictEqual("LinearAlgebraDecodeError")
      expect(error.operation).toStrictEqual("dot")
    }))

  it.effect("rejects mismatched vector lengths with ShapeMismatchError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        dotValidated({ a: [1, 2, 3], b: [4, 5] })
      )
      expect(error._tag).toStrictEqual("ShapeMismatchError")
      expect(error.operation).toStrictEqual("dot")
    }))

  it.effect("rejects non-finite input with LinearAlgebraDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        dotValidated({ a: [1, Infinity], b: [3, 4] })
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
        data: [1, 0, 0, 1],
        x: [3, 7]
      })
      expect(result).toStrictEqual([3, 7])
    }))

  it.effect("rejects data length mismatch with ShapeMismatchError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        matvecValidated({ rows: 2, cols: 2, data: [1, 0, 0], x: [3, 7] })
      )
      expect(error._tag).toStrictEqual("ShapeMismatchError")
      expect(error.operation).toStrictEqual("matvec")
    }))

  it.effect("rejects vector length mismatch with ShapeMismatchError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        matvecValidated({ rows: 2, cols: 2, data: [1, 0, 0, 1], x: [3] })
      )
      expect(error._tag).toStrictEqual("ShapeMismatchError")
      expect(error.operation).toStrictEqual("matvec")
    }))
})

describe("LinearAlgebra / normValidated", () => {
  it.effect("computes L2 norm via schema-validated input", () =>
    Effect.gen(function*() {
      const result = yield* normValidated({ values: [3, 4], kind: "L2" })
      expect(result).toStrictEqual(5)
    }))

  it.effect("computes L1 norm via schema-validated input", () =>
    Effect.gen(function*() {
      const result = yield* normValidated({ values: [-1, 2, -3], kind: "L1" })
      expect(result).toStrictEqual(6)
    }))

  it.effect("computes Linf norm via schema-validated input", () =>
    Effect.gen(function*() {
      const result = yield* normValidated({ values: [-1, 5, -3], kind: "Linf" })
      expect(result).toStrictEqual(5)
    }))

  it.effect("rejects invalid norm kind with LinearAlgebraDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        normValidated({ values: [1, 2], kind: "L3" })
      )
      expect(error._tag).toStrictEqual("LinearAlgebraDecodeError")
    }))
})

describe("LinearAlgebra / transposeValidated", () => {
  it.effect("transposes with schema-validated input", () =>
    Effect.gen(function*() {
      const result = yield* transposeValidated({ rows: 2, cols: 3, data: [1, 2, 3, 4, 5, 6] })
      expect(result).toStrictEqual([1, 4, 2, 5, 3, 6])
    }))

  it.effect("rejects data length mismatch with ShapeMismatchError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        transposeValidated({ rows: 2, cols: 3, data: [1, 2, 3] })
      )
      expect(error._tag).toStrictEqual("ShapeMismatchError")
      expect(error.operation).toStrictEqual("transpose")
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("LinearAlgebra / dotWithPolicies", () => {
  it.effect("typed-array backend computes finite dot product", () =>
    Effect.gen(function*() {
      const result = yield* dotWithPolicies(Chunk.fromIterable([1, 2, 3]), Chunk.fromIterable([4, 5, 6]))
      expect(Number.isFinite(result)).toStrictEqual(true)
      expect(result).toStrictEqual(32)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("scalar backend computes finite dot product", () =>
    Effect.gen(function*() {
      const result = yield* dotWithPolicies(Chunk.fromIterable([1, 2, 3]), Chunk.fromIterable([4, 5, 6]))
      expect(Number.isFinite(result)).toStrictEqual(true)
      expect(result).toStrictEqual(32)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("strict precision rejects non-finite dot product", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        dotWithPolicies(Chunk.fromIterable([Infinity, 1]), Chunk.fromIterable([1, 1]))
      )
      expect(error._tag).toStrictEqual("LinearAlgebraDomainViolationError")
      expect(error.operation).toStrictEqual("dotWithPolicies")
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("relaxed precision allows non-finite dot product", () =>
    Effect.gen(function*() {
      expect(
        yield* dotWithPolicies(
          Chunk.fromIterable([Infinity, 1]),
          Chunk.fromIterable([1, 1])
        )
      ).toStrictEqual(Infinity)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("deterministic replay produces identical results", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([0.1, 0.2, 0.3])
      const b = Chunk.fromIterable([0.4, 0.5, 0.6])
      const runA = yield* dotWithPolicies(a, b).pipe(Effect.provide(strictTypedArrayLayer))
      const runB = yield* dotWithPolicies(a, b).pipe(Effect.provide(strictTypedArrayLayer))
      expect(N.Equivalence(runA, runB)).toStrictEqual(true)
    }))
})

describe("LinearAlgebra / normWithPolicies", () => {
  it.effect("computes L2 norm under strict precision", () =>
    Effect.gen(function*() {
      const result = yield* normWithPolicies(Chunk.fromIterable([3, 4]), "L2")
      expect(result).toStrictEqual(5)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("strict precision rejects non-finite norm", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(normWithPolicies(Chunk.fromIterable([Infinity, 1]), "L2"))
      expect(error._tag).toStrictEqual("LinearAlgebraDomainViolationError")
      expect(error.operation).toStrictEqual("normWithPolicies")
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("relaxed precision allows non-finite norm", () =>
    Effect.gen(function*() {
      expect(yield* normWithPolicies(Chunk.fromIterable([Infinity, 1]), "L2")).toStrictEqual(Infinity)
    }).pipe(Effect.provide(relaxedScalarLayer)))
})
