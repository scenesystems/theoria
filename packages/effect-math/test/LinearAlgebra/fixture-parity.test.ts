import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, Match, Number, Schema, Tuple } from "effect"

import { dot, frobeniusNorm, matvec, normL1, normL2, normLinf } from "../../src/LinearAlgebra.js"
import { abs } from "../../src/Numeric.js"
import { LinalgVectorParityFixtureSchema, loadFixture } from "../helpers/fixtures/index.js"

const dotNormTolerance = 1e-12
const matvecFrobeniusTolerance = 1e-10

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

describe("LinearAlgebra SciPy fixture parity", () => {
  it.effect("all vector-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("linalg.vector-parity")
      const fixture = yield* Schema.decodeUnknown(LinalgVectorParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Array.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "dot" }, (v) => {
              const result = dot(Chunk.fromIterable(v.input.a), Chunk.fromIterable(v.input.b))
              expectWithinTolerance(result, v.expected, dotNormTolerance)
            }),
            Match.when({ operation: "norm" }, (v) => {
              const vec = Chunk.fromIterable(v.input.values)
              const result = Match.value(v.input.kind).pipe(
                Match.when("L1", () => normL1(vec)),
                Match.when("L2", () => normL2(vec)),
                Match.when("Linf", () => normLinf(vec)),
                Match.exhaustive
              )
              expectWithinTolerance(result, v.expected, dotNormTolerance)
            }),
            Match.when({ operation: "matvec" }, (v) => {
              const result = matvec(
                Chunk.fromIterable(v.input.data),
                v.input.rows,
                v.input.cols,
                Chunk.fromIterable(v.input.x)
              )
              expectChunkWithinTolerance(result, Chunk.fromIterable(v.expected), matvecFrobeniusTolerance)
            }),
            Match.when({ operation: "frobenius" }, (v) => {
              const result = frobeniusNorm(
                Chunk.fromIterable(v.input.data),
                v.input.rows,
                v.input.cols
              )
              expectWithinTolerance(result, v.expected, matvecFrobeniusTolerance)
            }),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(BunContext.layer)))
})
