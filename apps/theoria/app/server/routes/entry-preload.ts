import { Effect } from "effect"

import type { EntryRunRequest } from "../../contracts/entry/registry.js"
import { preload } from "../kernel/preload.js"

import { jsonResponse } from "./entry-response.js"

export const entryPreloadRoute = ({
  id,
  requestId
}: {
  readonly id: EntryRunRequest["draft"]["entryId"]
  readonly requestId: string
}) =>
  preload(id, requestId).pipe(
    Effect.flatMap(jsonResponse)
  )
