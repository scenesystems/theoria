import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Option, Schema } from "effect"

import * as Route from "@scenesystems/effect-inference/Route"

describe("Route", () => {
  it.effect("decodes stable route identity and rejects unsupported native vocabulary", () =>
    Effect.sync(() => {
      const stable = Schema.decodeExit(Route.Route)({
        family: "HuggingFace",
        serveMode: "dedicated-endpoint",
        authMethod: "hf-token",
        baseUrl: "https://endpoint.example.test",
        endpointId: "production"
      })
      const unsupported = Schema.decodeUnknownExit(Route.Route)({
        family: "TgiNative",
        serveMode: "local-runtime",
        authMethod: "none",
        baseUrl: "http://127.0.0.1:8080"
      })

      expect(Exit.isSuccess(stable)).toBe(true)
      expect(Exit.isFailure(unsupported)).toBe(true)
    }))

  it.effect("constructs and extracts explicit provider selection without raw narrowing", () =>
    Effect.sync(() => {
      expect(Route.selectedProvider(Option.some(Route.explicitProvider("together")))).toEqual(Option.some("together"))
      expect(Route.selectedProvider(Option.some("fastest"))).toEqual(Option.none())
    }))
})
