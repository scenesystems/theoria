import { HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"

import { PackageVersionsSuccessEnvelope } from "../../contracts/capability/package-versions.js"
import { PackageVersionsInfo } from "../config/package-versions.js"
import { ResponseTiming } from "../kernel/response-timing.js"

const jsonResponse = (body: unknown) =>
  HttpServerResponse.json(body, {
    status: 200,
    headers: {
      "cache-control": "public, max-age=300"
    }
  })

export const packageVersionsRoute = (requestId: string) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)
    const packageVersions = yield* PackageVersionsInfo

    return yield* jsonResponse(PackageVersionsSuccessEnvelope.ok(yield* timing.finish(), packageVersions))
  })
