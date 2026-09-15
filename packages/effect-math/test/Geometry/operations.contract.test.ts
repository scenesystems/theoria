import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, Equal, Number, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
  centroidValidated,
  chebyshevDistance,
  distanceValidated,
  distanceWithPolicies,
  euclideanDistance,
  manhattanDistance,
  midpoint,
  midpointValidated,
  squaredEuclideanDistance
} from "../../src/Geometry/operations.js"

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

describe("Geometry / euclideanDistance", () => {
  it.effect("computes distance between [0,0] and [3,4]", () =>
    Effect.gen(function*() {
      const a = Chunk.make(0, 0)
      const b = Chunk.make(3, 4)
      expect(euclideanDistance(a, b)).toStrictEqual(5)
    }))

  it.effect("returns zero for identical points", () =>
    Effect.gen(function*() {
      const a = Chunk.make(1, 2, 3)
      expect(euclideanDistance(a, a)).toStrictEqual(0)
    }))

  it.effect("returns zero for empty chunks", () =>
    Effect.gen(function*() {
      expect(euclideanDistance(Chunk.empty(), Chunk.empty())).toStrictEqual(0)
    }))

  it.effect("avoids overflow for large finite coordinates", () =>
    Effect.gen(function*() {
      const result = euclideanDistance(Chunk.make(1e308, 1e308), Chunk.make(0, 0))
      expect(Schema.is(Schema.Finite)(result)).toBe(true)
      expect(Number.greaterThan(result, 1e308)).toBe(true)
    }))
})

describe("Geometry / squaredEuclideanDistance", () => {
  it.effect("computes squared distance between [0,0] and [3,4]", () =>
    Effect.gen(function*() {
      const a = Chunk.make(0, 0)
      const b = Chunk.make(3, 4)
      expect(squaredEuclideanDistance(a, b)).toStrictEqual(25)
    }))

  it.effect("returns zero for identical points", () =>
    Effect.gen(function*() {
      const a = Chunk.make(1, 2, 3)
      expect(squaredEuclideanDistance(a, a)).toStrictEqual(0)
    }))
})

describe("Geometry / manhattanDistance", () => {
  it.effect("computes L1 distance between two points", () =>
    Effect.gen(function*() {
      const a = Chunk.make(0, 0)
      const b = Chunk.make(3, 4)
      expect(manhattanDistance(a, b)).toStrictEqual(7)
    }))

  it.effect("handles negative coordinates", () =>
    Effect.gen(function*() {
      const a = Chunk.make(Number.negate(1), Number.negate(2))
      const b = Chunk.make(1, 2)
      expect(manhattanDistance(a, b)).toStrictEqual(6)
    }))
})

describe("Geometry / chebyshevDistance", () => {
  it.effect("computes Linf distance between two points", () =>
    Effect.gen(function*() {
      const a = Chunk.make(0, 0)
      const b = Chunk.make(3, 4)
      expect(chebyshevDistance(a, b)).toStrictEqual(4)
    }))

  it.effect("returns zero for identical points", () =>
    Effect.gen(function*() {
      const a = Chunk.make(5, 10)
      expect(chebyshevDistance(a, a)).toStrictEqual(0)
    }))
})

describe("Geometry / midpoint", () => {
  it.effect("computes midpoint of two 2D points", () =>
    Effect.gen(function*() {
      const a = Chunk.make(0, 0)
      const b = Chunk.make(4, 6)
      expect(Equal.equals(midpoint(a, b), Chunk.make(2, 3))).toBe(true)
    }))

  it.effect("midpoint of identical points is that point", () =>
    Effect.gen(function*() {
      const a = Chunk.make(3, 7)
      expect(Equal.equals(midpoint(a, a), a)).toBe(true)
    }))
})

// ---------------------------------------------------------------------------
// Effect-wrapped operations
// ---------------------------------------------------------------------------

describe("Geometry / distanceValidated", () => {
  it.effect("decodes valid euclidean input and computes distance", () =>
    Effect.gen(function*() {
      const result = yield* distanceValidated({ a: Array.make(0, 0), b: Array.make(3, 4), metric: "euclidean" })
      expect(result).toStrictEqual(5)
    }))

  it.effect("decodes valid manhattan input and computes distance", () =>
    Effect.gen(function*() {
      const result = yield* distanceValidated({ a: Array.make(0, 0), b: Array.make(3, 4), metric: "manhattan" })
      expect(result).toStrictEqual(7)
    }))

  it.effect("decodes valid chebyshev input and computes distance", () =>
    Effect.gen(function*() {
      const result = yield* distanceValidated({ a: Array.make(0, 0), b: Array.make(3, 4), metric: "chebyshev" })
      expect(result).toStrictEqual(4)
    }))

  it.effect("rejects excess properties with GeometryDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        distanceValidated({ a: Array.make(0, 0), b: Array.make(3, 4), metric: "euclidean", extra: true })
      )
      expect(error._tag).toStrictEqual("GeometryDecodeError")
      expect(error.operation).toStrictEqual("distance")
    }))

  it.effect("rejects mismatched point dimensions with GeometryShapeMismatchError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        distanceValidated({ a: Array.make(1, 2, 3), b: Array.make(4, 5), metric: "euclidean" })
      )
      expect(error._tag).toStrictEqual("GeometryShapeMismatchError")
      expect(error.operation).toStrictEqual("distance")
    }))

  it.effect("rejects non-finite input with GeometryDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        distanceValidated({ a: Array.make(1, Infinity), b: Array.make(3, 4), metric: "euclidean" })
      )
      expect(error._tag).toStrictEqual("GeometryDecodeError")
    }))

  it.effect("rejects invalid metric with GeometryDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        distanceValidated({ a: Array.make(1, 2), b: Array.make(3, 4), metric: "minkowski" })
      )
      expect(error._tag).toStrictEqual("GeometryDecodeError")
    }))
})

