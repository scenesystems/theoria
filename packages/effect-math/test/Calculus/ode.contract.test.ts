import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Schema } from "effect"

import { solveAdaptiveRk45, solveEuler, solveRk4 } from "../../src/Calculus/operations.js"
import { AdaptiveRk45Input, EulerInput, OdeSolveResultSchema, Rk4Input } from "../../src/Calculus/schema.js"

const exponentialDecay = (_time: number, state: Chunk.Chunk<number>) => Chunk.fromIterable([-Chunk.unsafeGet(state, 0)])

const harmonicOscillator = (_time: number, state: Chunk.Chunk<number>) =>
  Chunk.fromIterable([Chunk.unsafeGet(state, 1), -Chunk.unsafeGet(state, 0)])

const stationaryField = (_time: number, state: Chunk.Chunk<number>) =>
  Chunk.fromIterable(Chunk.toReadonlyArray(state).map(() => 0))

describe("Calculus ODE contract", () => {
  it.effect("keeps Euler, RK4, and adaptive RK45 on one canonical result schema", () =>
    Effect.gen(function*() {
      const eulerInput = yield* Schema.decodeUnknown(EulerInput)({
        initialTime: 0,
        finalTime: 1,
        initialState: [1],
        stepSize: 0.1
      })
      const rk4Input = yield* Schema.decodeUnknown(Rk4Input)({
        initialTime: 0,
        finalTime: 1,
        initialState: [1, 0],
        stepSize: 0.05
      })
      const rk45Input = yield* Schema.decodeUnknown(AdaptiveRk45Input)({
        initialTime: 0,
        finalTime: 1,
        initialState: [1],
        initialStep: 0.1,
        maxStep: 0.2,
        absoluteTolerance: 1e-8,
        relativeTolerance: 1e-8
      })

      const euler = solveEuler(exponentialDecay, eulerInput)
      const rk4 = solveRk4(harmonicOscillator, rk4Input)
      const rk45 = solveAdaptiveRk45(exponentialDecay, rk45Input)

      const encodedEuler = yield* Schema.encode(OdeSolveResultSchema)(euler)
      const encodedRk4 = yield* Schema.encode(OdeSolveResultSchema)(rk4)
      const encodedRk45 = yield* Schema.encode(OdeSolveResultSchema)(rk45)

      expect(encodedEuler.method).toBe("euler")
      expect(encodedEuler.status).toBe("finished")
      expect(encodedEuler.finalState).toHaveLength(1)
      expect(euler.acceptedSteps).toBeGreaterThan(0)
      expect(euler.rejectedSteps).toBe(0)
      expect(Chunk.size(euler.trajectory)).toBe(euler.acceptedSteps + 1)
      expect(euler.functionEvaluations).toBeGreaterThanOrEqual(euler.acceptedSteps)

      expect(encodedRk4.method).toBe("rk4")
      expect(encodedRk4.status).toBe("finished")
      expect(encodedRk4.finalState).toHaveLength(2)
      expect(rk4.acceptedSteps).toBeGreaterThan(0)
      expect(rk4.rejectedSteps).toBe(0)
      expect(Chunk.size(rk4.trajectory)).toBe(rk4.acceptedSteps + 1)
      expect(rk4.functionEvaluations).toBeGreaterThanOrEqual(rk4.acceptedSteps * 4)

      expect(encodedRk45.method).toBe("rk45")
      expect(encodedRk45.status).toBe("finished")
      expect(encodedRk45.finalState).toHaveLength(1)
      expect(rk45.acceptedSteps).toBeGreaterThan(0)
      expect(rk45.functionEvaluations).toBeGreaterThan(rk45.acceptedSteps)
      expect(encodedRk45.trajectory).toHaveLength(rk45.acceptedSteps + 1)
    }))

  it.effect("keeps fixed and adaptive solvers stack-safe across long step budgets", () =>
    Effect.gen(function*() {
      const fixedInput = yield* Schema.decodeUnknown(EulerInput)({
        initialTime: 0,
        finalTime: 1200,
        initialState: [1],
        stepSize: 0.1,
        maxSteps: 12_000
      })
      const adaptiveInput = yield* Schema.decodeUnknown(AdaptiveRk45Input)({
        initialTime: 0,
        finalTime: 1200,
        initialState: [1],
        initialStep: 0.1,
        maxStep: 0.1,
        absoluteTolerance: 1e-8,
        relativeTolerance: 1e-8,
        maxSteps: 12_000
      })

      const fixed = solveEuler(stationaryField, fixedInput)
      const adaptive = solveAdaptiveRk45(stationaryField, adaptiveInput)

      expect(fixed.status).toBe("finished")
      expect(adaptive.status).toBe("finished")
      expect(fixed.acceptedSteps).toBe(12_000)
      expect(adaptive.acceptedSteps).toBe(12_000)
    }))
})
