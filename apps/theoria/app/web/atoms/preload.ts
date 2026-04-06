import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Match, Schema } from "effect"
import * as Arr from "effect/Array"

import { cardsForReleaseStage } from "../../contracts/card.js"
import { Id } from "../../contracts/id.js"
import type { Id as IdType } from "../../contracts/id.js"
import { runtimeReleaseStage } from "../runtime/release-stage.js"
import type { DemoClient } from "../services/DemoClient.js"
import type { PageRoute } from "../services/path.js"

import { preloadSurface } from "./internal.js"
import type { RunRegistry } from "./run-registry-context.js"
import { appRuntime } from "./runtime.js"

const homeRoute: PageRoute = { _tag: "HomeRoute" }
const isId = Schema.is(Id)

type PreloadRouteKey = "home" | "docs" | `deep:${IdType}`

const visibleIdsForRoute = (route: PageRoute): ReadonlyArray<IdType> =>
  route._tag === "HomeRoute"
    ? Arr.map(cardsForReleaseStage(runtimeReleaseStage()), (card) => card.id)
    : route._tag === "DeepRoute"
    ? [route.id]
    : []

const deepRoute = (id: IdType): PageRoute => ({ _tag: "DeepRoute", id })
const docsRoute: PageRoute = { _tag: "PackageDocsRoute", packageId: null }

const preloadVisibleIds = (
  route: PageRoute,
  registry: RunRegistry
): Effect.Effect<void, never, DemoClient> =>
  Effect.forEach(
    visibleIdsForRoute(route),
    (id) => preloadSurface(id, registry),
    { concurrency: 1, discard: true }
  )

const routeFromPreloadKey = (key: PreloadRouteKey): PageRoute =>
  Match.value(key).pipe(
    Match.when("home", () => homeRoute),
    Match.when("docs", () => docsRoute),
    Match.orElse((value) => {
      const rawId = value.slice(5)
      return isId(rawId) ? deepRoute(rawId) : homeRoute
    })
  )

export const preloadRouteKey = (route: PageRoute): PreloadRouteKey =>
  route._tag === "DeepRoute"
    ? `deep:${route.id}`
    : route._tag === "PackageDocsRoute"
    ? "docs"
    : "home"

export const preloadForRouteAtom = appRuntime.fn<PageRoute>()(
  (route, ctx) => preloadVisibleIds(route, ctx.registry)
)

export const makeRoutePreloadMountAtom = (runtime: typeof appRuntime) =>
  Atom.family((key: PreloadRouteKey) => {
    const preloadAtom = runtime.atom((get) => preloadVisibleIds(routeFromPreloadKey(key), get.registry), {
      initialValue: undefined
    })

    return Atom.make((get: AtomType.Context) => {
      get(preloadAtom)
      return null
    })
  })

export const routePreloadMountAtom = makeRoutePreloadMountAtom(appRuntime)
