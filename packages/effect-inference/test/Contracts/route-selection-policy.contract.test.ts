import { describe, expect, it } from "@effect/vitest"
import { Either, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"

describe("Contracts/route-selection-policy", () => {
  it("accepts built-in broker selection policies", () => {
    const result = Schema.decodeUnknownEither(Contracts.RouteSelectionPolicySchema)("fastest", {
      onExcessProperty: "error"
    })

    expect(Either.isRight(result)).toBe(true)
  })

  it("accepts an explicit provider selection policy", () => {
    const result = Schema.decodeUnknownEither(Contracts.RouteSelectionPolicySchema)(
      Contracts.explicitProviderSelection("together"),
      { onExcessProperty: "error" }
    )

    expect(Either.isRight(result)).toBe(true)
  })

  it("rejects malformed explicit provider selection", () => {
    const result = Schema.decodeUnknownEither(Contracts.RouteSelectionPolicySchema)(
      { _tag: "provider" },
      { onExcessProperty: "error" }
    )

    expect(Either.isLeft(result)).toBe(true)
  })
})
