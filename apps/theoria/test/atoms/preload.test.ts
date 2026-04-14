import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Ref } from "effect"

import { WorkflowHandoffDraft } from "../../app/contracts/presentation/interactions.js"
import { EntryRoute, PackageDocsRoute, WorkflowStudyRoute } from "../../app/contracts/presentation/path.js"
import { defaultWorkflowSeedId } from "../../app/contracts/study/workflow/catalog-policy.js"
import { workflowStudyDescriptor } from "../../app/contracts/study/workflow/descriptor.js"
import { renderSensitiveWorkflowSessionId } from "../../app/contracts/study/workflow/fixture-manifest.js"
import { WorkflowStudyInput } from "../../app/contracts/study/workflow/input.js"
import { preloadRouteKey, RoutePreloadMountAtom } from "../../app/web/atoms/surface/preload.js"
import { surfaceAtom } from "../../app/web/atoms/surface/state.js"
import { makeAppClientTestRuntime } from "../helpers/entry-client.test-layer.js"
import { programPreviewFixture, runDataFixture } from "../helpers/entry-fixtures.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

const workflowHandoffDraftFixture = WorkflowHandoffDraft.make({
  annotationIds: ["annotation:trace:item:note"],
  objectiveIds: ["objective:trace:item"],
  selection: null,
  status: "ready",
  summary: "Carry the selected failure into workflow design.",
  transcriptEntryId: "trace:entry",
  title: "Trace-grounded workflow handoff"
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

      const atom = routePreloadMountAtom.atom(preloadRouteKey(EntryRoute.fromEntryId("workflow")))
      registry.mount(atom)
      registry.get(atom)

      const state = yield* Effect.eventually(
        Effect.sync(() => registry.get(surfaceAtom("workflow"))).pipe(
          Effect.filterOrFail((surface) => surface.preload._tag === "PreloadReady", () => "waiting-for-preload")
        )
      )

      const preloadCalls = yield* Ref.get(calls)
      expect(preloadCalls).toEqual(["workflow"])
      expect(state.preload._tag).toBe("PreloadReady")
    }))

  it.effect("does not invent an entry preload fetch while mounting package docs routes", () =>
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

      const atom = routePreloadMountAtom.atom(preloadRouteKey(PackageDocsRoute.fromSelectedPackageId(null)))
      registry.mount(atom)
      registry.get(atom)

      expect(yield* Ref.get(calls)).toEqual([])
      expect(registry.get(surfaceAtom("workflow")).preload._tag).toBe("PreloadIdle")
    }))

  it.effect("hydrates the workflow surface seed and input from a workflow study route before preloading", () =>
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

      registry.set(surfaceAtom("workflow"), {
        ...registry.get(surfaceAtom("workflow")),
        draft: {
          ...workflowStudyDescriptor.defaultDraft(),
          seedId: renderSensitiveWorkflowSessionId
        },
        preload: { _tag: "PreloadReady", data: programPreviewFixture }
      })

      const atom = routePreloadMountAtom.atom(
        preloadRouteKey(
          WorkflowStudyRoute.fromSessionId(
            defaultWorkflowSeedId,
            WorkflowStudyInput.withHandoff(workflowHandoffDraftFixture)
          )
        )
      )
      registry.mount(atom)
      registry.get(atom)

      const state = yield* Effect.eventually(
        Effect.sync(() => registry.get(surfaceAtom("workflow"))).pipe(
          Effect.filterOrFail((surface) => surface.preload._tag === "PreloadReady", () => "waiting-for-session-preload")
        )
      )

      const preloadCalls = yield* Ref.get(calls)
      expect(preloadCalls).toEqual(["workflow"])
      expect(state.draft.seedId).toBe(defaultWorkflowSeedId)
      expect(state.draft.input.handoff).toEqual(workflowHandoffDraftFixture)
      expect(state.preload._tag).toBe("PreloadReady")
    }))
})
