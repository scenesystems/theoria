import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Match, Number as N, Schema } from "effect"

import {
  adaptiveSimpson,
  derivative,
  directionalDerivative,
  divergence,
  gradient,
  hessian,
  jacobian,
  laplacian,
  secondDerivative,
  simpson,
  trapezoid
} from "../../src/Calculus/operations.js"
import { CalculusNumericalParityFixtureSchema, FixtureRegistryLive, loadFixture } from "../helpers/fixtures/index.js"

const testFunctions: Record<string, (x: number) => number> = {
  x_squared: (x) => N.multiply(x, x),
  x_cubed: (x) => N.multiply(N.multiply(x, x), x),
  sin: Math.sin,
  exp: Math.exp,
  ln: Math.log,
  cubic_plus_linear: (x) => N.sum(N.multiply(N.multiply(x, x), x), N.multiply(2, x))
}

const scalarSurfaceFunctions: Record<string, (point: Chunk.Chunk<number>) => number> = {
  quadratic_surface: (point) => {
    const x = Chunk.unsafeGet(point, 0)
    const y = Chunk.unsafeGet(point, 1)
    return N.sum(N.sum(N.multiply(x, x), N.multiply(3, N.multiply(x, y))), N.multiply(y, y))
  }
}

const vectorFieldFunctions: Record<string, (point: Chunk.Chunk<number>) => Chunk.Chunk<number>> = {
  coupled_field: (point) => {
    const x = Chunk.unsafeGet(point, 0)
    const y = Chunk.unsafeGet(point, 1)
    return Chunk.fromIterable([
      N.sum(N.multiply(x, x), y),
      N.sum(N.multiply(x, y), Math.sin(x))
    ])
  }
}

const expectParity = (
  actual: number,
  expected: number,
  absoluteTolerance: number,
  relativeTolerance: number
) => {
  const absExpected = Math.abs(expected)
  const tolerance = absExpected > 1 ? N.multiply(absExpected, relativeTolerance) : absoluteTolerance
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

const expectVectorParity = (
  actual: ReadonlyArray<number>,
  expected: ReadonlyArray<number>,
  absoluteTolerance: number,
  relativeTolerance: number
) => {
  expect(actual.length).toStrictEqual(expected.length)
  actual.forEach((value, index) =>
    expectParity(value, expected[index] ?? Number.NaN, absoluteTolerance, relativeTolerance)
  )
}

const expectMatrixParity = (
  actual: ReadonlyArray<ReadonlyArray<number>>,
  expected: ReadonlyArray<ReadonlyArray<number>>,
  absoluteTolerance: number,
  relativeTolerance: number
) => {
  expect(actual.length).toStrictEqual(expected.length)
  actual.forEach((row, rowIndex) =>
    expectVectorParity(row, expected[rowIndex] ?? [], absoluteTolerance, relativeTolerance)
  )
}

const chunkMatrixToReadonly = (matrix: Chunk.Chunk<Chunk.Chunk<number>>) =>
  Chunk.toReadonlyArray(Chunk.map(matrix, (row) => Chunk.toReadonlyArray(row)))

describe("Calculus SciPy fixture parity", () => {
  it.effect("all numerical-parity cases match authoritative tolerances", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("calculus.numerical-parity")
      const fixture = yield* Schema.decodeUnknown(CalculusNumericalParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Arr.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "derivative" }, (v) => {
              const fn = testFunctions[v.input.function]!
              expectParity(
                derivative(fn, v.input.x),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              )
            }),
            Match.when({ operation: "secondDerivative" }, (v) => {
              const fn = testFunctions[v.input.function]!
              expectParity(
                secondDerivative(fn, v.input.x),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              )
            }),
            Match.when({ operation: "directionalDerivative" }, (v) => {
              const fn = scalarSurfaceFunctions[v.input.function]!
              expectParity(
                directionalDerivative(fn, Chunk.fromIterable(v.input.point), Chunk.fromIterable(v.input.direction)),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              )
            }),
            Match.when({ operation: "trapezoid" }, (v) =>
              expectParity(
                trapezoid(Chunk.fromIterable(v.input.values), v.input.dx),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              )),
            Match.when({ operation: "simpson" }, (v) =>
              expectParity(
                simpson(Chunk.fromIterable(v.input.values), v.input.dx),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              )),
            Match.when({ operation: "adaptiveSimpson" }, (v) => {
              const fn = testFunctions[v.input.function]!
              expectParity(
                adaptiveSimpson(
                  fn,
                  v.input.a,
                  v.input.b,
                  v.input.absoluteTolerance,
                  v.input.relativeTolerance,
                  v.input.maxDepth
                ),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              )
            }),
            Match.when({ operation: "gradient" }, (v) => {
              const fn = scalarSurfaceFunctions[v.input.function]!
              expectVectorParity(
                Chunk.toReadonlyArray(gradient(fn, Chunk.fromIterable(v.input.point))),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              )
            }),
            Match.when({ operation: "jacobian" }, (v) => {
              const fn = vectorFieldFunctions[v.input.function]!
              expectMatrixParity(
                chunkMatrixToReadonly(jacobian(fn, Chunk.fromIterable(v.input.point))),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              )
            }),
            Match.when({ operation: "hessian" }, (v) => {
              const fn = scalarSurfaceFunctions[v.input.function]!
              expectMatrixParity(
                chunkMatrixToReadonly(hessian(fn, Chunk.fromIterable(v.input.point))),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              )
            }),
            Match.when({ operation: "divergence" }, (v) => {
              const fn = vectorFieldFunctions[v.input.function]!
              expectParity(
                divergence(fn, Chunk.fromIterable(v.input.point)),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              )
            }),
            Match.when({ operation: "laplacian" }, (v) => {
              const fn = scalarSurfaceFunctions[v.input.function]!
              expectParity(
                laplacian(fn, Chunk.fromIterable(v.input.point)),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              )
            }),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
