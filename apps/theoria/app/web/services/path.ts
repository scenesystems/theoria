import { Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import {
  docsApiRoute,
  docsGettingStartedRoute,
  docsOverviewRoute,
  DocsPackageSlug,
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
const deepDivePattern = /^\/demos\/([^/]+)\/?$/u
const docsApiPattern = /^\/docs\/([^/]+)\/api(?:\/([^/]+))?\/?$/u
const docsGettingStartedPattern = /^\/docs\/([^/]+)\/getting-started\/?$/u
const docsOverviewPattern = /^\/docs\/([^/]+)\/?$/u

const packageCapture = (matches: RegExpExecArray): Option.Option<DocsPackageSlug> =>
  Arr.get(matches, 1).pipe(Option.filter(isDocsPackageSlug))

const docsApiPageRoute = (pathname: string): Option.Option<PageRoute> =>
  Option.fromNullable(docsApiPattern.exec(pathname)).pipe(
    Option.flatMap((matches) =>
      packageCapture(matches).pipe(
        Option.map((packageSlug) => docsApiRoute(packageSlug, matches[2] ?? null))
      )
    )
  )

const docsGettingStartedPageRoute = (pathname: string): Option.Option<PageRoute> =>
  Option.fromNullable(docsGettingStartedPattern.exec(pathname)).pipe(
    Option.flatMap((matches) => packageCapture(matches)),
    Option.map(docsGettingStartedRoute)
  )

const docsOverviewPageRoute = (pathname: string): Option.Option<PageRoute> =>
  Option.fromNullable(docsOverviewPattern.exec(pathname)).pipe(
    Option.flatMap((matches) => packageCapture(matches)),
    Option.map(docsOverviewRoute)
  )

const docsPageRoute = (pathname: string): Option.Option<PageRoute> =>
  (pathname === "/docs" || pathname === "/docs/"
    ? Option.some<PageRoute>(docsOverviewRoute("effect-search"))
    : Option.none<PageRoute>()).pipe(
      Option.orElse(() => docsApiPageRoute(pathname)),
      Option.orElse(() => docsGettingStartedPageRoute(pathname)),
      Option.orElse(() => docsOverviewPageRoute(pathname))
    )

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
