import { describe, expect, it } from "@effect/vitest"
import { Either, Schema } from "effect"
import * as Arr from "effect/Array"

import * as Contracts from "../../src/contracts/index.js"

describe("Contracts/route-taxonomy", () => {
  it("keeps the stable route taxonomy exact on the root execution-route contract", () => {
    const stableFamilies = Arr.every(
      ["OpenAiCompatible", "OpenAiResponses", "AnthropicMessages", "HuggingFace"],
      (family) =>
        Either.isRight(
          Schema.decodeUnknownEither(Contracts.StableRouteFamilySchema)(family, {
            onExcessProperty: "error"
          })
        )
    )

    const nativeFamiliesStayExperimental = Arr.every(
      ["TgiNative", "TeiNative", "OllamaNative"],
      (family) =>
        Either.isLeft(
          Schema.decodeUnknownEither(Contracts.ExecutionRouteSchema)(
            {
              family,
              serveMode: "self-hosted",
              authMethod: "none",
              baseUrl: "http://localhost:8080/v1"
            },
            { onExcessProperty: "error" }
          )
        )
    )

    const nativeFamiliesRemainAvailableForExperimentalLanes = Arr.every(
      ["TgiNative", "TeiNative", "OllamaNative"],
      (family) =>
        Either.isRight(
          Schema.decodeUnknownEither(Contracts.NativeRouteFamilySchema)(family, {
            onExcessProperty: "error"
          })
        )
    )

    expect(stableFamilies).toBe(true)
    expect(nativeFamiliesStayExperimental).toBe(true)
    expect(nativeFamiliesRemainAvailableForExperimentalLanes).toBe(true)
  })
})
