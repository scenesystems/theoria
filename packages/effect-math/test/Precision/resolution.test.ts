import { describe, expect, it } from "@effect/vitest"
import { Effect, Number } from "effect"

import * as Precision from "../../src/Precision.js"

const atBoundary = {
  absoluteError: 1e-10,
  relativeError: 1e-8,
  iterations: 16
}
const divergent = {
  absoluteError: 1e-4,
  relativeError: 1e-3,
  iterations: 64
}

describe("Precision.resolve", () => {
  it.effect("treats every convergence boundary as inclusive", () =>
    Effect.gen(function*() {
      const resolution = yield* Precision.resolve({
        operation: "sum",
        currentKind: "float64",
        attempts: 0,
        convergence: atBoundary,
        scalarResolutionSource: "requested"
      }).pipe(Effect.provide(Precision.layer))

      expect(resolution.converged).toStrictEqual(true)
      expect(resolution.escalated).toStrictEqual(false)
      expect(resolution.source).toStrictEqual("none")
    }))

  it.effect("advances to the next scalar lane after failed convergence", () =>
    Effect.gen(function*() {
      const resolution = yield* Precision.resolve({
        operation: "sum",
        currentKind: "float64",
        attempts: 0,
        convergence: divergent,
        scalarResolutionSource: "requested"
      }).pipe(Effect.provide(Precision.layer))

      expect(resolution.scalarKind).toStrictEqual("bigdecimal")
      expect(resolution.source).toStrictEqual("escalation-order")
    }))

  it.effect("fails after the configured escalation budget", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        Precision.resolve({
          operation: "sum",
          currentKind: "float64",
          attempts: Number.increment(1),
          convergence: divergent,
          scalarResolutionSource: "requested"
        }).pipe(Effect.provide(Precision.layer))
      )

      expect(error._tag).toStrictEqual("PrecisionEscalationExhaustedError")
    }))
})
