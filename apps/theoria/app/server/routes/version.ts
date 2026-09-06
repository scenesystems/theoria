import { Clock, Effect } from "effect"

import { jsonResponse, responseMeta } from "../api-response.js"
import { RuntimeInfo } from "../config/runtime.js"

export const versionRoute = (requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const runtimeInfo = yield* RuntimeInfo
    const meta = yield* responseMeta(requestId, startedAtMs)

    return yield* jsonResponse({
      ok: true,
      meta,
      data: {
        service: "theoria",
        buildSha: runtimeInfo.buildSha,
        startedAtMs: runtimeInfo.startedAtMs
      }
    })
  })
