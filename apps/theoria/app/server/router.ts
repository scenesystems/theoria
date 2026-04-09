import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Effect, Match } from "effect"

import { ResponseTiming } from "./kernel/response-timing.js"
import { capabilityAvailabilityRoute } from "./routes/availability.js"
import { entryRoute } from "./routes/entries.js"
import { liveRoute, readyRoute } from "./routes/health.js"
import { openAgentTraceRoute } from "./routes/open-agent-trace.js"
import { packageDocsRoute } from "./routes/package-docs.js"
import { packageVersionsRoute } from "./routes/package-versions.js"
import { appRequestRoute } from "./routes/request-route.js"
import { sitemapRoute } from "./routes/sitemap.js"
import { staticResponse } from "./routes/static.js"
import { versionRoute } from "./routes/version.js"

const requestUrlBase = "http://127.0.0.1"

const requestPathname = (url: string): string => new URL(url, requestUrlBase).pathname

const apiNotFoundResponse = (requestId: string) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)

    return yield* HttpServerResponse.json(
      yield* timing.fail({
        code: "route-not-found",
        message: "API route not found.",
        retryable: false
      }),
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
  const routeEffect = Match.value(appRequestRoute(pathname)).pipe(
    Match.tag(
      "EntryApiRequestRoute",
      ({ pathname: routePathname }) => entryRoute(routePathname, requestId, request.url)
    ),
    Match.tag("HealthLiveRequestRoute", () => liveRoute(requestId)),
    Match.tag("HealthReadyRequestRoute", () => readyRoute(requestId)),
    Match.tag("VersionRequestRoute", () => versionRoute(requestId)),
    Match.tag("PackageVersionsRequestRoute", () => packageVersionsRoute(requestId)),
    Match.tag(
      "PackageDocsApiRequestRoute",
      ({ pathname: routePathname }) => packageDocsRoute(routePathname, requestId, request.url)
    ),
    Match.tag(
      "OpenAgentTraceApiRequestRoute",
      ({ pathname: routePathname }) => openAgentTraceRoute(routePathname, requestId)
    ),
    Match.tag("CapabilityAvailabilityRequestRoute", () => capabilityAvailabilityRoute(requestId)),
    Match.tag("SitemapRequestRoute", () => sitemapRoute),
    Match.tag("ApiNotFoundRequestRoute", () => apiNotFoundResponse(requestId)),
    Match.tag("StaticRequestRoute", ({ pathname: routePathname }) => staticResponse(routePathname, request.url)),
    Match.exhaustive
  )

  return yield* Effect.flatten(routeEffect)
})
