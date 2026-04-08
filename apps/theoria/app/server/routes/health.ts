import { HttpServerResponse } from "@effect/platform"
import { Clock, Effect } from "effect"

import { DspProviderRuntime, dspRuntimeProjection } from "../capability/effect-dsp.js"
import { RuntimeInfo } from "../config/runtime.js"

const jsonResponse = (body: unknown) =>
  HttpServerResponse.json(body, {
    status: 200,
    headers: {
      "cache-control": "no-store"
    }
  })

const responseMeta = (requestId: string, buildSha: string, startedAtMs: number) =>
  Effect.gen(function*() {
    const endedAtMs = yield* Clock.currentTimeMillis

    return {
      requestId,
      buildSha,
      durationMs: endedAtMs - startedAtMs
    }
  })

export const liveRoute = (requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const runtimeInfo = yield* RuntimeInfo
    const meta = yield* responseMeta(requestId, runtimeInfo.buildSha, startedAtMs)

    return jsonResponse({
      ok: true,
      meta,
      data: {
        status: "live"
      }
    })
  })

export const readyRoute = (requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const runtimeInfo = yield* RuntimeInfo
    const dspRuntime = yield* DspProviderRuntime
    const dsp = yield* dspRuntimeProjection(dspRuntime)
    const now = yield* Clock.currentTimeMillis
    const meta = yield* responseMeta(requestId, runtimeInfo.buildSha, startedAtMs)

    return jsonResponse({
      ok: true,
      meta,
      data: {
        status: "ready",
        uptimeMs: now - runtimeInfo.startedAtMs,
        dsp
      }
    })
  })
