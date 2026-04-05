import { describe, expect, it } from "@effect/vitest"
import { Either, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"

describe("Contracts/route-identity", () => {
  it("accepts split route identity fields", () => {
    const result = Schema.decodeUnknownEither(Contracts.ExecutionRouteSchema)(
      {
        family: "HuggingFace",
        serveMode: "dedicated-endpoint",
        authMethod: "hf-token",
        baseUrl: "https://example.endpoints.huggingface.cloud/v1",
        endpointId: "hf-endpoint-demo",
        deploymentId: "aws-us-east-1-demo",
        gatewayId: "huggingface-router"
      },
      { onExcessProperty: "error" }
    )

    expect(Either.isRight(result)).toBe(true)
  })

  it("rejects the old collapsed endpoint field", () => {
    const result = Schema.decodeUnknownEither(Contracts.ExecutionRouteSchema)(
      {
        family: "OpenAiCompatible",
        serveMode: "self-hosted",
        authMethod: "none",
        endpoint: "http://localhost:11434/v1"
      },
      { onExcessProperty: "error" }
    )

    expect(Either.isLeft(result)).toBe(true)
  })
})
