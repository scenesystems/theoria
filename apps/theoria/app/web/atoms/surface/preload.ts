import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect } from "effect"

import type { PageRoute } from "../../../contracts/presentation/path.js"
import { PageRouteKey, type SerializedPageRouteKey } from "../../../contracts/presentation/path.js"
import type { SurfaceRuntimeServices } from "../../runtime/kernel/kind.js"
import { runtimeReleaseStage } from "../../runtime/release-stage.js"

import type { RunRegistry } from "../run-registry-context.js"
import { appRuntime } from "../runtime.js"
import { preloadSurface } from "./internal.js"

const preloadVisibleIds = (
  route: PageRoute.Value,
  registry: RunRegistry
): Effect.Effect<void, never, SurfaceRuntimeServices> =>
  Effect.forEach(
    route.visibleEntryIds(runtimeReleaseStage()),
    (id) => preloadSurface(id, registry),
    { concurrency: 1, discard: true }
  )

export const preloadRouteKey = (route: PageRoute.Value): SerializedPageRouteKey => route.key().serialize()

export const preloadForRouteAtom = appRuntime.fn<PageRoute.Value>()(
  (route, ctx) => preloadVisibleIds(route, ctx.registry)
)

export class RoutePreloadMountAtom {
  static make(runtime: typeof appRuntime): RoutePreloadMountAtom {
    return new RoutePreloadMountAtom(
      Atom.family((key: SerializedPageRouteKey) => {
        const preloadAtom = runtime.atom(
          (get) => preloadVisibleIds(PageRouteKey.fromSerialized(key).route(), get.registry),
          {
            initialValue: undefined
          }
        )

        return Atom.make((get: AtomType.Context) => {
          get(preloadAtom)
          return null
        })
      })
    )
  }

  private constructor(
    readonly atom: (key: SerializedPageRouteKey) => AtomType.Atom<null>
  ) {}
}

export const routePreloadMountAtom = RoutePreloadMountAtom.make(appRuntime)
