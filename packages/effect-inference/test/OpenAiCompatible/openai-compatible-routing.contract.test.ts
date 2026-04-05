import { describe, expect, it } from "@effect/vitest"

import * as OpenAiCompatible from "../../src/OpenAiCompatible/index.js"

describe("OpenAiCompatible/openai-compatible-routing", () => {
  it.each([
    {
      name: "brokered",
      route: OpenAiCompatible.makeOpenAiCompatibleRoute({
        baseUrl: "https://openrouter.ai/api/v1",
        serveMode: "routed-marketplace",
        authMethod: "bearer-token",
        gatewayId: "openrouter"
      })
    },
    {
      name: "dedicated",
      route: OpenAiCompatible.makeOpenAiCompatibleRoute({
        baseUrl: "https://my-endpoint.example.com/v1",
        serveMode: "dedicated-endpoint",
        authMethod: "api-key",
        endpointId: "endpoint-prod",
        deploymentId: "deploy-123"
      })
    },
    {
      name: "self-hosted-ollama",
      route: OpenAiCompatible.makeOpenAiCompatibleRoute({
        baseUrl: "http://127.0.0.1:11434/v1",
        serveMode: "local-runtime",
        authMethod: "none",
        runtimeFlavorHint: "ollama"
      })
    },
    {
      name: "self-hosted-vllm",
      route: OpenAiCompatible.makeOpenAiCompatibleRoute({
        baseUrl: "http://127.0.0.1:8000/v1",
        serveMode: "local-runtime",
        authMethod: "none",
        runtimeFlavorHint: "vllm"
      })
    },
    {
      name: "self-hosted-tgi",
      route: OpenAiCompatible.makeOpenAiCompatibleRoute({
        baseUrl: "http://127.0.0.1:8080/v1",
        serveMode: "local-runtime",
        authMethod: "none",
        runtimeFlavorHint: "tgi"
      })
    },
    {
      name: "self-hosted-lm-studio",
      route: OpenAiCompatible.makeOpenAiCompatibleRoute({
        baseUrl: "http://127.0.0.1:1234/v1",
        serveMode: "local-runtime",
        authMethod: "none",
        runtimeFlavorHint: "lm-studio"
      })
    }
  ])("projects $name routes through one compatible transport seam", ({ route }) => {
    const plan = OpenAiCompatible.planCompatibleTransport(route)

    expect(plan.route).toEqual(route)
    expect(plan.route.family).toBe("OpenAiCompatible")
    expect(plan.transport.baseUrl).toBe(route.baseUrl)
    expect(plan.transport.authMethod).toBe(route.authMethod)
  })
})
