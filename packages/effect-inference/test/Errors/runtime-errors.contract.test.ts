import { describe, expect, it } from "@effect/vitest"
import { Either, Schema } from "effect"

import * as Errors from "../../src/Errors/index.js"

describe("Errors/runtime-errors", () => {
  it.each([
    new Errors.InvalidRuntimeConfig({ reason: "invalid runtime env" }),
    new Errors.CapabilityMismatch({
      capability: "embeddings",
      reason: "resolved runtime does not support embeddings"
    }),
    new Errors.UnsupportedRoute({
      family: "OpenAiCompatible",
      reason: "route metadata is incomplete"
    })
  ])("keeps %s typed and schema-serializable", (error) => {
    const encoded = Schema.encodeSync(Errors.InferenceErrorSchema)(error)
    const decoded = Schema.decodeUnknownEither(Errors.InferenceErrorSchema)(encoded)

    expect(Either.isRight(decoded)).toBe(true)
    expect(encoded._tag).toBe(error._tag)
  })
})
