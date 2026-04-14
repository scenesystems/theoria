import { Effect, Option } from "effect"

import type { ErrorCode } from "../../contracts/error.js"
import type { StudyRunRequest } from "../../contracts/study/registry.js"
import { type RunData, RunSuccessEnvelope } from "../../contracts/study/run.js"
import { serverReleaseStage } from "../config/release-stage.js"
import { lookupForReleaseStage } from "./registry.js"
import { ResponseTiming } from "./response-timing.js"
import type { EntryStreamRequest } from "./stream-request.js"

const successful = (timing: ResponseTiming, data: RunData) =>
  timing.finish().pipe(Effect.map((meta) => RunSuccessEnvelope.ok(meta, data)))

const failed = (timing: ResponseTiming, code: ErrorCode, message: string, retryable: boolean) =>
  timing.fail({ code, message, retryable })

const streamRequestForRunRequest = (request: StudyRunRequest): EntryStreamRequest => ({
  runToken: request.runToken,
  draft: request.draft,
  plan: null
})

export const execute = (request: StudyRunRequest, requestId: string) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)
    const releaseStage = yield* serverReleaseStage

    const definitionOption = lookupForReleaseStage(request.draft.entryId, releaseStage)

    return yield* Option.match(definitionOption, {
      onNone: () => failed(timing, "invalid-entry-id", "Requested entry does not exist.", false),
      onSome: (definition) =>
        definition.execution.execute(streamRequestForRunRequest(request)).pipe(
          Effect.flatMap((data) => successful(timing, data)),
          Effect.catchAll((error) => failed(timing, error.code, error.message, error.retryable))
        )
    })
  })
