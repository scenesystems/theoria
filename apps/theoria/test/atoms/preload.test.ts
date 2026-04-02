import { Atom, Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Ref } from "effect"

import { makeRoutePreloadMountAtom, preloadRouteKey } from "../../app/web/atoms/preload.js"
import { surfaceAtom } from "../../app/web/atoms/surface.js"
import { DemoClient } from "../../app/web/services/DemoClient.js"
import { effectTextCardFixture, programPreviewFixture, runDataFixture } from "../helpers/demo-fixtures.js"

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
      const routePreloadMountAtom = makeRoutePreloadMountAtom(
        Atom.runtime(
          Layer.succeed(
            DemoClient,
            DemoClient.make({
              preload: (id) =>
                Ref.update(calls, (entries) => [...entries, id]).pipe(
                  Effect.as(programPreviewFixture)
                ),
              run: () => Effect.succeed(runDataFixture("unused")),
              runWithMeta: () =>
                Effect.succeed({
                  data: runDataFixture("unused"),
                  meta: { requestId: "req", buildSha: "build", durationMs: 1 }
                }),
              streamUrl: (id) => `/api/demos/${id}/stream`,
              versions: () => Effect.succeed({})
            })
          )
        )
      )

      const atom = routePreloadMountAtom(preloadRouteKey({ _tag: "DeepRoute", id: effectTextCardFixture.id }))
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
})
