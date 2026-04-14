import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Equal, Match } from "effect"

import { workflowEntryId } from "../../../contracts/entry/id.js"
import { PageLocation } from "../../../contracts/presentation/page-location.js"
import { PageRoute, type SerializedPageRouteKey } from "../../../contracts/presentation/path.js"
import { workflowStudyDescriptor } from "../../../contracts/study/workflow/descriptor.js"
import type { SurfaceRuntimeServices } from "../../runtime/kernel/kind.js"
import { runtimeReleaseStage } from "../../runtime/release-stage.js"
import { initialSurfaceState } from "../../state/surface/state.js"

import type { RunRegistry } from "../run-registry-context.js"
import { appRuntime } from "../runtime.js"
import { preloadSurface, resetSurfaceEvidenceStore } from "./internal.js"
import { surfaceAtom } from "./state.js"

const workflowSurfaceStateForRoute = (route: Extract<PageRoute.Value, { readonly _tag: "WorkflowStudyRoute" }>) => ({
  ...initialSurfaceState(workflowEntryId),
  draft: {
    ...workflowStudyDescriptor.defaultDraft(),
    input: route.input,
    seedId: route.sessionId
  }
})

const hydrateRouteSurface = (
  route: PageRoute.Value,
  registry: RunRegistry
): Effect.Effect<void, never, never> =>
  Match.value(route).pipe(
    Match.tag(
      "WorkflowStudyRoute",
      (workflowRoute) =>
        Effect.sync(() => {
          const current = registry.get(surfaceAtom(workflowEntryId))

          if (
            current.draft.entryId === workflowEntryId &&
            current.draft.seedId === workflowRoute.sessionId &&
            Equal.equals(current.draft.input, workflowRoute.input)
          ) {
            return
          }

          registry.set(surfaceAtom(workflowEntryId), workflowSurfaceStateForRoute(workflowRoute))
          resetSurfaceEvidenceStore(registry, workflowEntryId)
        })
    ),
    Match.orElse(() => Effect.void)
  )

const prepareRoute = (
  route: PageRoute.Value,
  registry: RunRegistry
): Effect.Effect<void, never, SurfaceRuntimeServices> =>
  hydrateRouteSurface(route, registry).pipe(Effect.zipRight(preloadVisibleIds(route, registry)))

const preloadVisibleIds = (
  route: PageRoute.Value,
  registry: RunRegistry
): Effect.Effect<void, never, SurfaceRuntimeServices> =>
  Effect.forEach(
    route.visibleEntryIds(runtimeReleaseStage()),
    (id) => preloadSurface(id, registry),
    { concurrency: 1, discard: true }
  )

export const preloadRouteKey = (route: PageRoute.Value): string => route.path()

export const preloadForRouteAtom = appRuntime.fn<PageRoute.Value>()(
  (route, ctx) => prepareRoute(route, ctx.registry)
)

export class RoutePreloadMountAtom {
  static make(runtime: typeof appRuntime): RoutePreloadMountAtom {
    return new RoutePreloadMountAtom(
      Atom.family((key: SerializedPageRouteKey) => {
        const preloadAtom = runtime.atom(
          (get) => prepareRoute(PageRoute.fromLocation(PageLocation.fromUrl(key)), get.registry),
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
