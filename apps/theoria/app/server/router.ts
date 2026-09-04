import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Clock, Effect, Match, Option } from "effect"

import { RuntimeInfo } from "./config/runtime.js"
import { liveRoute, readyRoute } from "./routes/health.js"
import { imaginedPlacePath, imaginedPlaceRoute } from "./routes/imagined-place.js"
import { sitemapRoute } from "./routes/sitemap.js"
import { staticResponse } from "./routes/static.js"
import { versionRoute } from "./routes/version.js"

const apiNotFoundResponse = (requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const runtimeInfo = yield* RuntimeInfo
    const endedAtMs = yield* Clock.currentTimeMillis

    return HttpServerResponse.json(
      {
        ok: false,
        meta: {
          requestId,
          buildSha: runtimeInfo.buildSha,
          durationMs: endedAtMs - startedAtMs
        },
        error: {
          code: "route-not-found",
          message: "API route not found.",
          retryable: false
        }
      },
      {
        status: 404,
        headers: {
          "cache-control": "no-store"
        }
      }
    )
  })

const route = (pathname: string, request: HttpServerRequest.HttpServerRequest, requestId: string) =>
  Effect.flatten(
    Match.value(pathname).pipe(
      Match.when("/api/health/live", () => liveRoute(requestId)),
      Match.when("/api/health/ready", () => readyRoute(requestId)),
      Match.when("/api/version", () => versionRoute(requestId)),
      Match.when(imaginedPlacePath, () => imaginedPlaceRoute(request, requestId)),
      Match.when("/sitemap.xml", () => sitemapRoute),
      Match.when((value) => value.startsWith("/api/"), () => apiNotFoundResponse(requestId)),
      Match.orElse(() => staticResponse(pathname))
    )
  )

/**
 * Every request runs inside the `http.server` span the platform's tracer
 * middleware opens (continuing an incoming `traceparent` when present), so
 * that span's trace id is the request id clients see in response envelopes.
 *
 * A request whose URL cannot be parsed against its host has no route; it is
 * a bad request, not a missing page.
 */
export const app = Effect.gen(function*() {
  const request = yield* HttpServerRequest.HttpServerRequest
  const { traceId: requestId } = yield* Effect.orDie(Effect.currentSpan)
  return yield* Option.match(HttpServerRequest.toURL(request), {
    onNone: () => Effect.succeed(HttpServerResponse.empty({ status: 400 })),
    onSome: (url) => route(url.pathname, request, requestId)
  })
})
