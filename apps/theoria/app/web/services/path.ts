import type { PackageName } from "@theoria/source-proof/contracts"
import { Match, Option } from "effect"

import type { EntryId } from "../../contracts/entry/id.js"
import { entryIdForPath } from "../../contracts/entry/routing.js"
import {
  packageDocsPagePath,
  PackageDocsPagePathname,
  packageDocsQueryPackage
} from "../../contracts/presentation/package-docs.js"

export type PageRoute =
  | { readonly _tag: "HomeRoute" }
  | { readonly _tag: "DeepRoute"; readonly entryId: EntryId }
  | { readonly _tag: "PackageDocsRoute"; readonly packageId: PackageName | null }

const homeRoute: PageRoute = { _tag: "HomeRoute" }

const deepDiveRoute = (pathname: string): Option.Option<PageRoute> =>
  entryIdForPath(pathname).pipe(Option.map((entryId) => ({ _tag: "DeepRoute", entryId })))

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

export const parsePathname = (pathname: string, search = ""): PageRoute =>
  Match.value(pathname).pipe(
    Match.when("/", () => homeRoute),
    Match.when("/index.html", () => homeRoute),
    Match.orElse((value) =>
      Option.match(
        Option.orElse(deepDiveRoute(value), () => packageDocsRoute(value, search)),
        {
          onNone: () => homeRoute,
          onSome: (route) => route
        }
      )
    )
  )

export { packageDocsPagePath }
