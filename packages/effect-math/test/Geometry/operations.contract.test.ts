import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number as N, Schema } from "effect"

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

describe("Geometry / euclideanDistance", () => {
  it.effect("computes distance between [0,0] and [3,4]", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([0, 0])
      const b = Chunk.fromIterable([3, 4])
      expect(euclideanDistance(a, b)).toStrictEqual(5)
    }))

  it.effect("returns zero for identical points", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([1, 2, 3])
      expect(euclideanDistance(a, a)).toStrictEqual(0)
    }))

  it.effect("returns zero for empty chunks", () =>
    Effect.gen(function*() {
      expect(euclideanDistance(Chunk.empty(), Chunk.empty())).toStrictEqual(0)
    }))
})

describe("Geometry / squaredEuclideanDistance", () => {
  it.effect("computes squared distance between [0,0] and [3,4]", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([0, 0])
      const b = Chunk.fromIterable([3, 4])
      expect(squaredEuclideanDistance(a, b)).toStrictEqual(25)
    }))

  it.effect("returns zero for identical points", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([1, 2, 3])
      expect(squaredEuclideanDistance(a, a)).toStrictEqual(0)
    }))
})

describe("Geometry / manhattanDistance", () => {
  it.effect("computes L1 distance between two points", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([0, 0])
      const b = Chunk.fromIterable([3, 4])
      expect(manhattanDistance(a, b)).toStrictEqual(7)
    }))

  it.effect("handles negative coordinates", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([-1, -2])
      const b = Chunk.fromIterable([1, 2])
      expect(manhattanDistance(a, b)).toStrictEqual(6)
    }))
})

describe("Geometry / chebyshevDistance", () => {
  it.effect("computes Linf distance between two points", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([0, 0])
      const b = Chunk.fromIterable([3, 4])
      expect(chebyshevDistance(a, b)).toStrictEqual(4)
    }))

  it.effect("returns zero for identical points", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([5, 10])
      expect(chebyshevDistance(a, a)).toStrictEqual(0)
    }))
})

describe("Geometry / midpoint", () => {
  it.effect("computes midpoint of two 2D points", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([0, 0])
      const b = Chunk.fromIterable([4, 6])
      expect(Chunk.toReadonlyArray(midpoint(a, b))).toStrictEqual([2, 3])
    }))

  it.effect("midpoint of identical points is that point", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([3, 7])
      expect(Chunk.toReadonlyArray(midpoint(a, a))).toStrictEqual([3, 7])
    }))
})

// ---------------------------------------------------------------------------
// Effect-wrapped operations
// ---------------------------------------------------------------------------

describe("Geometry / distanceValidated", () => {
  it.effect("decodes valid euclidean input and computes distance", () =>
    Effect.gen(function*() {
      const result = yield* distanceValidated({ a: [0, 0], b: [3, 4], metric: "euclidean" })
      expect(result).toStrictEqual(5)
    }))

  it.effect("decodes valid manhattan input and computes distance", () =>
    Effect.gen(function*() {
      const result = yield* distanceValidated({ a: [0, 0], b: [3, 4], metric: "manhattan" })
      expect(result).toStrictEqual(7)
    }))

  it.effect("decodes valid chebyshev input and computes distance", () =>
    Effect.gen(function*() {
      const result = yield* distanceValidated({ a: [0, 0], b: [3, 4], metric: "chebyshev" })
      expect(result).toStrictEqual(4)
    }))

  it.effect("rejects excess properties with GeometryDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        distanceValidated({ a: [0, 0], b: [3, 4], metric: "euclidean", extra: true })
      )
      expect(error._tag).toStrictEqual("GeometryDecodeError")
      expect(error.operation).toStrictEqual("distance")
    }))

  it.effect("rejects mismatched point dimensions with GeometryShapeMismatchError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        distanceValidated({ a: [1, 2, 3], b: [4, 5], metric: "euclidean" })
      )
      expect(error._tag).toStrictEqual("GeometryShapeMismatchError")
      expect(error.operation).toStrictEqual("distance")
    }))

  it.effect("rejects non-finite input with GeometryDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        distanceValidated({ a: [1, Infinity], b: [3, 4], metric: "euclidean" })
      )
      expect(error._tag).toStrictEqual("GeometryDecodeError")
    }))

  it.effect("rejects invalid metric with GeometryDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        distanceValidated({ a: [1, 2], b: [3, 4], metric: "minkowski" })
      )
      expect(error._tag).toStrictEqual("GeometryDecodeError")
    }))
})

