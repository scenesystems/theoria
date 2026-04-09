import { Effect, Match } from "effect"

import { entryPreloadRoute } from "./entry-preload.js"
import { executionFailureEnvelope, jsonResponse, routeNotFoundEnvelope } from "./entry-response.js"
import { decodeEntryRoute, InvalidEntryRoute } from "./entry-route.js"
import { entryRunRoute } from "./entry-run.js"
import { entryStreamRoute } from "./entry-stream.js"

export const entryRoute = (pathname: string, requestId: string, rawUrl: string | null = null) =>
  decodeEntryRoute(pathname).pipe(
    Effect.flatMap((route) =>
      Match.value(route).pipe(
        Match.tag("stream", ({ id }) => entryStreamRoute({ id, rawUrl, requestId })),
        Match.tag("run", ({ id }) => entryRunRoute({ id, requestId })),
        Match.tag("preload", ({ id }) => entryPreloadRoute({ id, requestId })),
        Match.exhaustive
      )
    ),
    Effect.catchAll((error) =>
      error instanceof InvalidEntryRoute
        ? jsonResponse(routeNotFoundEnvelope(requestId))
        : Effect.logError("theoria entry route failed").pipe(
          Effect.annotateLogs("pathname", pathname),
          Effect.annotateLogs("requestId", requestId),
          Effect.annotateLogs("error", String(error)),
          Effect.zipRight(jsonResponse(executionFailureEnvelope(requestId)))
        )
    )
  )
