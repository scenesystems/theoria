import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Match, Number as N, Option, Schema } from "effect"

import { solveAdaptiveRk45, solveEuler, solveRk4 } from "../../src/Calculus/operations.js"
import { AdaptiveRk45Input, EulerInput, Rk4Input } from "../../src/Calculus/schema.js"
import { CalculusOdeParityFixtureSchema, FixtureRegistryLive, loadFixture } from "../helpers/fixtures/index.js"

const exponentialDecay = (_time: number, state: Chunk.Chunk<number>) => Chunk.fromIterable([-Chunk.unsafeGet(state, 0)])

const harmonicOscillator = (_time: number, state: Chunk.Chunk<number>) =>
  Chunk.fromIterable([Chunk.unsafeGet(state, 1), -Chunk.unsafeGet(state, 0)])

const expectClose = (actual: number, expected: number, absoluteTolerance: number, relativeTolerance: number) => {
  const tolerance = Math.abs(expected) > 1
    ? N.max(absoluteTolerance, N.multiply(Math.abs(expected), relativeTolerance))
    : absoluteTolerance

  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

const expectStateClose = (
  actual: ReadonlyArray<number>,
  expected: ReadonlyArray<number>,
  absoluteTolerance: number,
  relativeTolerance: number
) => {
  expect(actual.length).toBe(expected.length)
  actual.forEach((value, index) =>
    expectClose(value, expected[index] ?? Number.NaN, absoluteTolerance, relativeTolerance)
  )
}

describe("Calculus ODE fixture parity", () => {
  it.effect("matches committed SciPy ODE fixtures for decay and harmonic-oscillator trajectories", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("calculus.ode-parity")
      const fixture = yield* Schema.decodeUnknown(CalculusOdeParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(fixture.payload.cases, (testCase) =>
        Effect.gen(function*() {
          const field = yield* Match.value(testCase.input.function).pipe(
            Match.when("exponential_decay", () => Effect.succeed(exponentialDecay)),
            Match.when("harmonic_oscillator", () => Effect.succeed(harmonicOscillator)),
            Match.orElse(() => Effect.die(`Unknown ODE fixture function: ${testCase.input.function}`))
          )

          const result = yield* Match.value(testCase).pipe(
            Match.when({ operation: "solveEuler" }, ({ input }) =>
              Schema.decodeUnknown(EulerInput)(input).pipe(
                Effect.map((decoded) => solveEuler(field, decoded))
              )),
            Match.when({ operation: "solveRk4" }, ({ input }) =>
              Schema.decodeUnknown(Rk4Input)(input).pipe(
                Effect.map((decoded) => solveRk4(field, decoded))
              )),
            Match.when({ operation: "solveAdaptiveRk45" }, ({ input }) =>
              Schema.decodeUnknown(AdaptiveRk45Input)(input).pipe(
                Effect.map((decoded) =>
                  solveAdaptiveRk45(field, decoded)
                )
              )),
            Match.exhaustive
          )

          expect(result.status).toBe(testCase.expected.status)
          expectStateClose(
            Chunk.toReadonlyArray(result.finalState),
            testCase.expected.finalState,
            testCase.assertion.absoluteTolerance,
            testCase.assertion.relativeTolerance
          )
          expect(Chunk.size(result.trajectory)).toBe(testCase.expected.trajectory.length)

          Chunk.toReadonlyArray(result.trajectory).forEach((point, index) => {
            const expectedPoint = Option.getOrElse(
              Option.fromNullable(testCase.expected.trajectory[index]),
              () => ({
                time: Number.NaN,
                state: []
              })
            )

            expectClose(
              point.time,
              expectedPoint.time,
              testCase.assertion.absoluteTolerance,
              testCase.assertion.relativeTolerance
            )
            expectStateClose(
              Chunk.toReadonlyArray(point.state),
              expectedPoint.state,
              testCase.assertion.absoluteTolerance,
              testCase.assertion.relativeTolerance
            )
          })
        }), { discard: true })
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
