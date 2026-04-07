import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { isWorkflowComparisonSurfaceRunPlan } from "../../app/contracts/run-plan.js"
import { makeRunControlAtom } from "../../app/web/atoms/actions.js"
import { surfaceAtom } from "../../app/web/atoms/surface.js"
import { workflowComparisonSurfaceViewModelAtom } from "../../app/web/atoms/workflow-comparison-surface.js"
import {
  selectWorkflowComparisonComparisonModeAtom,
  selectWorkflowComparisonOptimizeAtom,
  selectWorkflowComparisonRuntimeProfileAtom,
  selectWorkflowComparisonSurfaceProfileAtom,
  workflowComparisonDraftRunPlanAtom,
  workflowComparisonSelectionAtom
} from "../../app/web/atoms/workflow-comparison.js"
import type { SurfaceState } from "../../app/web/state/types.js"
import { makeAppClientTestRuntime } from "../helpers/demo-client.test-layer.js"
import { errorFixture, programPreviewFixture } from "../helpers/demo-fixtures.js"
import { emitWorkflowComparisonAuthoredStream } from "../helpers/mock-workflow-comparison-stream.js"

import type { WorkflowComparisonId } from "../../app/contracts/workflow/comparison.js"

type EventListener = (event: Event | MessageEvent<string>) => void

class MockEventSource {
  static instances: ReadonlyArray<MockEventSource> = []

  readonly listeners: Record<string, ReadonlyArray<EventListener>> = {}
  readonly url: string
  closed = false

  constructor(url: string) {
    this.url = url
    MockEventSource.instances = [...MockEventSource.instances, this]
  }

  addEventListener(type: string, listener: EventListener): void {
    this.listeners[type] = [...(this.listeners[type] ?? []), listener]
  }

  close(): void {
    this.closed = true
  }

  emitEvidence(data: string): void {
    ;(this.listeners.evidence ?? []).forEach((listener) => listener(new MessageEvent("evidence", { data })))
  }
}

const makeAsyncTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      queueMicrotask(f)
    }
  })

const makeRuntime = () =>
  makeAppClientTestRuntime({
    run: () => Effect.fail(errorFixture),
    runWithMeta: () => Effect.fail(errorFixture),
    preload: () => Effect.succeed(programPreviewFixture),
    streamUrl: (id) => `/api/demos/${id}/stream`
  })

const readSurface = (registry: Registry.Registry): SurfaceState => registry.get(surfaceAtom("workflow-comparison"))

const waitForSource = (index: number) =>
  Effect.eventually(
    Effect.sync(() => Option.fromNullable(MockEventSource.instances[index])).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.fail(`waiting-for-source-${index}`),
          onSome: Effect.succeed
        })
      )
    )
  )

const withMockEventSource = <A>(effect: Effect.Effect<A, never, never>): Effect.Effect<A, never, never> => {
  const previousEventSource = globalThis.EventSource

  return Effect.gen(function*() {
    yield* Effect.sync(() => {
      MockEventSource.instances = []
      Reflect.set(globalThis, "EventSource", MockEventSource)
    })

    return yield* effect
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        MockEventSource.instances = []
        Reflect.set(globalThis, "EventSource", previousEventSource)
      })
    )
  )
}

const workflowManifestCases: ReadonlyArray<{
  readonly comparisonId: WorkflowComparisonId
  readonly label: string
}> = [
  { comparisonId: "workflow-comparison/task-briefing", label: "Task Briefing" },
  { comparisonId: "workflow-comparison/chat-handoff", label: "Chat Handoff" },
  { comparisonId: "workflow-comparison/retrieval-required", label: "Retrieval Required" },
  { comparisonId: "workflow-comparison/render-sensitive", label: "Render Sensitive" }
]

