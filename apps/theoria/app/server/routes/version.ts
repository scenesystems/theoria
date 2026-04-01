import { HttpServerResponse } from "@effect/platform"
import { Clock, Effect } from "effect"

import { RuntimeInfo } from "../config/runtime.js"

const jsonResponse = (body: unknown) =>
  HttpServerResponse.json(body, {
    status: 200,
    headers: {
      "cache-control": "no-store"
    }
  })

export const versionRoute = (requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const runtimeInfo = yield* RuntimeInfo
    const endedAtMs = yield* Clock.currentTimeMillis

    return jsonResponse({
      ok: true,
      meta: {
        requestId,
        buildSha: runtimeInfo.buildSha,
        durationMs: endedAtMs - startedAtMs
      },
      data: {
        service: "theoria",
        buildSha: runtimeInfo.buildSha,
        startedAtMs: runtimeInfo.startedAtMs
      }
    })
  })
