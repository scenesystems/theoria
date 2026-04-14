import { HttpServerRequest } from "@effect/platform"
import { Effect } from "effect"

import type { EntryId } from "../../contracts/entry/id.js"
import { StudyRunRequest as StudyRunRequestSchema } from "../../contracts/study/registry.js"
import { execute } from "../kernel/definition.js"

import { invalidQueryEnvelope, jsonResponse } from "./entry-response.js"

export const entryRunRoute = ({
  id,
  requestId
}: {
  readonly id: EntryId
  readonly requestId: string
}) =>
  HttpServerRequest.schemaBodyJson(StudyRunRequestSchema).pipe(
    Effect.flatMap((request) =>
      request.draft.entryId !== id
        ? jsonResponse(invalidQueryEnvelope(requestId, "Entry run request does not match the route id."))
        : execute(request, requestId).pipe(Effect.flatMap(jsonResponse))
    )
  )
