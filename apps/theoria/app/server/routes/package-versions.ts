import { HttpServerResponse } from "@effect/platform"
import { Clock, Effect } from "effect"

import { PackageVersionsInfo } from "../config/package-versions.js"
import { RuntimeInfo } from "../config/runtime.js"

const jsonResponse = (body: unknown) =>
  HttpServerResponse.json(body, {
    status: 200,
    headers: {
      "cache-control": "public, max-age=300"
    }
  })

export const packageVersionsRoute = (requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const runtimeInfo = yield* RuntimeInfo
    const packageVersions = yield* PackageVersionsInfo
    const endedAtMs = yield* Clock.currentTimeMillis

    return jsonResponse({
      ok: true,
      meta: {
        requestId,
        buildSha: runtimeInfo.buildSha,
        durationMs: endedAtMs - startedAtMs
      },
      data: packageVersions.versions
    })
  })
