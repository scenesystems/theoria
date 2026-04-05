import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import type { DesiredRuntimeDescriptor } from "../../src/contracts/index.js"
import * as Runtime from "../../src/Runtime/index.js"

describe("Runtime/runtime-resolver", () => {
  it.effect("resolves stable descriptors to provenance, capabilities, and live layers without execution evidence", () =>
    Effect.gen(function*() {
      const desired: DesiredRuntimeDescriptor = {
        artifact: { modelRef: "meta-llama/Llama-3.3-70B-Instruct" },
        route: {
          family: "HuggingFace",
          serveMode: "routed-marketplace",
          authMethod: "hf-token",
          baseUrl: "https://router.huggingface.co/v1",
          gatewayId: "hf-router"
        }
      }

      const resolver = yield* Runtime.RuntimeResolver.pipe(Effect.provide(Runtime.RuntimeResolverLive))
      const result = yield* resolver.resolve(desired)

      expect(result.desired.artifact.modelRef).toBe("meta-llama/Llama-3.3-70B-Instruct")
      expect(result.resolvedRoute.route.family).toBe("HuggingFace")
      expect(result.resolvedRoute.selectionReason).toBe("hugging-face-routed-live")
      expect(result.capabilities.textGeneration).toBe(true)
      expect(Option.isSome(result.layers.languageModel)).toBe(true)
      expect("resolvedRuntime" in result).toBe(false)
    }))
})
