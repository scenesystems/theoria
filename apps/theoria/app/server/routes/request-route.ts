import { Data, Match } from "effect"

import { CapabilityAvailabilityPathname } from "../../contracts/capability/availability.js"
import { HealthLivePathname, HealthReadyPathname } from "../../contracts/health.js"
import { isPackageDocsApiPathname } from "../../contracts/presentation/package-docs.js"
import {
  OpenAgentTraceConsumerArtifactRoute,
  OpenAgentTraceRegistryRoute,
  OpenAgentTraceWorkflowHookupRoute
} from "../../contracts/study/workflow/open-agent-trace.js"
import { VersionPathname } from "../../contracts/version.js"

class EntryApiRequestRoute extends Data.TaggedClass("EntryApiRequestRoute")<{
  readonly pathname: string
}> {}

class HealthLiveRequestRoute extends Data.TaggedClass("HealthLiveRequestRoute")<{}> {}

class HealthReadyRequestRoute extends Data.TaggedClass("HealthReadyRequestRoute")<{}> {}

class VersionRequestRoute extends Data.TaggedClass("VersionRequestRoute")<{}> {}

class PackageVersionsRequestRoute extends Data.TaggedClass("PackageVersionsRequestRoute")<{}> {}

class PackageDocsApiRequestRoute extends Data.TaggedClass("PackageDocsApiRequestRoute")<{
  readonly pathname: string
}> {}

class OpenAgentTraceApiRequestRoute extends Data.TaggedClass("OpenAgentTraceApiRequestRoute")<{
  readonly pathname: string
}> {}

class CapabilityAvailabilityRequestRoute extends Data.TaggedClass("CapabilityAvailabilityRequestRoute")<{}> {}

class SitemapRequestRoute extends Data.TaggedClass("SitemapRequestRoute")<{}> {}

class ApiNotFoundRequestRoute extends Data.TaggedClass("ApiNotFoundRequestRoute")<{}> {}

class StaticRequestRoute extends Data.TaggedClass("StaticRequestRoute")<{
  readonly pathname: string
}> {}

export type AppRequestRoute =
  | EntryApiRequestRoute
  | HealthLiveRequestRoute
  | HealthReadyRequestRoute
  | VersionRequestRoute
  | PackageVersionsRequestRoute
  | PackageDocsApiRequestRoute
  | OpenAgentTraceApiRequestRoute
  | CapabilityAvailabilityRequestRoute
  | SitemapRequestRoute
  | ApiNotFoundRequestRoute
  | StaticRequestRoute

export const appRequestRoute = (pathname: string): AppRequestRoute =>
  Match.value(pathname).pipe(
    Match.withReturnType<AppRequestRoute>(),
    Match.when((value) => value.startsWith("/api/entries/"), () => new EntryApiRequestRoute({ pathname })),
    Match.when(HealthLivePathname, () => new HealthLiveRequestRoute()),
    Match.when(HealthReadyPathname, () => new HealthReadyRequestRoute()),
    Match.when(VersionPathname, () => new VersionRequestRoute()),
    Match.when("/api/versions/packages", () => new PackageVersionsRequestRoute()),
    Match.when(isPackageDocsApiPathname, () => new PackageDocsApiRequestRoute({ pathname })),
    Match.when(
      (value) =>
        OpenAgentTraceRegistryRoute.matches(value) ||
        OpenAgentTraceConsumerArtifactRoute.matches(value) ||
        OpenAgentTraceWorkflowHookupRoute.matches(value),
      () => new OpenAgentTraceApiRequestRoute({ pathname })
    ),
    Match.when(CapabilityAvailabilityPathname, () => new CapabilityAvailabilityRequestRoute()),
    Match.when("/sitemap.xml", () => new SitemapRequestRoute()),
    Match.when((value) => value.startsWith("/api/"), () => new ApiNotFoundRequestRoute()),
    Match.orElse(() => new StaticRequestRoute({ pathname }))
  )
