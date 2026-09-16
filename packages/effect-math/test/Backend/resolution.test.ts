import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"

import * as Backend from "../../src/Backend.js"
import * as Policy from "../../src/Policy.js"

describe("Backend.resolve", () => {
  it.effect("keeps runtime policy authoritative over a preferred accelerated backend", () =>
    Effect.gen(function*() {
      const backend = yield* Backend.resolve({
        operation: "dot",
        scalarKind: "float64",
        preferredBackend: "accelerated"
      }).pipe(Effect.provide(Layer.succeed(Policy.Backend, { policy: "compensated" })))

      expect(backend).toStrictEqual("compensated")
    }))

  it.effect("falls back when compensated execution cannot serve BigDecimal", () =>
    Effect.gen(function*() {
      const backend = yield* Backend.resolve({ operation: "dot", scalarKind: "bigdecimal" }).pipe(
        Effect.provide(Layer.succeed(Policy.Backend, { policy: "compensated" }))
      )

      expect(backend).toStrictEqual("scalar")
    }))
})
