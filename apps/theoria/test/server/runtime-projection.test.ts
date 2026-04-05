import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import * as InferenceTesting from "../../../../packages/effect-inference/src/Runtime/testing.js"
import { dspRuntimeProjection } from "../../app/server/demos/effect-dsp/provider.js"

describe("server/runtime-projection", () => {
  it.effect("projects requested, resolved-route, and resolved-runtime truth from the effect-inference substrate", () =>
    Effect.gen(function*() {
      const desired = InferenceTesting.makeDesiredRuntimeDescriptor({
        modelRef: "meta-llama/Llama-3.3-70B-Instruct"
      })
      const resolvedRoute = InferenceTesting.makeResolvedRouteDescriptor({
        desired,
        route: {
          family: "HuggingFace",
          serveMode: "dedicated-endpoint",
          authMethod: "api-key",
          baseUrl: "https://endpoint.huggingface.co/v1",
          endpointId: "llama-prod",
          deploymentId: "deployment-1",
          runtimeFlavorHint: "tgi"
        },
        selectedDeployment: "deployment-1",
        providerModel: "meta-llama/Llama-3.3-70B-Instruct"
      })
      const resolvedRuntime = InferenceTesting.makeResolvedRuntimeDescriptor({
        responseModel: "meta-llama/Llama-3.3-70B-Instruct",
        responseId: "resp_123"
      })
      const projection = yield* dspRuntimeProjection({
        capability: {
          enabled: true,
          provider: Option.none(),
          model: Option.none(),
          routeFamily: Option.none(),
          baseUrl: Option.none(),
          reason: Option.none()
        },
        resolution: {
          desired: Option.some(desired),
          resolvedRoute: Option.some(resolvedRoute)
        },
        readResolvedRuntime: Effect.succeed(Option.some(resolvedRuntime))
      })

      expect(projection.requestedRuntime?.artifact.modelRef).toBe("meta-llama/Llama-3.3-70B-Instruct")
      expect(projection.resolvedRoute?.route.endpointId).toBe("llama-prod")
      expect(projection.resolvedRoute?.selectedDeployment).toBe("deployment-1")
      expect(projection.resolvedRuntime?.responseId).toBe("resp_123")
    }))

  it.effect("keeps disabled provider state honest when no runtime descriptor resolved", () =>
    Effect.gen(function*() {
      const projection = yield* dspRuntimeProjection({
        capability: {
          enabled: false,
          provider: Option.none(),
          model: Option.none(),
          routeFamily: Option.none(),
          baseUrl: Option.none(),
          reason: Option.some("DSP runtime resolution failed.")
        },
        resolution: {
          desired: Option.none(),
          resolvedRoute: Option.none()
        },
        readResolvedRuntime: Effect.succeed(Option.none())
      })

      expect(projection.enabled).toBe(false)
      expect(projection.reason).toBe("DSP runtime resolution failed.")
      expect(projection.requestedRuntime).toBeUndefined()
      expect(projection.resolvedRoute).toBeUndefined()
      expect(projection.resolvedRuntime).toBeUndefined()
    }))
})