describe("workflow-comparison browser proof", () => {
  it.live("preserves frozen manifest identity across interruption and picks up the new scenario only after reset and replay", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeAsyncTestRegistry()
        const runtime = makeRuntime()
        const runControlAtom = makeRunControlAtom(runtime)

        registry.mount(runControlAtom)
        registry.set(workflowComparisonSelectionAtom, "workflow-comparison/task-briefing")
        registry.set(runControlAtom, { action: "run", id: "workflow-comparison" })

        const firstSource = yield* waitForSource(0)
        expect(firstSource.url).toContain("comparisonId=workflow-comparison%2Ftask-briefing")

        registry.set(workflowComparisonSelectionAtom, "workflow-comparison/render-sensitive")
        registry.set(runControlAtom, { action: "stop", id: "workflow-comparison" })

        const stopped = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry)).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunIdle", () => "waiting-for-workflow-comparison-stop")
          )
        )
        const stoppedViewModel = registry.get(workflowComparisonSurfaceViewModelAtom)

        expect(stopped.run._tag).toBe("RunIdle")
        expect(firstSource.closed).toBe(true)
        expect(stoppedViewModel.selection.label).toBe("Task Briefing")
        expect(stoppedViewModel.selectionLocked).toBe(true)
        const stoppedRunPlan = yield* Effect.sync(() => stopped.run.session.runPlan).pipe(
          Effect.flatMap((runPlan) =>
            isWorkflowComparisonSurfaceRunPlan(runPlan)
              ? Effect.succeed(runPlan)
              : Effect.dieMessage("expected workflow-comparison run plan to remain frozen after stop")
          )
        )

        expect(stoppedRunPlan.comparisonId).toBe("workflow-comparison/task-briefing")

        registry.set(runControlAtom, { action: "reset", id: "workflow-comparison" })
        expect(registry.get(workflowComparisonSurfaceViewModelAtom).selection.label).toBe("Render Sensitive")

        registry.set(runControlAtom, { action: "run", id: "workflow-comparison" })

        const secondSource = yield* waitForSource(1)
        expect(secondSource.url).toContain("comparisonId=workflow-comparison%2Frender-sensitive")
      })
    ))

  it.live("runs all published workflow manifests through the same published-consumer stream lane", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeAsyncTestRegistry()
        const runtime = makeRuntime()
        const runControlAtom = makeRunControlAtom(runtime)

        registry.mount(runControlAtom)

        yield* Effect.forEach(
          workflowManifestCases,
          ({ comparisonId, label }, index) =>
            Effect.gen(function*() {
              registry.set(workflowComparisonSelectionAtom, comparisonId)
              yield* Effect.eventually(
                Effect.sync(() => registry.get(workflowComparisonDraftRunPlanAtom)).pipe(
                  Effect.filterOrFail(
                    (draftPlan) => draftPlan.comparisonId === comparisonId,
                    () => `waiting-for-${comparisonId}-draft-plan`
                  )
                )
              )
              registry.set(runControlAtom, { action: "run", id: "workflow-comparison" })

              const source = yield* waitForSource(index)

              expect(source.url.startsWith("/api/workflow-comparison/stream?")).toBe(true)
              expect(source.url).toContain(`comparisonId=${encodeURIComponent(comparisonId)}`)

              yield* emitWorkflowComparisonAuthoredStream({
                comparisonId,
                meta: {
                  requestId: `workflow-comparison-${index}`,
                  buildSha: `build-workflow-comparison-${index}`,
                  durationMs: index + 17
                },
                source,
                summary: `${label} browser reuse proof.`
              })

              const succeeded = yield* Effect.eventually(
                Effect.sync(() => readSurface(registry)).pipe(
                  Effect.filterOrFail(
                    (state) => state.run._tag === "RunSuccess",
                    () => `waiting-for-${comparisonId}-success`
                  )
                )
              )

              const runPlan = yield* Effect.sync(() => succeeded.run.session.runPlan).pipe(
                Effect.flatMap((plan) =>
                  isWorkflowComparisonSurfaceRunPlan(plan)
                    ? Effect.succeed(plan)
                    : Effect.dieMessage("expected workflow-comparison run plan after success")
                )
              )

              expect(runPlan.comparisonId).toBe(comparisonId)
              expect(registry.get(workflowComparisonSurfaceViewModelAtom).selection.label).toBe(label)

              registry.set(runControlAtom, { action: "reset", id: "workflow-comparison" })
              yield* Effect.eventually(
                Effect.sync(() => readSurface(registry)).pipe(
                  Effect.filterOrFail(
                    (state) => state.run.session.runPlan === null,
                    () => `waiting-for-${comparisonId}-reset`
                  )
                )
              )
            }),
          { discard: true }
        )
      })
    ))

  it.live("projects baseline, authored optimized, and search-winner browser surfaces from one shared run ledger", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeAsyncTestRegistry()
        const runtime = makeRuntime()
        const runControlAtom = makeRunControlAtom(runtime)

        registry.mount(runControlAtom)
        registry.set(workflowComparisonSelectionAtom, "workflow-comparison/chat-handoff")
        registry.set(runControlAtom, { action: "run", id: "workflow-comparison" })

        const source = yield* waitForSource(0)

        yield* emitWorkflowComparisonAuthoredStream({
          comparisonId: "workflow-comparison/chat-handoff",
          meta: {
            requestId: "workflow-comparison-proof",
            buildSha: "build-workflow-comparison-proof",
            durationMs: 23
          },
          source,
          summary: "Workflow comparison browser proof."
        })

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry)).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunSuccess",
              () => "waiting-for-workflow-comparison-success"
            )
          )
        )

        const viewModel = registry.get(workflowComparisonSurfaceViewModelAtom)

        expect(viewModel.phaseLabel).toBe("Succeeded")
        expect(viewModel.selection.label).toBe("Chat Handoff")
        expect(viewModel.graph.cards[0]?.score).toBe("0.620")
        expect(viewModel.graph.cards[1]?.score).toBe("0.840")
        expect(viewModel.graph.cards[2]?.score).toBe("0.910")
        expect(viewModel.graph.cards[2]?.detail).toContain("instruction-profile=stepwise")
        expect(viewModel.transcript.entries.map((entry) => entry.nodeId)).toEqual(["reply", "reply", "render-check"])
        expect(viewModel.renderedPreview.panes[1]?.body).toContain("Search winner chat handoff")
        expect(viewModel.renderedPreview.panes[1]?.body).not.toContain("Render check")
        expect(viewModel.renderedPreview.panes[1]?.note).toContain("reply")
        expect(viewModel.renderedPreview.metrics[3]?.value).toBe("+0.290")
        expect(viewModel.renderedPreview.metrics[4]?.value).toBe("+0.070")
      })
    ))

  it.live("freezes bounded workflow controls into an authored-optimized run plan when optimization is disabled", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeAsyncTestRegistry()
        const runtime = makeRuntime()
        const runControlAtom = makeRunControlAtom(runtime)

        registry.mount(runControlAtom)
        registry.set(workflowComparisonSelectionAtom, "workflow-comparison/chat-handoff")
        registry.set(selectWorkflowComparisonComparisonModeAtom, "search-winner")
        registry.set(selectWorkflowComparisonOptimizeAtom, false)
        registry.set(selectWorkflowComparisonRuntimeProfileAtom, "preferred")
        registry.set(selectWorkflowComparisonSurfaceProfileAtom, "full-panel")

        const draftPlan = registry.get(workflowComparisonDraftRunPlanAtom)

        expect(draftPlan.optimize).toBe(false)
        expect(draftPlan.comparisonMode).toBe("authored-optimized")
        expect(draftPlan.runtimeProfile).toBe("preferred")
        expect(draftPlan.surfaceProfile).toBe("full-panel")

        registry.set(runControlAtom, { action: "run", id: "workflow-comparison" })

        const source = yield* waitForSource(0)

        expect(source.url).toContain("comparisonId=workflow-comparison%2Fchat-handoff")
        expect(source.url).toContain("optimize=false")
        expect(source.url).toContain("comparisonMode=authored-optimized")
        expect(source.url).toContain("runtimeProfile=preferred")
        expect(source.url).toContain("surfaceProfile=full-panel")

        yield* emitWorkflowComparisonAuthoredStream({
          comparisonId: "workflow-comparison/chat-handoff",
          meta: {
            requestId: "workflow-comparison-controls-proof",
            buildSha: "build-workflow-comparison-controls-proof",
            durationMs: 19
          },
          source,
          summary: "Workflow comparison optimize-off control proof."
        })

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry)).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunSuccess",
              () => "waiting-for-workflow-comparison-optimize-off-success"
            )
          )
        )

        const viewModel = registry.get(workflowComparisonSurfaceViewModelAtom)

        expect(viewModel.plan.optimize).toBe(false)
        expect(viewModel.plan.comparisonMode).toBe("authored-optimized")
        expect(viewModel.runStory).toBe("baseline -> authored optimized replay")
        expect(viewModel.renderedPreview.panes[1]?.label).toBe("Authored Optimized Output")
      })
    ))
})
