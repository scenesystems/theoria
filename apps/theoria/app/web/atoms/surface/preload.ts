import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Match } from "effect"
import * as Arr from "effect/Array"

import { type EntryId, isEntryId } from "../../../contracts/entry/id.js"
import { entryDescriptors } from "../../../contracts/entry/registry.js"
import { entryVisibleInReleaseStage } from "../../../contracts/entry/routing.js"
import type { SurfaceRuntimeServices } from "../../runtime/kernel/kind.js"
import { runtimeReleaseStage } from "../../runtime/release-stage.js"
import type { PageRoute } from "../../services/path.js"

import type { RunRegistry } from "../run-registry-context.js"
import { appRuntime } from "../runtime.js"
import { preloadSurface } from "./internal.js"

const homeRoute: PageRoute = { _tag: "HomeRoute" }

type PreloadRouteKey = "home" | "docs" | `deep:${EntryId}`

const deepPreloadRouteKey = (entryId: EntryId): PreloadRouteKey => `deep:${entryId}`

const visibleIdsForRoute = (route: PageRoute): ReadonlyArray<EntryId> =>
  route._tag === "HomeRoute"
    ? Arr.map(
      Arr.filter(entryDescriptors, (descriptor) => entryVisibleInReleaseStage(descriptor, runtimeReleaseStage())),
      (descriptor) => descriptor.entryId
    )
    : route._tag === "DeepRoute"
    ? [route.entryId]
    : []

const deepRoute = (entryId: EntryId): PageRoute => ({ _tag: "DeepRoute", entryId })
const docsRoute: PageRoute = { _tag: "PackageDocsRoute", packageId: null }

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
    Match.orElse((value) => {
      const rawEntryId = value.slice(5)
      return isEntryId(rawEntryId) ? deepRoute(rawEntryId) : homeRoute
    })
  )

export const preloadRouteKey = (route: PageRoute): PreloadRouteKey =>
  route._tag === "DeepRoute"
    ? deepPreloadRouteKey(route.entryId)
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
