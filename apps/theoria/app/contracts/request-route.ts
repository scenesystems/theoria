import { Option, Schema } from "effect"

import { CapabilityAvailabilityRoute } from "./capability/availability.js"
import { PackageVersionsRoute } from "./capability/package-versions.js"
import { entryApiRouteFromPathname, EntryApiRouteSchema } from "./entry/api-route.js"
import { LiveHealthRoute, ReadyHealthRoute } from "./health.js"
import {
  type PackageDocsApiRequestRoute,
  PackageDocsApiRequestRoute as PackageDocsApiRequestRouteSchema,
  packageDocsApiRouteFromLocation
} from "./presentation/package-docs.js"
import { PageLocation } from "./presentation/page-location.js"
import {
  type OpenAgentTraceApiRoute,
  openAgentTraceApiRouteFromPathname,
  OpenAgentTraceApiRouteSchema
} from "./study/workflow/open-agent-trace.js"
import { VersionRoute } from "./version.js"

export class SitemapRequestRoute extends Schema.TaggedClass<SitemapRequestRoute>()("SitemapRequestRoute", {}) {
  static sitemap(): SitemapRequestRoute {
    return sitemapRequestRouteSingleton
  }
}

export class ApiNotFoundRequestRoute
  extends Schema.TaggedClass<ApiNotFoundRequestRoute>()("ApiNotFoundRequestRoute", {})
{
  static apiNotFound(): ApiNotFoundRequestRoute {
    return apiNotFoundRequestRouteSingleton
  }
}

export class StaticRequestRoute extends Schema.TaggedClass<StaticRequestRoute>()("StaticRequestRoute", {
  pathname: Schema.String
}) {
  static fromPathname(pathname: string): StaticRequestRoute {
    return StaticRequestRoute.make({ pathname })
  }
}

export const AppRequestRoute = Schema.Union(
  EntryApiRouteSchema,
  LiveHealthRoute,
  ReadyHealthRoute,
  VersionRoute,
  PackageVersionsRoute,
  PackageDocsApiRequestRouteSchema,
  OpenAgentTraceApiRouteSchema,
  CapabilityAvailabilityRoute,
  SitemapRequestRoute,
  ApiNotFoundRequestRoute,
  StaticRequestRoute
)

export type AppRequestRoute = typeof AppRequestRoute.Type

const packageDocsRequestRoute = (pathname: string): Option.Option<AppRequestRoute> =>
  packageDocsApiRouteFromLocation(PageLocation.fromPathnameSearch(pathname)).pipe(
    Option.map((route: PackageDocsApiRequestRoute): AppRequestRoute => route)
  )

const openAgentTraceRequestRoute = (pathname: string): Option.Option<AppRequestRoute> =>
  openAgentTraceApiRouteFromPathname(pathname).pipe(
    Option.map((route: OpenAgentTraceApiRoute): AppRequestRoute => route)
  )

const sitemapRequestRouteFromPathname = (pathname: string): Option.Option<AppRequestRoute> =>
  pathname === "/sitemap.xml"
    ? Option.some(SitemapRequestRoute.sitemap())
    : Option.none()

const staticOrApiFallbackRoute = (pathname: string): AppRequestRoute =>
  pathname.startsWith("/api/")
    ? ApiNotFoundRequestRoute.apiNotFound()
    : StaticRequestRoute.fromPathname(pathname)

export const appRequestRoute = (pathname: string): AppRequestRoute =>
  entryApiRouteFromPathname(pathname).pipe(
    Option.map((route): AppRequestRoute => route),
    Option.orElse(() => LiveHealthRoute.fromPathname(pathname).pipe(Option.map((route): AppRequestRoute => route))),
    Option.orElse(() => ReadyHealthRoute.fromPathname(pathname).pipe(Option.map((route): AppRequestRoute => route))),
    Option.orElse(() => VersionRoute.fromPathname(pathname).pipe(Option.map((route): AppRequestRoute => route))),
    Option.orElse(() =>
      PackageVersionsRoute.fromPathname(pathname).pipe(Option.map((route): AppRequestRoute => route))
    ),
    Option.orElse(() => packageDocsRequestRoute(pathname)),
    Option.orElse(() => openAgentTraceRequestRoute(pathname)),
    Option.orElse(() =>
      CapabilityAvailabilityRoute.fromPathname(pathname).pipe(Option.map((route): AppRequestRoute => route))
    ),
    Option.orElse(() => sitemapRequestRouteFromPathname(pathname)),
    Option.getOrElse(() => staticOrApiFallbackRoute(pathname))
  )

const sitemapRequestRouteSingleton = SitemapRequestRoute.make({})
const apiNotFoundRequestRouteSingleton = ApiNotFoundRequestRoute.make({})
