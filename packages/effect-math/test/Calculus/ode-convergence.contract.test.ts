import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number as N, Schema } from "effect"

import { solveAdaptiveRk45 } from "../../src/Calculus/operations.js"
import { AdaptiveRk45Input } from "../../src/Calculus/schema.js"

const exponentialDecay = (_time: number, state: Chunk.Chunk<number>) => Chunk.fromIterable([-Chunk.unsafeGet(state, 0)])

const harmonicOscillator = (_time: number, state: Chunk.Chunk<number>) =>
  Chunk.fromIterable([Chunk.unsafeGet(state, 1), -Chunk.unsafeGet(state, 0)])

describe("Calculus adaptive ODE convergence", () => {
  it.effect("keeps adaptive RK45 inside declared tolerance and step budgets on scalar and vector IVPs", () =>
    Effect.gen(function*() {
      const scalarInput = yield* Schema.decodeUnknown(AdaptiveRk45Input)({
        initialTime: 0,
        finalTime: 1,
        initialState: [1],
        initialStep: 0.1,
        maxStep: 0.2,
        absoluteTolerance: 1e-8,
        relativeTolerance: 1e-8,
        maxSteps: 64
      })
      const vectorInput = yield* Schema.decodeUnknown(AdaptiveRk45Input)({
        initialTime: 0,
        finalTime: 1,
        initialState: [1, 0],
        initialStep: 0.05,
        maxStep: 0.1,
        absoluteTolerance: 1e-8,
        relativeTolerance: 1e-8,
        maxSteps: 96
      })

      const scalar = solveAdaptiveRk45(exponentialDecay, scalarInput)
      const vector = solveAdaptiveRk45(harmonicOscillator, vectorInput)

      expect(scalar.status).toBe("finished")
      expect(vector.status).toBe("finished")

      expect(Math.abs(N.subtract(Chunk.unsafeGet(scalar.finalState, 0), Math.exp(-1)))).toBeLessThanOrEqual(1e-6)
      expect(Math.abs(N.subtract(Chunk.unsafeGet(vector.finalState, 0), Math.cos(1)))).toBeLessThanOrEqual(1e-6)
      expect(Math.abs(N.subtract(Chunk.unsafeGet(vector.finalState, 1), -Math.sin(1)))).toBeLessThanOrEqual(1e-6)

      expect(scalar.acceptedSteps).toBeLessThanOrEqual(64)
      expect(vector.acceptedSteps).toBeLessThanOrEqual(96)
      expect(scalar.rejectedSteps).toBeLessThanOrEqual(8)
      expect(vector.rejectedSteps).toBeLessThanOrEqual(12)
    }))
})
