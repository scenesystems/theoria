import { Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { Id } from "../../contracts/id.js"
import type { Id as DemoId } from "../../contracts/id.js"

export type PageRoute =
  | { readonly _tag: "HomeRoute" }
  | { readonly _tag: "DeepRoute"; readonly id: DemoId }

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

export const parsePathname = (pathname: string): PageRoute =>
  Match.value(pathname).pipe(
    Match.when("/", () => homeRoute),
    Match.when("/index.html", () => homeRoute),
    Match.orElse((value) =>
      Option.match(deepDiveRoute(value), {
        onNone: () => homeRoute,
        onSome: (route) => route
      })
    )
  )
