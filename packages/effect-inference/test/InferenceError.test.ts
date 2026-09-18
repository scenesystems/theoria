import { describe, expect, it } from "@effect/vitest"
import { Either, Schema } from "effect"

import * as InferenceError from "@scenesystems/effect-inference/InferenceError"

describe("InferenceError", () => {
  it.each([
    new InferenceError.InvalidRuntimeConfig({ reason: "bad config" }),
    new InferenceError.CapabilityMismatch({ capability: "embeddings", reason: "unsupported" }),
    new InferenceError.UnsupportedRoute({ family: "Unknown", reason: "unsupported" })
  ])("round-trips %s through the canonical error schema", (error) => {
    const encoded = Schema.encodeSync(InferenceError.InferenceError)(error)
    expect(Either.isRight(Schema.decodeUnknownEither(InferenceError.InferenceError)(encoded))).toBe(true)
    expect(encoded._tag).toBe(error._tag)
  })
})
