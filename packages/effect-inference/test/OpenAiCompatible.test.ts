import { describe, expect, it } from "@effect/vitest"
import * as OpenAiCompatible from "@scenesystems/effect-inference/OpenAiCompatible"

describe("OpenAiCompatible", () => {
  it("keeps route identity above transport planning and resolution", () => {
    const request = OpenAiCompatible.withRoute(
      { model: { modelRef: "local/model" } },
      new OpenAiCompatible.RouteOptions({
        baseUrl: "http://127.0.0.1:11434/v1",
        serveMode: "local-runtime",
        authMethod: "none",
        runtimeFlavorHint: "ollama"
      })
    )
    const resolution = OpenAiCompatible.resolve(request, "https://unused.example.test")
    const plan = OpenAiCompatible.planTransport(resolution.route.route)

    expect(plan.transport.baseUrl).toBe("http://127.0.0.1:11434/v1")
    expect(resolution.route.route.family).toBe("OpenAiCompatible")
    expect(resolution.route.runtimeFlavor).toBe("ollama")
    expect(resolution.capabilities.toolCalling).toBe(true)
  })
})
