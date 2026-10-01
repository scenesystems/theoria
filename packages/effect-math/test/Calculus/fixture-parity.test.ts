import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array, Boolean, Chunk, Data, Effect, Match, Number, Option, Record, Schema } from "effect"

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
} from "../../src/Calculus.js"
import * as Numeric from "../../src/Numeric.js"
import { CalculusNumericalParityFixtureSchema, loadFixture } from "../helpers/fixtures/index.js"

class UnknownFixtureFunction extends Data.TaggedError("UnknownFixtureFunction")<{ readonly name: string }> {}

const lookup = <F>(
  registry: Record.ReadonlyRecord<string, F>,
  name: string
): Effect.Effect<F, UnknownFixtureFunction> =>
  Option.match(Record.get(registry, name), {
    onNone: () => Effect.fail(new UnknownFixtureFunction({ name })),
    onSome: Effect.succeed
  })

const testFunctions: Record.ReadonlyRecord<string, (x: number) => number> = {
  x_squared: (x) => Number.multiply(x, x),
  x_cubed: (x) => Number.multiply(Number.multiply(x, x), x),
  sin: Numeric.sin,
  exp: Numeric.exp,
  ln: Numeric.log,
  cubic_plus_linear: (x) => Number.sum(Number.multiply(Number.multiply(x, x), x), Number.multiply(2, x))
}

const scalarSurfaceFunctions: Record.ReadonlyRecord<string, (point: Chunk.Chunk<number>) => number> = {
  quadratic_surface: (point) => {
    const x = Chunk.unsafeGet(point, 0)
    const y = Chunk.unsafeGet(point, 1)
    return Number.sum(
      Number.sum(Number.multiply(x, x), Number.multiply(3, Number.multiply(x, y))),
      Number.multiply(y, y)
    )
  }
}

const vectorFieldFunctions: Record.ReadonlyRecord<string, (point: Chunk.Chunk<number>) => Chunk.Chunk<number>> = {
  coupled_field: (point) => {
    const x = Chunk.unsafeGet(point, 0)
    const y = Chunk.unsafeGet(point, 1)
    return Chunk.make(
      Number.sum(Number.multiply(x, x), y),
      Number.sum(Number.multiply(x, y), Numeric.sin(x))
    )
  }
}

const expectParity = (
  actual: number,
  expected: number,
  absoluteTolerance: number,
  relativeTolerance: number
) => {
  const absExpected = Numeric.abs(expected)
  const tolerance = Boolean.match(Number.greaterThan(absExpected, 1), {
    onTrue: () => Number.multiply(absExpected, relativeTolerance),
    onFalse: () => absoluteTolerance
  })
  expect(Numeric.abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

const expectVectorParity = (
  actual: Chunk.Chunk<number>,
  expected: Chunk.Chunk<number>,
  absoluteTolerance: number,
  relativeTolerance: number
) => {
  expect(Chunk.size(actual)).toStrictEqual(Chunk.size(expected))
  Chunk.forEach(actual, (value, index) =>
    expectParity(
      value,
      Option.getOrElse(Chunk.get(expected, index), () => Number.unsafeDivide(0, 0)),
      absoluteTolerance,
      relativeTolerance
    ))
}

const expectMatrixParity = (
  actual: Chunk.Chunk<Chunk.Chunk<number>>,
  expected: Chunk.Chunk<Chunk.Chunk<number>>,
  absoluteTolerance: number,
  relativeTolerance: number
) => {
  expect(Chunk.size(actual)).toStrictEqual(Chunk.size(expected))
  Chunk.forEach(actual, (row, rowIndex) =>
    expectVectorParity(
      row,
      Option.getOrElse(Chunk.get(expected, rowIndex), Chunk.empty),
      absoluteTolerance,
      relativeTolerance
    ))
}

const chunkMatrix = (matrix: Iterable<Iterable<number>>): Chunk.Chunk<Chunk.Chunk<number>> =>
  Chunk.fromIterable(Array.map(Array.fromIterable(matrix), Chunk.fromIterable))

describe("Calculus SciPy fixture parity", () => {
  it.effect("all numerical-parity cases match authoritative tolerances", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("calculus.numerical-parity")
      const fixture = yield* Schema.decodeUnknown(CalculusNumericalParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Array.fromIterable(fixture.payload.cases), (c) =>
        Match.value(c).pipe(
          Match.when({ operation: "derivative" }, (v) =>
            Effect.map(lookup(testFunctions, v.input.function), (fn) =>
              expectParity(
                derivative(fn, v.input.x),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              ))),
          Match.when({ operation: "secondDerivative" }, (v) =>
            Effect.map(lookup(testFunctions, v.input.function), (fn) =>
              expectParity(
                secondDerivative(fn, v.input.x),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              ))),
          Match.when({ operation: "directionalDerivative" }, (v) =>
            Effect.map(lookup(scalarSurfaceFunctions, v.input.function), (fn) =>
              expectParity(
                directionalDerivative(fn, Chunk.fromIterable(v.input.point), Chunk.fromIterable(v.input.direction)),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              ))),
          Match.when({ operation: "trapezoid" }, (v) =>
            Effect.sync(() =>
              expectParity(
                trapezoid(Chunk.fromIterable(v.input.values), v.input.dx),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              )
            )),
          Match.when({ operation: "simpson" }, (v) =>
            Effect.sync(() =>
              expectParity(
                simpson(Chunk.fromIterable(v.input.values), v.input.dx),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              )
            )),
          Match.when({ operation: "adaptiveSimpson" }, (v) =>
            Effect.map(lookup(testFunctions, v.input.function), (fn) =>
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
              ))),
          Match.when({ operation: "gradient" }, (v) =>
            Effect.map(lookup(scalarSurfaceFunctions, v.input.function), (fn) =>
              expectVectorParity(
                gradient(fn, Chunk.fromIterable(v.input.point)),
                Chunk.fromIterable(v.expected),
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              ))),
          Match.when({ operation: "jacobian" }, (v) =>
            Effect.map(lookup(vectorFieldFunctions, v.input.function), (fn) =>
              expectMatrixParity(
                jacobian(fn, Chunk.fromIterable(v.input.point)),
                chunkMatrix(v.expected),
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              ))),
          Match.when({ operation: "hessian" }, (v) =>
            Effect.map(lookup(scalarSurfaceFunctions, v.input.function), (fn) =>
              expectMatrixParity(
                hessian(fn, Chunk.fromIterable(v.input.point)),
                chunkMatrix(v.expected),
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              ))),
          Match.when({ operation: "divergence" }, (v) =>
            Effect.map(lookup(vectorFieldFunctions, v.input.function), (fn) =>
              expectParity(
                divergence(fn, Chunk.fromIterable(v.input.point)),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              ))),
          Match.when({ operation: "laplacian" }, (v) =>
            Effect.map(lookup(scalarSurfaceFunctions, v.input.function), (fn) =>
              expectParity(
                laplacian(fn, Chunk.fromIterable(v.input.point)),
                v.expected,
                v.assertion.absoluteTolerance,
                v.assertion.relativeTolerance
              ))),
          Match.exhaustive
        ))
    }).pipe(Effect.provide(BunContext.layer)))
})
