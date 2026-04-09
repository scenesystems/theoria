import { HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"

import { Version, VersionSuccessEnvelope } from "../../contracts/version.js"
import { RuntimeInfo } from "../config/runtime.js"
import { ResponseTiming } from "../kernel/response-timing.js"

const jsonResponse = (body: unknown) =>
  HttpServerResponse.json(body, {
    status: 200,
    headers: {
      "cache-control": "no-store"
    }
  })

export const versionRoute = (requestId: string) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)
    const runtimeInfo = yield* RuntimeInfo

    return yield* jsonResponse(
      VersionSuccessEnvelope.make({
        ok: true,
        meta: yield* timing.finish(),
        data: Version.make({
          service: "theoria",
          buildSha: runtimeInfo.buildSha,
          startedAtMs: runtimeInfo.startedAtMs
        })
      })
    )
  })
