/**
 * Records route and response-model evidence for a statically configured
 * OpenAI-compatible endpoint without contacting the endpoint.
 */
import { BunRuntime } from "@effect/platform-bun"
import { Boolean, Effect, Function } from "effect"

import * as OpenAiCompatible from "@scenesystems/effect-inference/OpenAiCompatible"
import * as RuntimeEvidence from "@scenesystems/effect-inference/RuntimeEvidence"
import type * as RuntimeRequest from "@scenesystems/effect-inference/RuntimeRequest"

const request: RuntimeRequest.RuntimeRequest = {
  model: { modelRef: "local/llama-3.2" }
}

const resolution = OpenAiCompatible.resolve(
  request,
  "http://localhost:11434/v1"
)

const evidence = RuntimeEvidence.make(resolution, { responseModel: "local/llama-3.2" })

export const program = Effect.log({
  requestedModel: evidence.request.model.modelRef,
  routeFamily: evidence.route.route.family,
  baseUrl: evidence.route.route.baseUrl,
  responseModel: evidence.response.responseModel
})

Boolean.match(import.meta.main, {
  onTrue: () => BunRuntime.runMain(program),
  onFalse: Function.constVoid
})
