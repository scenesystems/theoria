import { describe, expect, it } from "@effect/vitest"

import * as Contracts from "../../src/contracts/index.js"
import * as HuggingFace from "../../src/HuggingFace/index.js"

describe("HuggingFace/hugging-face-routing", () => {
  it("keeps brokered-provider routing explicit above the shared Hugging Face family", () => {
    const resolution = HuggingFace.HuggingFaceRoutedResolution.fromDescriptor(
      {
        artifact: { modelRef: "meta-llama/Llama-3.3-70B-Instruct" },
        route: {
          family: "HuggingFace",
          serveMode: "routed-marketplace",
          authMethod: "hf-token",
          baseUrl: "https://router.huggingface.co/v1",
          gatewayId: "hf-router",
          selectionPolicy: Contracts.explicitProviderSelection("together")
        }
      },
      "https://router.huggingface.co/v1"
    )

    expect(resolution.resolvedRoute.route.family).toBe("HuggingFace")
    expect(resolution.resolvedRoute.route.serveMode).toBe("routed-marketplace")
    expect(resolution.resolvedRoute.route.gatewayId).toBe("hf-router")
    expect(resolution.resolvedRoute.selectedProvider).toBe("together")
  })

  it("keeps dedicated-endpoint identity explicit above the shared Hugging Face family", () => {
    const resolution = HuggingFace.HuggingFaceEndpointResolution.fromDescriptor(
      {
        artifact: { modelRef: "BAAI/bge-base-en-v1.5" },
        route: {
          family: "HuggingFace",
          serveMode: "dedicated-endpoint",
          authMethod: "api-key",
          baseUrl: "https://endpoint.example.com/v1",
          endpointId: "hf-endpoint-prod",
          deploymentId: "deployment-42",
          runtimeFlavorHint: "tgi"
        }
      },
      "https://endpoint.example.com/v1"
    )

    expect(resolution.resolvedRoute.route.family).toBe("HuggingFace")
    expect(resolution.resolvedRoute.route.serveMode).toBe("dedicated-endpoint")
    expect(resolution.resolvedRoute.route.endpointId).toBe("hf-endpoint-prod")
    expect(resolution.resolvedRoute.selectedDeployment).toBe("deployment-42")
    expect(resolution.resolvedRoute.runtimeFlavor).toBe("tgi")
  })
})
