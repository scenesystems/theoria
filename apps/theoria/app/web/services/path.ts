import { Boolean as Bool, Equal, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import {
  docsApiRoute,
  docsGuideRoute,
  DocsGuideSlug,
  docsIndexRoute,
  DocsModuleSlug,
  docsNotFoundRoute,
  docsOverviewRoute,
  DocsPackageSlug,
  docsPathFor,
  type DocsRoute
} from "../../contracts/docs.js"

export type PageRoute =
  | { readonly _tag: "HomeRoute" }
  | DocsRoute

const homeRoute: PageRoute = { _tag: "HomeRoute" }

const isDocsPackageSlug = Schema.is(DocsPackageSlug)
const isDocsGuideSlug = Schema.is(DocsGuideSlug)
const isDocsModuleSlug = Schema.is(DocsModuleSlug)
const docsApiPattern = /^\/docs\/([^/]+)\/api(?:\/([^/]+(?:\/[^/]+)*))?\/?$/u
const docsGuidePattern = /^\/docs\/([^/]+)\/([^/]+)\/?$/u
const docsOverviewPattern = /^\/docs\/([^/]+)\/?$/u

const packageCapture = (matches: ReadonlyArray<string>): Option.Option<DocsPackageSlug> =>
  Arr.get(matches, 1).pipe(Option.filter(isDocsPackageSlug))

const docsApiPageRoute = (pathname: string): Option.Option<PageRoute> =>
  Str.match(docsApiPattern)(pathname).pipe(
    Option.flatMap((matches) => {
      const moduleSlug = Arr.get(matches, 2).pipe(Option.flatMap(Option.fromNullable))
      return packageCapture(matches).pipe(
        Option.filter(() => Bool.or(Option.isNone(moduleSlug), Option.exists(moduleSlug, isDocsModuleSlug))),
        Option.map((packageSlug) => docsApiRoute(packageSlug, moduleSlug))
      )
    })
  )

const docsGuidePageRoute = (pathname: string): Option.Option<PageRoute> =>
  Str.match(docsGuidePattern)(pathname).pipe(
    Option.flatMap((matches) =>
      Option.all({
        guideSlug: Arr.get(matches, 2).pipe(Option.filter(isDocsGuideSlug)),
        packageSlug: packageCapture(matches)
      })
    ),
    Option.map(({ guideSlug, packageSlug }) => docsGuideRoute(packageSlug, guideSlug))
  )

const docsOverviewPageRoute = (pathname: string): Option.Option<PageRoute> =>
  Str.match(docsOverviewPattern)(pathname).pipe(
    Option.flatMap((matches) => packageCapture(matches)),
    Option.map(docsOverviewRoute)
  )

const docsPageRoute = (pathname: string): Option.Option<PageRoute> =>
  Bool.match(Bool.or(Equal.equals(pathname, "/docs"), Equal.equals(pathname, "/docs/")), {
    onTrue: () => Option.some<PageRoute>(docsIndexRoute()),
    onFalse: () => Option.none<PageRoute>()
  }).pipe(
    Option.orElse(() => docsApiPageRoute(pathname)),
    Option.orElse(() => docsGuidePageRoute(pathname)),
    Option.orElse(() => docsOverviewPageRoute(pathname)),
    Option.orElse(() =>
      Bool.match(Str.startsWith("/docs/")(pathname), {
        onTrue: () => Option.some<PageRoute>(docsNotFoundRoute()),
        onFalse: () => Option.none<PageRoute>()
      })
    )
  )

export const isPagePath = (pathname: string): boolean =>
  Bool.some([
    Equal.equals(pathname, "/"),
    Equal.equals(pathname, "/index.html"),
    Equal.equals(pathname, "/docs"),
    Str.startsWith("/docs/")(pathname)
  ])

export const pagePathFor = (route: PageRoute): string =>
  Match.value(route).pipe(
    Match.tag("HomeRoute", () => "/"),
    Match.tag("DocsIndexRoute", docsPathFor),
    Match.tag("DocsOverviewRoute", docsPathFor),
    Match.tag("DocsGuideRoute", docsPathFor),
    Match.tag("DocsApiRoute", docsPathFor),
    Match.tag("DocsNotFoundRoute", docsPathFor),
    Match.exhaustive
  )

export const parsePathname = (pathname: string): PageRoute =>
  Match.value(pathname).pipe(
    Match.when("/", () => homeRoute),
    Match.when("/index.html", () => homeRoute),
    Match.orElse((value) => Option.getOrElse(docsPageRoute(value), () => homeRoute))
  )
