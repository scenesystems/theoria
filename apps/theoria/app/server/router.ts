import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Clock, Effect, Match } from "effect"

import { RuntimeInfo } from "./config/runtime.js"
import { capabilitiesRoute } from "./routes/capabilities.js"
import { entryRoute } from "./routes/entries.js"
import { liveRoute, readyRoute } from "./routes/health.js"
import { openAgentTraceRoute } from "./routes/open-agent-trace.js"
import { packageDocsRoute } from "./routes/package-docs.js"
import { packageVersionsRoute } from "./routes/package-versions.js"
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
    Match.when((value) => value.startsWith("/api/entries/"), () => entryRoute(pathname, requestId, request.url)),
    Match.when("/api/health/live", () => liveRoute(requestId)),
    Match.when("/api/health/ready", () => readyRoute(requestId)),
    Match.when("/api/version", () => versionRoute(requestId)),
    Match.when("/api/versions/packages", () => packageVersionsRoute(requestId)),
    Match.when(
      (value) => value.startsWith("/api/package-docs"),
      () => packageDocsRoute(pathname, requestId, request.url)
    ),
    Match.when(
      (value) => value.startsWith("/api/open-agent-trace"),
      () => openAgentTraceRoute(pathname, requestId)
    ),
    Match.when("/api/capabilities", () => capabilitiesRoute(requestId)),
    Match.when("/sitemap.xml", () => sitemapRoute),
    Match.when((value) => value.startsWith("/api/"), () => apiNotFoundResponse(requestId)),
    Match.orElse(() => staticResponse(pathname, request.url))
  )

  return yield* Effect.flatten(routeEffect)
})
