import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect } from "effect"

import {
  type PageRoute,
  pageRouteForSerializedKey,
  pageRouteKey,
  type SerializedPageRouteKey,
  serializePageRouteKey,
  visibleEntryIdsForPageRoute
} from "../../../contracts/presentation/path.js"
import type { SurfaceRuntimeServices } from "../../runtime/kernel/kind.js"
import { runtimeReleaseStage } from "../../runtime/release-stage.js"

import type { RunRegistry } from "../run-registry-context.js"
import { appRuntime } from "../runtime.js"
import { preloadSurface } from "./internal.js"

const preloadVisibleIds = (
  route: PageRoute,
  registry: RunRegistry
): Effect.Effect<void, never, SurfaceRuntimeServices> =>
  Effect.forEach(
    visibleEntryIdsForPageRoute(route, runtimeReleaseStage()),
    (id) => preloadSurface(id, registry),
    { concurrency: 1, discard: true }
  )

export const preloadRouteKey = (route: PageRoute): SerializedPageRouteKey => serializePageRouteKey(pageRouteKey(route))

export const preloadForRouteAtom = appRuntime.fn<PageRoute>()(
  (route, ctx) => preloadVisibleIds(route, ctx.registry)
)

const makeRoutePreloadMountFamily = (runtime: typeof appRuntime) =>
  Atom.family((key: SerializedPageRouteKey) => {
    const preloadAtom = runtime.atom((get) => preloadVisibleIds(pageRouteForSerializedKey(key), get.registry), {
      initialValue: undefined
    })

    return Atom.make((get: AtomType.Context) => {
      get(preloadAtom)
      return null
    })
  })

export class RoutePreloadMountAtom {
  static make(runtime: typeof appRuntime): RoutePreloadMountAtom {
    return new RoutePreloadMountAtom(makeRoutePreloadMountFamily(runtime))
  }

  private constructor(
    readonly atom: (key: SerializedPageRouteKey) => AtomType.Atom<null>
  ) {}
}

export const routePreloadMountAtom = RoutePreloadMountAtom.make(appRuntime)
