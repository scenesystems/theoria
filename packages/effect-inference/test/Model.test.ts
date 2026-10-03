import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Schema } from "effect"

import * as Model from "@scenesystems/effect-inference/Model"

describe("Model", () => {
  it.effect("validates caller identity without admitting route claims", () =>
    Effect.sync(() => {
      const model = Schema.decodeExit(Model.Model)({
        modelRef: "meta-llama/Llama-3.3-70B-Instruct",
        revision: "main"
      })
      const routeClaim = Schema.decodeUnknownExit(Model.Model)({
        modelRef: "model",
        provider: "together"
      }, { onExcessProperty: "error" })

      expect(Exit.isSuccess(model)).toBe(true)
      expect(Exit.isFailure(routeClaim)).toBe(true)
    }))
})
