import { describe, expect, it } from "@effect/vitest"
import { Array, Effect, Layer, Option, Schema } from "effect"

import * as Autodiff from "../../src/Autodiff.js"

const unavailable = (allowFiniteDifferenceFallback: boolean) =>
  Schema.decodeUnknownSync(Autodiff.Settings)({
    policy: {
      preferredOrder: Array.make("reverse", "forward"),
      allowFiniteDifferenceFallback
    },
    capabilities: Array.make(
      { mode: "reverse", available: false },
      { mode: "forward", available: false }
    )
  })

const dimensionLimited = Schema.decodeUnknownSync(Autodiff.Settings)({
  policy: {
    preferredOrder: Array.make("reverse", "forward"),
    allowFiniteDifferenceFallback: false
  },
  capabilities: Array.make(
    { mode: "reverse", available: true, maxInputDimension: 1 },
    { mode: "forward", available: false }
  )
})

describe("Autodiff.resolve", () => {
  it.effect("honors an available preferred mode", () =>
    Effect.gen(function*() {
      const resolution = yield* Autodiff.resolve({ operation: "gradient", preferredMode: "reverse" }).pipe(
        Effect.provide(Autodiff.layer)
      )

      expect(resolution.method).toStrictEqual("autodiff")
      expect(resolution.mode).toStrictEqual(Option.some("reverse"))
      expect(resolution.usedFiniteDifferenceFallback).toStrictEqual(false)
    }))

  it.effect("treats the maximum input dimension as metadata when the request has no dimension", () =>
    Effect.gen(function*() {
      const resolution = yield* Autodiff.resolve({ operation: "gradient" }).pipe(
        Effect.provide(Layer.succeed(Autodiff.Autodiff, dimensionLimited))
      )

      expect(resolution.method).toStrictEqual("autodiff")
      expect(resolution.mode).toStrictEqual(Option.some("reverse"))
    }))

  it.effect("falls back to finite differences when configured", () =>
    Effect.gen(function*() {
      const resolution = yield* Autodiff.resolve({ operation: "gradient" }).pipe(
        Effect.provide(Layer.succeed(Autodiff.Autodiff, unavailable(true)))
      )

      expect(resolution.method).toStrictEqual("finite-difference")
      expect(resolution.mode).toStrictEqual(Option.none())
      expect(resolution.usedFiniteDifferenceFallback).toStrictEqual(true)
    }))

  it.effect("fails when no mode is available and fallback is disabled", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        Autodiff.resolve({ operation: "gradient" }).pipe(
          Effect.provide(Layer.succeed(Autodiff.Autodiff, unavailable(false)))
        )
      )

      expect(error._tag).toStrictEqual("AutodiffUnavailableError")
    }))
})
