import { Cause, Effect, Option } from "effect"

import type { EntryId } from "../../contracts/entry/id.js"
import type { ErrorCode } from "../../contracts/error.js"
import { type ProgramPreview, ProgramPreviewSuccessEnvelope } from "../../contracts/presentation/program-preview.js"
import { serverReleaseStage } from "../config/release-stage.js"

import { lookupForReleaseStage } from "./registry.js"
import { ResponseTiming } from "./response-timing.js"

const successful = (timing: ResponseTiming, data: ProgramPreview) =>
  timing.finish().pipe(Effect.map((meta) => ProgramPreviewSuccessEnvelope.ok(meta, data)))

const failed = (timing: ResponseTiming, code: ErrorCode, message: string, retryable: boolean) =>
  timing.fail({ code, message, retryable })

export const preload = (id: EntryId, requestId: string) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)
    const releaseStage = yield* serverReleaseStage

    const definitionOption = lookupForReleaseStage(id, releaseStage)

    return yield* Option.match(definitionOption, {
      onNone: () => failed(timing, "invalid-entry-id", "Requested entry does not exist.", false),
      onSome: (definition) =>
        definition.preload.pipe(
          Effect.flatMap((data) => successful(timing, data)),
          Effect.catchAll((error) =>
            Effect.logError("theoria entry preload failed").pipe(
              Effect.annotateLogs("entryId", id),
              Effect.annotateLogs("requestId", requestId),
              Effect.annotateLogs("cause", Cause.pretty(Cause.fail(error))),
              Effect.zipRight(failed(timing, "execution-failed", "Entry preload failed.", true))
            )
          )
        )
    })
  })
