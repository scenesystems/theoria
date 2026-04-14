import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect } from "effect"

import { solveAdaptiveRk45Validated, solveEulerValidated, solveRk4Validated } from "../../src/Calculus/operations.js"

const exponentialDecay = (_time: number, state: Chunk.Chunk<number>) => Chunk.fromIterable([-Chunk.unsafeGet(state, 0)])

describe("Calculus ODE boundary contracts", () => {
  it.effect("rejects invalid interval, step, tolerance, and state-shape inputs with typed calculus errors", () =>
    Effect.gen(function*() {
      const invalidInterval = yield* Effect.either(
        solveEulerValidated(exponentialDecay, {
          initialTime: 0,
          finalTime: 0,
          initialState: [1],
          stepSize: 0.1
        })
      )
      const invalidStep = yield* Effect.either(
        solveRk4Validated(exponentialDecay, {
          initialTime: 0,
          finalTime: 1,
          initialState: [1],
          stepSize: 0
        })
      )
      const invalidTolerance = yield* Effect.either(
        solveAdaptiveRk45Validated(exponentialDecay, {
          initialTime: 0,
          finalTime: 1,
          initialState: [1],
          initialStep: 0.1,
          maxStep: 0.2,
          absoluteTolerance: 1e-8,
          relativeTolerance: 0
        })
      )
      const invalidShape = yield* Effect.either(
        solveEulerValidated(
          () => Chunk.fromIterable([1, 2]),
          {
            initialTime: 0,
            finalTime: 1,
            initialState: [1],
            stepSize: 0.1
          }
        )
      )

      expect(invalidInterval._tag).toBe("Left")
      if (invalidInterval._tag === "Left") {
        expect(invalidInterval.left._tag).toBe("CalculusDecodeError")
      }

      expect(invalidStep._tag).toBe("Left")
      if (invalidStep._tag === "Left") {
        expect(invalidStep.left._tag).toBe("CalculusDecodeError")
      }

      expect(invalidTolerance._tag).toBe("Left")
      if (invalidTolerance._tag === "Left") {
        expect(invalidTolerance.left._tag).toBe("CalculusDecodeError")
      }

      expect(invalidShape._tag).toBe("Left")
      if (invalidShape._tag === "Left") {
        expect(invalidShape.left._tag).toBe("CalculusShapeError")
      }
    }))
})