describe("Geometry / midpointValidated", () => {
  it.effect("computes midpoint with valid input", () =>
    Effect.gen(function*() {
      const result = yield* midpointValidated({ a: [0, 0], b: [4, 6] })
      expect(result).toStrictEqual([2, 3])
    }))

  it.effect("rejects mismatched dimensions with GeometryShapeMismatchError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        midpointValidated({ a: [1, 2, 3], b: [4, 5] })
      )
      expect(error._tag).toStrictEqual("GeometryShapeMismatchError")
      expect(error.operation).toStrictEqual("midpoint")
    }))

  it.effect("rejects excess properties with GeometryDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        midpointValidated({ a: [1, 2], b: [3, 4], extra: true })
      )
      expect(error._tag).toStrictEqual("GeometryDecodeError")
      expect(error.operation).toStrictEqual("midpoint")
    }))
})

describe("Geometry / centroidValidated", () => {
  it.effect("computes centroid of three 2D points", () =>
    Effect.gen(function*() {
      const result = yield* centroidValidated({
        points: [[0, 0], [3, 0], [0, 3]]
      })
      expect(result).toStrictEqual([1, 1])
    }))

  it.effect("centroid of a single point is that point", () =>
    Effect.gen(function*() {
      const result = yield* centroidValidated({ points: [[5, 7]] })
      expect(result).toStrictEqual([5, 7])
    }))

  it.effect("rejects mixed-dimension points with GeometryShapeMismatchError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        centroidValidated({ points: [[1, 2], [3, 4, 5]] })
      )
      expect(error._tag).toStrictEqual("GeometryShapeMismatchError")
      expect(error.operation).toStrictEqual("centroid")
    }))

  it.effect("rejects empty points array with GeometryDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        centroidValidated({ points: [] })
      )
      expect(error._tag).toStrictEqual("GeometryDecodeError")
    }))

  it.effect("rejects excess properties with GeometryDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        centroidValidated({ points: [[1, 2]], extra: true })
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
        Chunk.fromIterable([0, 0]),
        Chunk.fromIterable([3, 4]),
        "euclidean"
      )
      expect(Number.isFinite(result)).toStrictEqual(true)
      expect(result).toStrictEqual(5)
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("computes manhattan distance under relaxed precision", () =>
    Effect.gen(function*() {
      const result = yield* distanceWithPolicies(
        Chunk.fromIterable([0, 0]),
        Chunk.fromIterable([3, 4]),
        "manhattan"
      )
      expect(result).toStrictEqual(7)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("strict precision rejects non-finite distance", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        distanceWithPolicies(
          Chunk.fromIterable([Infinity, 0]),
          Chunk.fromIterable([0, 0]),
          "euclidean"
        )
      )
      expect(error._tag).toStrictEqual("GeometryDomainViolationError")
      expect(error.operation).toStrictEqual("distanceWithPolicies")
    }).pipe(Effect.provide(strictTypedArrayLayer)))

  it.effect("relaxed precision allows non-finite distance", () =>
    Effect.gen(function*() {
      expect(
        yield* distanceWithPolicies(
          Chunk.fromIterable([Infinity, 0]),
          Chunk.fromIterable([0, 0]),
          "euclidean"
        )
      ).toStrictEqual(Infinity)
    }).pipe(Effect.provide(relaxedScalarLayer)))

  it.effect("deterministic replay produces identical results", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([0.1, 0.2, 0.3])
      const b = Chunk.fromIterable([0.4, 0.5, 0.6])
      const runA = yield* distanceWithPolicies(a, b, "euclidean").pipe(Effect.provide(strictTypedArrayLayer))
      const runB = yield* distanceWithPolicies(a, b, "euclidean").pipe(Effect.provide(strictTypedArrayLayer))
      expect(N.Equivalence(runA, runB)).toStrictEqual(true)
    }))
})
