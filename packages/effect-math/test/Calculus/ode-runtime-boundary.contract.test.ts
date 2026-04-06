import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Layer, Schema } from "effect"

import {
  solveAdaptiveRk45WithPolicies,
  solveEulerWithPolicies,
  solveRk4WithPolicies
} from "../../src/Calculus/operations.js"
import { AdaptiveRk45Input, EulerInput, Rk4Input } from "../../src/Calculus/schema.js"
import { BackendPolicyService, DiagnosticsPolicyService, PrecisionPolicyService } from "../../src/contracts/index.js"

const exponentialDecay = (_time: number, state: Chunk.Chunk<number>) => Chunk.fromIterable([-Chunk.unsafeGet(state, 0)])

const harmonicOscillator = (_time: number, state: Chunk.Chunk<number>) =>
  Chunk.fromIterable([Chunk.unsafeGet(state, 1), -Chunk.unsafeGet(state, 0)])

const strictBackendLayer = (backend: "scalar" | "typed-array") =>
  Layer.mergeAll(
    Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
    Layer.succeed(BackendPolicyService, { policy: backend }),
    Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
  )

describe("Calculus ODE runtime boundary contracts", () => {
  it.effect("keeps policy-aware ODE entrypoints on shared dispatch while honoring backend policy", () =>
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

      const scalarEuler = yield* solveEulerWithPolicies(exponentialDecay, eulerInput).pipe(
        Effect.provide(strictBackendLayer("scalar"))
      )
      const typedEuler = yield* solveEulerWithPolicies(exponentialDecay, eulerInput).pipe(
        Effect.provide(strictBackendLayer("typed-array"))
      )
      const typedRk4 = yield* solveRk4WithPolicies(harmonicOscillator, rk4Input).pipe(
        Effect.provide(strictBackendLayer("typed-array"))
      )
      const typedRk45 = yield* solveAdaptiveRk45WithPolicies(exponentialDecay, rk45Input).pipe(
        Effect.provide(strictBackendLayer("typed-array"))
      )

      expect(Chunk.toReadonlyArray(typedEuler.finalState)).toStrictEqual(Chunk.toReadonlyArray(scalarEuler.finalState))
      expect(typedRk4.status).toBe("finished")
      expect(typedRk45.status).toBe("finished")
      expect(typedRk4.functionEvaluations).toBeGreaterThanOrEqual(typedRk4.acceptedSteps * 4)
      expect(typedRk45.functionEvaluations).toBeGreaterThan(typedRk45.acceptedSteps)
    }))

  it.effect("strict precision rejects non-finite ODE results", () =>
    Effect.gen(function*() {
      const input = yield* Schema.decodeUnknown(EulerInput)({
        initialTime: 0,
        finalTime: 1,
        initialState: [1],
        stepSize: 0.1
      })
      const error = yield* Effect.flip(
        solveEulerWithPolicies(() => Chunk.fromIterable([Number.POSITIVE_INFINITY]), input).pipe(
          Effect.provide(strictBackendLayer("scalar"))
        )
      )

      expect(error._tag).toBe("CalculusDomainViolationError")
      expect(error.operation).toBe("solveEulerWithPolicies")
    }))
})
