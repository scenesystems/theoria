import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Match } from "effect"
import * as Arr from "effect/Array"

import { cardsForReleaseStage } from "../../contracts/card.js"
import { isPublishedConsumerId, type PublishedConsumerId } from "../../contracts/id.js"
import type { SurfaceRuntimeServices } from "../runtime/proving-consumer-shared.js"
import { runtimeReleaseStage } from "../runtime/release-stage.js"
import type { PageRoute } from "../services/path.js"

import { preloadSurface } from "./internal.js"
import type { RunRegistry } from "./run-registry-context.js"
import { appRuntime } from "./runtime.js"

const homeRoute: PageRoute = { _tag: "HomeRoute" }

type PreloadRouteKey = "home" | "docs" | "open-agent-trace" | `deep:${PublishedConsumerId}`

const deepPreloadRouteKey = (id: PublishedConsumerId): PreloadRouteKey => `deep:${id}`

const visibleIdsForRoute = (route: PageRoute): ReadonlyArray<PublishedConsumerId> =>
  route._tag === "HomeRoute"
    ? Arr.map(cardsForReleaseStage(runtimeReleaseStage()), (card) => card.id)
    : route._tag === "DeepRoute"
    ? [route.id]
    : []

const deepRoute = (id: PublishedConsumerId): PageRoute => ({ _tag: "DeepRoute", id })
const docsRoute: PageRoute = { _tag: "PackageDocsRoute", packageId: null }
const openAgentTraceRoute: PageRoute = { _tag: "OpenAgentTraceRoute" }

const preloadVisibleIds = (
  route: PageRoute,
  registry: RunRegistry
): Effect.Effect<void, never, SurfaceRuntimeServices> =>
  Effect.forEach(
    visibleIdsForRoute(route),
    (id) => preloadSurface(id, registry),
    { concurrency: 1, discard: true }
  )

const routeFromPreloadKey = (key: PreloadRouteKey): PageRoute =>
  Match.value(key).pipe(
    Match.when("home", () => homeRoute),
    Match.when("docs", () => docsRoute),
    Match.when("open-agent-trace", () => openAgentTraceRoute),
    Match.orElse((value) => {
      const rawId = value.slice(5)
      return isPublishedConsumerId(rawId) ? deepRoute(rawId) : homeRoute
    })
  )

export const preloadRouteKey = (route: PageRoute): PreloadRouteKey =>
  route._tag === "DeepRoute"
    ? deepPreloadRouteKey(route.id)
    : route._tag === "PackageDocsRoute"
    ? "docs"
    : route._tag === "OpenAgentTraceRoute"
    ? "open-agent-trace"
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
