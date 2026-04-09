import { HttpServerRequest } from "@effect/platform"
import { Effect } from "effect"

import { type EntryRunRequest, EntryRunRequest as EntryRunRequestSchema } from "../../contracts/entry/registry.js"
import { execute } from "../kernel/definition.js"

import { invalidQueryEnvelope, jsonResponse } from "./entry-response.js"

export const entryRunRoute = ({
  id,
  requestId
}: {
  readonly id: EntryRunRequest["draft"]["entryId"]
  readonly requestId: string
}) =>
  HttpServerRequest.schemaBodyJson(EntryRunRequestSchema).pipe(
    Effect.flatMap((request) =>
      request.draft.entryId !== id
        ? jsonResponse(invalidQueryEnvelope(requestId, "Entry run request does not match the route id."))
        : execute(request, requestId).pipe(Effect.flatMap(jsonResponse))
    )
  )
