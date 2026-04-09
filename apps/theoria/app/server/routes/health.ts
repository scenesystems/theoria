import { HttpServerResponse } from "@effect/platform"
import { Clock, Effect } from "effect"

import { Live, LiveSuccessEnvelope, Ready, ReadySuccessEnvelope } from "../../contracts/health.js"
import { DspProviderRuntime, dspRuntimeProjection } from "../capability/effect-dsp.js"
import { RuntimeInfo } from "../config/runtime.js"
import { ResponseTiming } from "../kernel/response-timing.js"

const jsonResponse = (body: unknown) =>
  HttpServerResponse.json(body, {
    status: 200,
    headers: {
      "cache-control": "no-store"
    }
  })

export const liveRoute = (requestId: string) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)

    return yield* jsonResponse(
      LiveSuccessEnvelope.make({
        ok: true,
        meta: yield* timing.finish(),
        data: Live.make({
          status: "live"
        })
      })
    )
  })

export const readyRoute = (requestId: string) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)
    const runtimeInfo = yield* RuntimeInfo
    const dspRuntime = yield* DspProviderRuntime
    const dsp = yield* dspRuntimeProjection(dspRuntime)
    const now = yield* Clock.currentTimeMillis

    return yield* jsonResponse(
      ReadySuccessEnvelope.make({
        ok: true,
        meta: yield* timing.finish(),
        data: Ready.make({
          status: "ready",
          uptimeMs: now - runtimeInfo.startedAtMs,
          dsp
        })
      })
    )
  })
