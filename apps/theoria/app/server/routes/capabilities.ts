import { HttpServerResponse } from "@effect/platform"
import { Clock, Effect, Schema } from "effect"

import { Capabilities } from "../../contracts/capabilities.js"
import { cardsForReleaseStage } from "../../contracts/card.js"
import { serverReleaseStage } from "../config/release-stage.js"
import { RuntimeInfo } from "../config/runtime.js"
import { DspProviderRuntime, dspRuntimeProjection } from "../demos/effect-dsp/provider.js"
import { capabilityForId } from "../demos/registry.js"

const jsonResponse = (body: unknown) =>
  HttpServerResponse.json(body, {
    status: 200,
    headers: {
      "cache-control": "no-store"
    }
  })

export const capabilitiesRoute = (requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const releaseStage = yield* serverReleaseStage
    const runtimeInfo = yield* RuntimeInfo
    const dspRuntime = yield* DspProviderRuntime
    const dsp = yield* dspRuntimeProjection(dspRuntime)
    const demos = yield* Effect.forEach(cardsForReleaseStage(releaseStage), (card) => capabilityForId(card.id))
    const endedAtMs = yield* Clock.currentTimeMillis

    const data = yield* Schema.decodeUnknown(Capabilities)({
      demos,
      dsp
    })

    return jsonResponse({
      ok: true,
      meta: {
        requestId,
        buildSha: runtimeInfo.buildSha,
        durationMs: endedAtMs - startedAtMs
      },
      data
    })
  })
