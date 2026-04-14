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
      LiveSuccessEnvelope.ok(yield* timing.finish(), Live.live())
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
      ReadySuccessEnvelope.ok(
        yield* timing.finish(),
        Ready.ready({
          uptimeMs: now - runtimeInfo.startedAtMs,
          dsp
        })
      )
    )
  })
