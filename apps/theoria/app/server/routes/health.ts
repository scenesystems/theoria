import { Clock, Effect } from "effect"

import { jsonResponse, responseMeta } from "../api-response.js"
import { RuntimeInfo } from "../config/runtime.js"

export const liveRoute = (requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const meta = yield* responseMeta(requestId, startedAtMs)

    return yield* jsonResponse({
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
    const now = yield* Clock.currentTimeMillis
    const meta = yield* responseMeta(requestId, startedAtMs)

    return yield* jsonResponse({
      ok: true,
      meta,
      data: {
        status: "ready",
        uptimeMs: now - runtimeInfo.startedAtMs
      }
    })
  })
