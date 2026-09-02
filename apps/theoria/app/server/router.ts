import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Clock, Effect, Match, Option } from "effect"

import { RuntimeInfo } from "./config/runtime.js"
import { liveRoute, readyRoute } from "./routes/health.js"
import { imaginedPlacePath, imaginedPlaceRoute } from "./routes/imagined-place.js"
import { sitemapRoute } from "./routes/sitemap.js"
import { staticResponse } from "./routes/static.js"
import { versionRoute } from "./routes/version.js"

const requestUrlBase = "http://127.0.0.1"

const requestPathname = (url: string): string => new URL(url, requestUrlBase).pathname

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

export const app = Effect.gen(function*() {
  const request = yield* HttpServerRequest.HttpServerRequest
  const pathname = requestPathname(request.url)
  const requestId = crypto.randomUUID()
  const routeEffect = Match.value(pathname).pipe(
    Match.when("/api/health/live", () => liveRoute(requestId)),
    Match.when("/api/health/ready", () => readyRoute(requestId)),
    Match.when("/api/version", () => versionRoute(requestId)),
    Match.when(imaginedPlacePath, () => imaginedPlaceRoute(request, requestId)),
    Match.when("/sitemap.xml", () => sitemapRoute),
    Match.when((value) => value.startsWith("/api/"), () => apiNotFoundResponse(requestId)),
    Match.orElse(() => staticResponse(pathname, Option.fromNullable(request.headers["accept-encoding"])))
  )

  return yield* Effect.flatten(routeEffect)
})
