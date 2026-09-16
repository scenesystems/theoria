import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, Match, Number, Schema, Tuple } from "effect"

import { chebyshevDistance, euclideanDistance, manhattanDistance, midpoint } from "../../src/Geometry.js"
import { abs } from "../../src/Numeric.js"
import { GeometryDistanceParityFixtureSchema, loadFixture } from "../helpers/fixtures/index.js"

const distanceTolerance = 1e-12

const expectWithinTolerance = (actual: number, expected: number, tolerance: number) =>
  expect(Number.lessThanOrEqualTo(abs(Number.subtract(actual, expected)), tolerance)).toBe(true)

const expectChunkWithinTolerance = (
  actual: Chunk.Chunk<number>,
  expected: Chunk.Chunk<number>,
  tolerance: number
) => {
  expect(Number.Equivalence(Chunk.size(actual), Chunk.size(expected))).toBe(true)
  Chunk.forEach(
    Chunk.zip(actual, expected),
    (pair) => expectWithinTolerance(Tuple.getFirst(pair), Tuple.getSecond(pair), tolerance)
  )
}

describe("Geometry SciPy fixture parity", () => {
  it.effect("all distance-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("geometry.distance-parity")
      const fixture = yield* Schema.decodeUnknown(GeometryDistanceParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Array.fromIterable(fixture.payload.cases), (c) =>
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
              expectWithinTolerance(result, v.expected, distanceTolerance)
            }),
            Match.when({ operation: "midpoint" }, (v) => {
              const result = midpoint(Chunk.fromIterable(v.input.a), Chunk.fromIterable(v.input.b))
              expectChunkWithinTolerance(result, Chunk.fromIterable(v.expected), distanceTolerance)
            }),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(BunContext.layer)))
})
