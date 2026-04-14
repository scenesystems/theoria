import { Effect } from "effect"

import type { EntryId } from "../../contracts/entry/id.js"
import { preload } from "../kernel/preload.js"

import { jsonResponse } from "./entry-response.js"

export const entryPreloadRoute = ({
  id,
  requestId
}: {
  readonly id: EntryId
  readonly requestId: string
}) =>
  preload(id, requestId).pipe(
    Effect.flatMap(jsonResponse)
  )
