import { describe, expect, it } from "@effect/vitest"
import { Either, Schema } from "effect"

import * as Model from "@scenesystems/effect-inference/Model"

describe("Model", () => {
  it("validates caller identity without admitting route claims", () => {
    const model = Schema.decodeUnknownEither(Model.Model)({
      modelRef: "meta-llama/Llama-3.3-70B-Instruct",
      revision: "main"
    })
    const routeClaim = Schema.decodeUnknownEither(Model.Model)({
      modelRef: "model",
      provider: "together"
    }, { onExcessProperty: "error" })

    expect(Either.isRight(model)).toBe(true)
    expect(Either.isLeft(routeClaim)).toBe(true)
  })
})
