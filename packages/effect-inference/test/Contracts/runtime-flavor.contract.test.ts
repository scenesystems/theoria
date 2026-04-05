import { describe, expect, it } from "@effect/vitest"
import { Either, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"

describe("Contracts/runtime-flavor", () => {
  it("accepts known compatible runtime flavors", () => {
    const result = Schema.decodeUnknownEither(Contracts.RuntimeFlavorSchema)("vllm", {
      onExcessProperty: "error"
    })

    expect(Either.isRight(result)).toBe(true)
  })

  it("rejects unknown runtime flavors", () => {
    const result = Schema.decodeUnknownEither(Contracts.RuntimeFlavorSchema)("sglang", {
      onExcessProperty: "error"
    })

    expect(Either.isLeft(result)).toBe(true)
  })
})
