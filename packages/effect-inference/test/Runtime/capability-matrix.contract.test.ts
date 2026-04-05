import { describe, expect, it } from "@effect/vitest"

import { defaultRuntimeCapabilities } from "../../src/internal/defaultCapabilities.js"

describe("Runtime/capability-matrix", () => {
  it("derives hosted OpenAI Responses capabilities from the route family", () => {
    const capabilities = defaultRuntimeCapabilities({
      route: {
        family: "OpenAiResponses",
        serveMode: "hosted-api",
        authMethod: "api-key",
        baseUrl: "https://api.openai.com/v1"
      }
    })

    expect(capabilities.structuredOutput).toBe("strict")
    expect(capabilities.toolCalling).toBe(true)
    expect(capabilities.usageReporting).toBe(true)
  })

  it("derives local compatible capabilities from runtime flavor", () => {
    const capabilities = defaultRuntimeCapabilities({
      route: {
        family: "OpenAiCompatible",
        serveMode: "local-runtime",
        authMethod: "none",
        baseUrl: "http://localhost:11434/v1",
        runtimeFlavorHint: "ollama"
      }
    })

    expect(capabilities.streaming).toBe(true)
    expect(capabilities.toolCalling).toBe(true)
    expect(capabilities.usageReporting).toBe(true)
  })

  it("lets explicit overrides win over matrix defaults", () => {
    const capabilities = defaultRuntimeCapabilities({
      route: {
        family: "HuggingFace",
        serveMode: "routed-marketplace",
        authMethod: "hf-token",
        baseUrl: "https://router.huggingface.co/v1"
      },
      overrides: {
        embeddings: false,
        maxContextTokens: 8192
      }
    })

    expect(capabilities.embeddings).toBe(false)
    expect(capabilities.maxContextTokens).toBe(8192)
  })
})
