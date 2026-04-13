/**
 * Synthetic linear-path selection for Amp captures.
 *
 * @since 0.2.0
 */
import { Array as Arr, Option } from "effect"

import { type OpenAgentTraceEvent, OpenAgentTraceSelection } from "../schema.js"

/**
 * Resolve a conservative linear active path for Amp captures.
 *
 * @since 0.2.0
 * @category combinators
 */
export const resolveAmpSelection = (events: ReadonlyArray<OpenAgentTraceEvent>) => {
  const selectedLeafEntryId = Arr.last(events).pipe(
    Option.map((event) => event.eventId),
    Option.getOrElse(() => events[0]!.eventId)
  )

  return {
    selection: OpenAgentTraceSelection.make({
      selectedLeafEntryId,
      selectionPolicy: "latest-leaf",
      activePathEntryIds: events.map((event) => event.eventId),
      compactedPathEntryIds: [],
      abandonedBranchRootIds: []
    }),
    branches: []
  }
}
