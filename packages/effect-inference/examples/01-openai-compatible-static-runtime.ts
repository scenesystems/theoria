/**
 * Records route and response-model evidence for a statically configured
 * OpenAI-compatible endpoint without contacting the endpoint.
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"

import type { DesiredRuntimeDescriptor } from "@scenesystems/effect-inference/Contracts"
import * as OpenAiCompatible from "@scenesystems/effect-inference/OpenAiCompatible"
import * as Runtime from "@scenesystems/effect-inference/Runtime"

const desired: DesiredRuntimeDescriptor = {
  artifact: { modelRef: "local/llama-3.2" }
}

const resolution = OpenAiCompatible.makeOpenAiCompatibleResolution(
  desired,
  "http://localhost:11434/v1"
)

const evidence = Runtime.makeRuntimeEvidence({
  resolution,
  resolvedRuntime: {
    responseModel: "local/llama-3.2"
  }
})

export const program = Effect.gen(function*() {
  yield* Effect.log({
    requestedModel: evidence.desired.artifact.modelRef,
    routeFamily: evidence.resolvedRoute.route.family,
    baseUrl: evidence.resolvedRoute.route.baseUrl,
    responseModel: evidence.resolvedRuntime.responseModel
  })
})

if (import.meta.main) {
  BunRuntime.runMain(program)
}
