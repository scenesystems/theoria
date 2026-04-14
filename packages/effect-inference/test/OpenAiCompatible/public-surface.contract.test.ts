import { describe, expect, it } from "@effect/vitest"
import type { Layer } from "effect"

import * as OpenAiCompatible from "../../src/OpenAiCompatible/index.js"

const assertLayer = <A, E, R>(_: Layer.Layer<A, E, R>): true => true

describe("OpenAiCompatible/public-surface", () => {
  it("creates a normalized openai-compatible route", () => {
    const route = OpenAiCompatible.OpenAiCompatibleRoute.make({
      baseUrl: "http://localhost:11434/v1",
      serveMode: "local-runtime",
      authMethod: "none",
      runtimeFlavorHint: "ollama"
    })

    expect(route.family).toBe("OpenAiCompatible")
    expect(route.baseUrl).toBe("http://localhost:11434/v1")
    expect(
      assertLayer(
        OpenAiCompatible.OpenAiCompatibleLive({
          model: "meta-llama/Llama-3.1-8B-Instruct",
          baseUrl: route.baseUrl
        })
      )
    ).toBe(true)
    expect(
      assertLayer(
        OpenAiCompatible.OpenAiCompatibleEmbeddingsLive({
          model: "text-embedding-3-small",
          baseUrl: route.baseUrl
        })
      )
    ).toBe(true)
  })
})
