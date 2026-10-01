import { describe, expect, it } from "@effect/vitest"
import { Either, Option, Schema } from "effect"

import * as Route from "@scenesystems/effect-inference/Route"

describe("Route", () => {
  it("decodes stable route identity and rejects unsupported native vocabulary", () => {
    const stable = Schema.decodeUnknownEither(Route.Route)({
      family: "HuggingFace",
      serveMode: "dedicated-endpoint",
      authMethod: "hf-token",
      baseUrl: "https://endpoint.example.test",
      endpointId: "production"
    })
    const unsupported = Schema.decodeUnknownEither(Route.Route)({
      family: "TgiNative",
      serveMode: "local-runtime",
      authMethod: "none",
      baseUrl: "http://127.0.0.1:8080"
    })

    expect(Either.isRight(stable)).toBe(true)
    expect(Either.isLeft(unsupported)).toBe(true)
  })

  it("constructs and extracts explicit provider selection without raw narrowing", () => {
    expect(Route.selectedProvider(Option.some(Route.explicitProvider("together")))).toEqual(Option.some("together"))
    expect(Route.selectedProvider(Option.some("fastest"))).toEqual(Option.none())
  })
})
