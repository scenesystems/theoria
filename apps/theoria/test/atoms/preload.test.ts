import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Ref } from "effect"

import { preloadRouteKey, RoutePreloadMountAtom } from "../../app/web/atoms/surface/preload.js"
import { surfaceAtom } from "../../app/web/atoms/surface/state.js"
import { makeAppClientTestRuntime } from "../helpers/entry-client.test-layer.js"
import { effectTextCardFixture, programPreviewFixture, runDataFixture } from "../helpers/entry-fixtures.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

describe("Route preload mounting", () => {
  it.effect("mounts preload work from the route atom instead of render-time dispatch", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const calls = yield* Ref.make<ReadonlyArray<string>>([])
      const routePreloadMountAtom = RoutePreloadMountAtom.make(
        makeAppClientTestRuntime({
          preload: (id) =>
            Ref.update(calls, (entries) => [...entries, id]).pipe(
              Effect.as(programPreviewFixture)
            ),
          run: () => Effect.succeed(runDataFixture("unused")),
          runWithMeta: () =>
            Effect.succeed({
              data: runDataFixture("unused"),
              meta: { requestId: "req", buildSha: "build", durationMs: 1 }
            })
        })
      )

      const atom = routePreloadMountAtom.atom(preloadRouteKey({ _tag: "DeepRoute", entryId: effectTextCardFixture.id }))
      registry.mount(atom)
      registry.get(atom)

      const state = yield* Effect.eventually(
        Effect.sync(() => registry.get(surfaceAtom(effectTextCardFixture.id))).pipe(
          Effect.filterOrFail((surface) => surface.preload._tag === "PreloadReady", () => "waiting-for-preload")
        )
      )

      const preloadCalls = yield* Ref.get(calls)
      expect(preloadCalls).toEqual([effectTextCardFixture.id])
      expect(state.preload._tag).toBe("PreloadReady")
    }))

  it.effect("does not invent a package preload fetch for the workflow entry", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const calls = yield* Ref.make<ReadonlyArray<string>>([])
      const routePreloadMountAtom = RoutePreloadMountAtom.make(
        makeAppClientTestRuntime({
          preload: (id) =>
            Ref.update(calls, (entries) => [...entries, id]).pipe(
              Effect.as(programPreviewFixture)
            ),
          run: () => Effect.succeed(runDataFixture("unused")),
          runWithMeta: () =>
            Effect.succeed({
              data: runDataFixture("unused"),
              meta: { requestId: "req", buildSha: "build", durationMs: 1 }
            })
        })
      )

      const atom = routePreloadMountAtom.atom(preloadRouteKey({ _tag: "DeepRoute", entryId: "workflow" }))
      registry.mount(atom)
      registry.get(atom)

      expect(yield* Ref.get(calls)).toEqual([])
      expect(registry.get(surfaceAtom("workflow")).preload._tag).toBe("PreloadIdle")
    }))
})
