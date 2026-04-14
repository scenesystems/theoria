import { BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"

import type { DesiredRuntimeDescriptor } from "../src/contracts/index.js"
import * as OpenAiCompatible from "../src/OpenAiCompatible/index.js"
import * as Runtime from "../src/Runtime/index.js"

const desired: DesiredRuntimeDescriptor = {
  artifact: { modelRef: "local/llama-3.2" }
}

const resolution = OpenAiCompatible.OpenAiCompatibleResolution.fromDescriptor(
  desired,
  "http://localhost:11434/v1"
)

const evidence = Runtime.RuntimeEvidence.fromResolution({
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
