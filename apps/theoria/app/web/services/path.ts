import { Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

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
import { Id } from "../../contracts/id.js"
import type { Id as DemoId } from "../../contracts/id.js"

export type PageRoute =
  | { readonly _tag: "HomeRoute" }
  | { readonly _tag: "DeepRoute"; readonly id: DemoId }
  | DocsRoute

const homeRoute: PageRoute = { _tag: "HomeRoute" }

const isKnownDemoId = Schema.is(Id)
const isDocsPackageSlug = Schema.is(DocsPackageSlug)
const isDocsGuideSlug = Schema.is(DocsGuideSlug)
const isDocsModuleSlug = Schema.is(DocsModuleSlug)
const deepDivePattern = /^\/demos\/([^/]+)\/?$/u
const docsApiPattern = /^\/docs\/([^/]+)\/api(?:\/([^/]+(?:\/[^/]+)*))?\/?$/u
const docsGuidePattern = /^\/docs\/([^/]+)\/([^/]+)\/?$/u
const docsOverviewPattern = /^\/docs\/([^/]+)\/?$/u

const packageCapture = (matches: RegExpExecArray): Option.Option<DocsPackageSlug> =>
  Arr.get(matches, 1).pipe(Option.filter(isDocsPackageSlug))

const docsApiPageRoute = (pathname: string): Option.Option<PageRoute> =>
  Option.fromNullable(docsApiPattern.exec(pathname)).pipe(
    Option.flatMap((matches) => {
      const moduleSlug = matches[2] ?? null
      return packageCapture(matches).pipe(
        Option.filter(() => moduleSlug === null || isDocsModuleSlug(moduleSlug)),
        Option.map((packageSlug) => docsApiRoute(packageSlug, moduleSlug))
      )
    })
  )

const docsGuidePageRoute = (pathname: string): Option.Option<PageRoute> =>
  Option.fromNullable(docsGuidePattern.exec(pathname)).pipe(
    Option.flatMap((matches) =>
      Option.all({
        guideSlug: Arr.get(matches, 2).pipe(Option.filter(isDocsGuideSlug)),
        packageSlug: packageCapture(matches)
      })
    ),
    Option.map(({ guideSlug, packageSlug }) => docsGuideRoute(packageSlug, guideSlug))
  )

const docsOverviewPageRoute = (pathname: string): Option.Option<PageRoute> =>
  Option.fromNullable(docsOverviewPattern.exec(pathname)).pipe(
    Option.flatMap((matches) => packageCapture(matches)),
    Option.map(docsOverviewRoute)
  )

const docsPageRoute = (pathname: string): Option.Option<PageRoute> =>
  (pathname === "/docs" || pathname === "/docs/"
    ? Option.some<PageRoute>(docsIndexRoute())
    : Option.none<PageRoute>()).pipe(
      Option.orElse(() => docsApiPageRoute(pathname)),
      Option.orElse(() => docsGuidePageRoute(pathname)),
      Option.orElse(() => docsOverviewPageRoute(pathname)),
      Option.orElse(() =>
        pathname.startsWith("/docs/")
          ? Option.some<PageRoute>(docsNotFoundRoute())
          : Option.none<PageRoute>()
      )
    )

const deepDiveRoute = (pathname: string): Option.Option<PageRoute> =>
  Option.fromNullable(deepDivePattern.exec(pathname)).pipe(
    Option.flatMap((matches) => Arr.get(matches, 1)),
    Option.flatMap((id) =>
      isKnownDemoId(id)
        ? Option.some<PageRoute>({ _tag: "DeepRoute", id })
        : Option.none<PageRoute>()
    )
  )

export const isPagePath = (pathname: string): boolean =>
  pathname === "/"
  || pathname === "/index.html"
  || pathname === "/docs"
  || pathname.startsWith("/docs/")
  || Option.isSome(deepDiveRoute(pathname))

export const pagePathFor = (route: PageRoute): string =>
  Match.value(route).pipe(
    Match.tag("HomeRoute", () => "/"),
    Match.tag("DeepRoute", ({ id }) => `/demos/${id}`),
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
    Match.orElse((value) =>
      docsPageRoute(value).pipe(
        Option.orElse(() => deepDiveRoute(value)),
        Option.getOrElse(() => homeRoute)
      )
    )
  )
