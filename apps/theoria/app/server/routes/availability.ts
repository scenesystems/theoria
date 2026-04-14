import { HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"

import { CapabilityAvailabilitySuccessEnvelope } from "../../contracts/capability/availability.js"
import { capabilityAvailability } from "../capability/availability.js"
import { serverReleaseStage } from "../config/release-stage.js"
import { ResponseTiming } from "../kernel/response-timing.js"

const jsonResponse = (body: unknown) =>
  HttpServerResponse.json(body, {
    status: 200,
    headers: {
      "cache-control": "no-store"
    }
  })

export const capabilityAvailabilityRoute = (requestId: string) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)
    const releaseStage = yield* serverReleaseStage
    const data = yield* capabilityAvailability(releaseStage)
    const envelope = CapabilityAvailabilitySuccessEnvelope.ok(yield* timing.finish(), data)

    return yield* jsonResponse(envelope)
  })
