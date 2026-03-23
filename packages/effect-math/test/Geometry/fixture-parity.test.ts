import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Match, Number as N, Schema } from "effect"

import { chebyshevDistance, euclideanDistance, manhattanDistance, midpoint } from "../../src/Geometry/operations.js"
import { FixtureRegistryLive, GeometryDistanceParityFixtureSchema, loadFixture } from "../helpers/fixtures/index.js"

const DISTANCE_TOLERANCE = 1e-12

const expectWithinTolerance = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

const expectChunkWithinTolerance = (
  actual: Chunk.Chunk<number>,
  expected: ReadonlyArray<number>,
  tolerance: number
) => Arr.forEach(Chunk.toReadonlyArray(actual), (v, i) => expectWithinTolerance(v, expected[i] ?? 0, tolerance))

describe("Geometry SciPy fixture parity", () => {
  it.effect("all distance-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("geometry.distance-parity")
      const fixture = yield* Schema.decodeUnknown(GeometryDistanceParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Arr.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "distance" }, (v) => {
              const a = Chunk.fromIterable(v.input.a)
              const b = Chunk.fromIterable(v.input.b)
              const result = Match.value(v.input.metric).pipe(
                Match.when("euclidean", () => euclideanDistance(a, b)),
                Match.when("manhattan", () => manhattanDistance(a, b)),
                Match.when("chebyshev", () => chebyshevDistance(a, b)),
                Match.exhaustive
              )
              expectWithinTolerance(result, v.expected, DISTANCE_TOLERANCE)
            }),
            Match.when({ operation: "midpoint" }, (v) => {
              const result = midpoint(Chunk.fromIterable(v.input.a), Chunk.fromIterable(v.input.b))
              expectChunkWithinTolerance(result, v.expected, DISTANCE_TOLERANCE)
            }),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
