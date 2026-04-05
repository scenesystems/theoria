import { describe, expect, it } from "@effect/vitest"

import * as HuggingFace from "../../src/HuggingFace/index.js"
import * as OpenAiCompatible from "../../src/OpenAiCompatible/index.js"

describe("OpenAiCompatible/transport", () => {
  it("projects openai-compatible routes onto the shared transport seam", () => {
    const route = OpenAiCompatible.makeOpenAiCompatibleRoute({
      baseUrl: "http://localhost:11434/v1",
      serveMode: "local-runtime",
      authMethod: "none",
      runtimeFlavorHint: "ollama"
    })
    const plan = OpenAiCompatible.planCompatibleTransport(route)

    expect(plan.route.family).toBe("OpenAiCompatible")
    expect(plan.transport.baseUrl).toBe("http://localhost:11434/v1")
    expect(plan.transport.authMethod).toBe("none")
  })

  it("keeps Hugging Face route identity distinct above the compatible transport seam", () => {
    const route = HuggingFace.makeHuggingFaceEndpointRoute({
      baseUrl: "https://example.endpoints.huggingface.cloud/v1",
      authMethod: "api-key",
      endpointId: "hf-endpoint-demo",
      deploymentId: "aws-us-east-1-demo",
      runtimeFlavorHint: "tgi"
    })
    const plan = OpenAiCompatible.planCompatibleTransport(route)

    expect(plan.route.family).toBe("HuggingFace")
    expect(plan.route.serveMode).toBe("dedicated-endpoint")
    expect(plan.route.endpointId).toBe("hf-endpoint-demo")
    expect(plan.route.deploymentId).toBe("aws-us-east-1-demo")
    expect(plan.transport.baseUrl).toBe("https://example.endpoints.huggingface.cloud/v1")
  })
})
