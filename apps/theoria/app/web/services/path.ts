import type { PackageName } from "@theoria/source-proof/contracts"
import { Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { Id } from "../../contracts/id.js"
import type { Id as DemoId } from "../../contracts/id.js"
import { packageDocsPagePath, PackageDocsPagePathname, packageDocsQueryPackage } from "../../contracts/package-docs.js"

export type PageRoute =
  | { readonly _tag: "HomeRoute" }
  | { readonly _tag: "DeepRoute"; readonly id: DemoId }
  | { readonly _tag: "PackageDocsRoute"; readonly packageId: PackageName | null }

const homeRoute: PageRoute = { _tag: "HomeRoute" }

const isKnownDemoId = Schema.is(Id)
const deepDivePattern = /^\/demos\/([^/]+)\/?$/u

const deepDiveRoute = (pathname: string): Option.Option<PageRoute> =>
  Option.fromNullable(deepDivePattern.exec(pathname)).pipe(
    Option.flatMap((matches) => Arr.get(matches, 1)),
    Option.flatMap((id) =>
      isKnownDemoId(id)
        ? Option.some<PageRoute>({
          _tag: "DeepRoute",
          id
        })
        : Option.none<PageRoute>()
    )
  )

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
      Option.match(Option.orElse(deepDiveRoute(value), () => packageDocsRoute(value, search)), {
        onNone: () => homeRoute,
        onSome: (route) => route
      })
    )
  )

export { packageDocsPagePath }
