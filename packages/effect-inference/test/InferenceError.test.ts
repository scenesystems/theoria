import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import * as InferenceError from "@scenesystems/effect-inference/InferenceError"

describe("InferenceError", () => {
  it.effect.each([
    new InferenceError.InvalidRuntimeConfig({ reason: "bad config" }),
    new InferenceError.CapabilityMismatch({ capability: "embeddings", reason: "unsupported" }),
    new InferenceError.UnsupportedRoute({ family: "Unknown", reason: "unsupported" })
  ])("round-trips %s through the canonical error schema", (error) =>
    Effect.gen(function*() {
      const encoded = yield* Schema.encodeEffect(InferenceError.InferenceError)(error)
      const decoded = yield* Schema.decodeEffect(InferenceError.InferenceError)(encoded)
      expect(decoded).toEqual(error)
    }))
})