describe("Geometry / midpointValidated", () => {
  it.effect("computes midpoint with valid input", () =>
    Effect.gen(function*() {
      const result = yield* midpointValidated({ a: Array.make(0, 0), b: Array.make(4, 6) })
      expect(Equal.equals(result, Chunk.make(2, 3))).toBe(true)
    }))

  it.effect("rejects mismatched dimensions with GeometryShapeMismatchError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        midpointValidated({ a: Array.make(1, 2, 3), b: Array.make(4, 5) })
      )
      expect(error._tag).toStrictEqual("GeometryShapeMismatchError")
      expect(error.operation).toStrictEqual("midpoint")
    }))

  it.effect("rejects excess properties with GeometryDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        midpointValidated({ a: Array.make(1, 2), b: Array.make(3, 4), extra: true })
      )
      expect(error._tag).toStrictEqual("GeometryDecodeError")
      expect(error.operation).toStrictEqual("midpoint")
    }))
})

describe("Geometry / centroidValidated", () => {
  it.effect("computes centroid of three 2D points", () =>
    Effect.gen(function*() {
      const result = yield* centroidValidated({
        points: Array.make(Array.make(0, 0), Array.make(3, 0), Array.make(0, 3))
      })
      expect(Equal.equals(result, Chunk.make(1, 1))).toBe(true)
    }))

  it.effect("centroid of a single point is that point", () =>
    Effect.gen(function*() {
      const result = yield* centroidValidated({ points: Array.of(Array.make(5, 7)) })
      expect(Equal.equals(result, Chunk.make(5, 7))).toBe(true)
    }))

  it.effect("rejects mixed-dimension points with GeometryShapeMismatchError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        centroidValidated({ points: Array.make(Array.make(1, 2), Array.make(3, 4, 5)) })
      )
      expect(error._tag).toStrictEqual("GeometryShapeMismatchError")
      expect(error.operation).toStrictEqual("centroid")
    }))

  it.effect("rejects empty points array with GeometryDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        centroidValidated({ points: Array.empty() })
      )
      expect(error._tag).toStrictEqual("GeometryDecodeError")
    }))

  it.effect("rejects excess properties with GeometryDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        centroidValidated({ points: Array.of(Array.make(1, 2)), extra: true })
      )
      expect(error._tag).toStrictEqual("GeometryDecodeError")
      expect(error.operation).toStrictEqual("centroid")
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Geometry / distanceWithPolicies", () => {
  it.effect("computes euclidean distance under strict precision", () =>
    Effect.gen(function*() {
      const result = yield* distanceWithPolicies(
        Chunk.make(0, 0),
        Chunk.make(3, 4),
        "euclidean"
      )
      expect(Schema.is(Schema.Finite)(result)).toStrictEqual(true)
      expect(result).toStrictEqual(5)
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("computes manhattan distance under relaxed precision", () =>
    Effect.gen(function*() {
      const result = yield* distanceWithPolicies(
        Chunk.make(0, 0),
        Chunk.make(3, 4),
        "manhattan"
      )
      expect(result).toStrictEqual(7)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("strict precision rejects non-finite distance", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        distanceWithPolicies(
          Chunk.make(Infinity, 0),
          Chunk.make(0, 0),
          "euclidean"
        )
      )
      expect(error._tag).toStrictEqual("GeometryDomainViolationError")
      expect(error.operation).toStrictEqual("distanceWithPolicies")
    }).pipe(Effect.provide(strictCompensatedLayer)))

  it.effect("relaxed precision allows non-finite distance", () =>
    Effect.gen(function*() {
      expect(
        yield* distanceWithPolicies(
          Chunk.make(Infinity, 0),
          Chunk.make(0, 0),
          "euclidean"
        )
      ).toStrictEqual(Infinity)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("deterministic replay produces identical results", () =>
    Effect.gen(function*() {
      const a = Chunk.make(0.1, 0.2, 0.3)
      const b = Chunk.make(0.4, 0.5, 0.6)
      const runA = yield* distanceWithPolicies(a, b, "euclidean").pipe(Effect.provide(strictCompensatedLayer))
      const runB = yield* distanceWithPolicies(a, b, "euclidean").pipe(Effect.provide(strictCompensatedLayer))
      expect(Number.Equivalence(runA, runB)).toStrictEqual(true)
    }))
})
