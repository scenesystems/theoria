import { Effect, Match, Option } from "effect"

import { entryApiRouteFromPathname } from "../../contracts/entry/api-route.js"
import { entryPreloadRoute } from "./entry-preload.js"
import { executionFailureEnvelope, jsonResponse, routeNotFoundEnvelope } from "./entry-response.js"
import { entryRunRoute } from "./entry-run.js"
import { entryStreamRoute } from "./entry-stream.js"

export const entryRoute = (pathname: string, requestId: string, rawUrl: string | null = null) =>
  Effect.suspend(() =>
    Option.match(entryApiRouteFromPathname(pathname), {
      onNone: () => jsonResponse(routeNotFoundEnvelope(requestId)),
      onSome: (route) =>
        Match.value(route).pipe(
          Match.tag("stream", ({ id }) => entryStreamRoute({ id, rawUrl, requestId })),
          Match.tag("run", ({ id }) => entryRunRoute({ id, requestId })),
          Match.tag("preload", ({ id }) => entryPreloadRoute({ id, requestId })),
          Match.exhaustive
        )
    })
  ).pipe(
    Effect.catchAll((error) =>
      Effect.logError("theoria entry route failed").pipe(
        Effect.annotateLogs("pathname", pathname),
        Effect.annotateLogs("requestId", requestId),
        Effect.annotateLogs("error", String(error)),
        Effect.zipRight(jsonResponse(executionFailureEnvelope(requestId)))
      )
    )
  )
