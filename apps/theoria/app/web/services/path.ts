import type { PackageName } from "@theoria/source-proof/contracts"
import { Match, Option } from "effect"

import type { PublishedConsumerId } from "../../contracts/id.js"
import { OpenAgentTracePagePathname } from "../../contracts/open-agent-trace.js"
import { packageDocsPagePath, PackageDocsPagePathname, packageDocsQueryPackage } from "../../contracts/package-docs.js"
import { publishedConsumerIdForPath } from "../../contracts/proving-substrate.js"

export type PageRoute =
  | { readonly _tag: "HomeRoute" }
  | { readonly _tag: "DeepRoute"; readonly id: PublishedConsumerId }
  | { readonly _tag: "PackageDocsRoute"; readonly packageId: PackageName | null }
  | { readonly _tag: "OpenAgentTraceRoute" }

const homeRoute: PageRoute = { _tag: "HomeRoute" }

const deepDiveRoute = (pathname: string): Option.Option<PageRoute> =>
  publishedConsumerIdForPath(pathname).pipe(Option.map((id) => ({ _tag: "DeepRoute", id })))

const packageDocsRoute = (pathname: string, search: string): Option.Option<PageRoute> =>
  Match.value(pathname).pipe(
    Match.when(PackageDocsPagePathname, () =>
      Option.some<PageRoute>({
        _tag: "PackageDocsRoute",
        packageId: packageDocsQueryPackage(search)
      })),
    Match.when(`${PackageDocsPagePathname}/`, () =>
      Option.some<PageRoute>({
        _tag: "PackageDocsRoute",
        packageId: packageDocsQueryPackage(search)
      })),
    Match.orElse(() => Option.none<PageRoute>())
  )

const openAgentTraceRoute = (pathname: string): Option.Option<PageRoute> =>
  Match.value(pathname).pipe(
    Match.when(OpenAgentTracePagePathname, () => Option.some<PageRoute>({ _tag: "OpenAgentTraceRoute" })),
    Match.when(`${OpenAgentTracePagePathname}/`, () => Option.some<PageRoute>({ _tag: "OpenAgentTraceRoute" })),
    Match.orElse(() => Option.none<PageRoute>())
  )

export const parsePathname = (pathname: string, search = ""): PageRoute =>
  Match.value(pathname).pipe(
    Match.when("/", () => homeRoute),
    Match.when("/index.html", () => homeRoute),
    Match.orElse((value) =>
      Option.match(
        Option.orElse(
          deepDiveRoute(value),
          () => Option.orElse(packageDocsRoute(value, search), () => openAgentTraceRoute(value))
        ),
        {
          onNone: () => homeRoute,
          onSome: (route) => route
        }
      )
    )
  )

export { packageDocsPagePath }
