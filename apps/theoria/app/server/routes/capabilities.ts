import { HttpServerResponse } from "@effect/platform"
import { Clock, Effect } from "effect"

import { capabilityAvailability } from "../capability/availability.js"
import { serverReleaseStage } from "../config/release-stage.js"
import { RuntimeInfo } from "../config/runtime.js"

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
    const data = yield* capabilityAvailability(releaseStage)
    const endedAtMs = yield* Clock.currentTimeMillis

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
