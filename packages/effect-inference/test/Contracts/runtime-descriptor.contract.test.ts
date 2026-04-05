import { describe, expect, it } from "@effect/vitest"
import { Either, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"

describe("Contracts/runtime-descriptor", () => {
  it("accepts a valid desired runtime descriptor", () => {
    const result = Schema.decodeUnknownEither(Contracts.DesiredRuntimeDescriptorSchema)(
      {
        artifact: { modelRef: "meta-llama/Llama-3.3-70B-Instruct" },
        route: {
          family: "OpenAiCompatible",
          serveMode: "self-hosted",
          authMethod: "api-key",
          baseUrl: "http://localhost:11434/v1",
          runtimeFlavorHint: "ollama"
        },
        capabilities: {
          textGeneration: true,
          streaming: true
        },
        role: "task"
      },
      { onExcessProperty: "error" }
    )

    expect(Either.isRight(result)).toBe(true)
  })

  it("rejects a descriptor with an invalid route family", () => {
    const result = Schema.decodeUnknownEither(Contracts.DesiredRuntimeDescriptorSchema)(
      {
        artifact: { modelRef: "bad-model" },
        route: {
          family: "UnknownFamily",
          serveMode: "self-hosted",
          authMethod: "none",
          baseUrl: "in-memory://bad"
        }
      },
      { onExcessProperty: "error" }
    )

    expect(Either.isLeft(result)).toBe(true)
  })
})
