import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Option, Schema } from "effect"

import { workflowEntryDescriptor } from "../../app/contracts/entry/descriptors/workflow.js"
import type { WorkflowScenarioId } from "../../app/contracts/study/workflow/scenario.js"
import { defaultWorkflowEntrySelection } from "../../app/contracts/study/workflow/selection.js"
import { startRun } from "../../app/web/atoms/run/execution.js"
import { pauseRun, resetRun, resumeRun, stopRun } from "../../app/web/atoms/run/lifecycle-actions.js"
import { surfaceEvidenceSectionsAtom } from "../../app/web/atoms/surface/evidence-store.js"
import {
  surfaceAtom,
  surfaceCanonicalFrameAtom,
  surfaceDraftAtom,
  surfaceRunStateAtom
} from "../../app/web/atoms/surface/state.js"
import {
  selectWorkflowOptimizeAtom,
  selectWorkflowRuntimeProfileAtom,
  selectWorkflowSeedAtom,
  selectWorkflowSurfaceProfileAtom,
  selectWorkflowTargetModeAtom
} from "../../app/web/atoms/workflow/draft-actions.js"
import type { RunControlActionKind } from "../../app/web/state/run/types.js"
import type { SurfaceState } from "../../app/web/state/surface/state.js"
import { WorkflowSurfaceViewModel } from "../../app/web/view/study/workflow/surface-model.js"
import { makeAppClientTestRuntime } from "../helpers/entry-client.test-layer.js"
import { errorFixture, programPreviewFixture } from "../helpers/entry-fixtures.js"
import { emitWorkflowAuthoredStream } from "../helpers/mock-workflow-stream.js"

type RunControlCommand = {
  readonly action: RunControlActionKind
  readonly id: "workflow"
}

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

const WorkflowEntryRequestJson = Schema.parseJson(workflowEntryDescriptor.runRequestSchema)
const decodeWorkflowEntryRequestJson = Schema.decodeUnknownSync(WorkflowEntryRequestJson)

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
    preload: () => Effect.succeed(programPreviewFixture)
  })

const makeRunControlAtom = (runtime = makeRuntime()) =>
  runtime.fn<RunControlCommand>()(
    ({ action, id }, ctx) =>
      Match.value(action).pipe(
        Match.when("run", () => startRun(id, ctx)),
        Match.when("pause", () => pauseRun(id, ctx)),
        Match.when("resume", () => resumeRun(id, ctx)),
        Match.when("stop", () => stopRun(id, ctx)),
        Match.orElse(() => resetRun(id, ctx))
      )
  )

const readSurface = (registry: Registry.Registry): SurfaceState => registry.get(surfaceAtom("workflow"))

const readWorkflowViewModel = (registry: Registry.Registry) => {
  const draft = registry.get(surfaceDraftAtom("workflow"))

  return WorkflowSurfaceViewModel.project({
    draftPlan: draft.entryId === "workflow" ? draft : defaultWorkflowEntrySelection,
    frame: registry.get(surfaceCanonicalFrameAtom("workflow")),
    run: registry.get(surfaceRunStateAtom("workflow")),
    sections: registry.get(surfaceEvidenceSectionsAtom("workflow"))
  })
}

const workflowRequestFromStreamUrl = (url: string) =>
  decodeWorkflowEntryRequestJson(new URL(url, "http://127.0.0.1").searchParams.get("request") ?? "")

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

const workflowSeedCases: ReadonlyArray<{
  readonly seedId: WorkflowScenarioId
  readonly label: string
}> = [
  { seedId: "task-briefing", label: "Task Briefing" },
  { seedId: "chat-handoff", label: "Chat Handoff" },
  { seedId: "retrieval-required", label: "Retrieval Required" },
  { seedId: "render-sensitive", label: "Render Sensitive" }
]

describe("workflow browser proof", () => {
  it.live("preserves frozen workflow seed across interruption and only adopts the next seed after reset", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeAsyncTestRegistry()
        const runControlAtom = makeRunControlAtom(makeRuntime())

        registry.mount(runControlAtom)
        registry.mount(selectWorkflowSeedAtom)
        registry.set(selectWorkflowSeedAtom, "task-briefing")
        registry.set(runControlAtom, { action: "run", id: "workflow" })

        const firstSource = yield* waitForSource(0)

        expect(workflowRequestFromStreamUrl(firstSource.url).draft.seedId).toBe("task-briefing")

        registry.set(selectWorkflowSeedAtom, "render-sensitive")
        registry.set(runControlAtom, { action: "stop", id: "workflow" })

        const stopped = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry)).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunIdle", () => "waiting-for-workflow-stop")
          )
        )

        expect(firstSource.closed).toBe(true)
        expect(stopped.run.session.draft?.seedId).toBe("task-briefing")
        expect(readWorkflowViewModel(registry).selection.label).toBe("Task Briefing")
        expect(readWorkflowViewModel(registry).selectionLocked).toBe(true)

        registry.set(runControlAtom, { action: "reset", id: "workflow" })

        expect(readWorkflowViewModel(registry).selection.label).toBe("Render Sensitive")
        expect(readSurface(registry).run.session.draft).toBeNull()

        registry.set(runControlAtom, { action: "run", id: "workflow" })

        const secondSource = yield* waitForSource(1)

        expect(workflowRequestFromStreamUrl(secondSource.url).draft.seedId).toBe("render-sensitive")
      })
    ))

  it.live("routes every published workflow seed through the shared workflow entry stream lane", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeAsyncTestRegistry()
        const runControlAtom = makeRunControlAtom(makeRuntime())

        registry.mount(runControlAtom)
        registry.mount(selectWorkflowSeedAtom)

        yield* Effect.forEach(
          workflowSeedCases,
          ({ label, seedId }, index) =>
            Effect.gen(function*() {
              registry.set(selectWorkflowSeedAtom, seedId)
              registry.set(runControlAtom, { action: "run", id: "workflow" })

              const source = yield* waitForSource(index)
              const request = workflowRequestFromStreamUrl(source.url)

              expect(source.url.startsWith("/api/entries/workflow/stream?request=")).toBe(true)
              expect(request.draft.seedId).toBe(seedId)

              yield* emitWorkflowAuthoredStream({
                scenarioId: seedId,
                meta: {
                  requestId: `workflow-${seedId}`,
                  buildSha: `build-${seedId}`,
                  durationMs: index + 17
                },
                source,
                summary: `${label} browser proof.`
              })

              const succeeded = yield* Effect.eventually(
                Effect.sync(() => readSurface(registry)).pipe(
                  Effect.filterOrFail((state) => state.run._tag === "RunSuccess", () => `waiting-for-${seedId}-success`)
                )
              )

              expect(succeeded.run.session.draft?.seedId).toBe(seedId)
              expect(readWorkflowViewModel(registry).selection.label).toBe(label)

              registry.set(runControlAtom, { action: "reset", id: "workflow" })

              yield* Effect.eventually(
                Effect.sync(() => readSurface(registry)).pipe(
                  Effect.filterOrFail((state) => state.run.session.draft === null, () => `waiting-for-${seedId}-reset`)
                )
              )
            }),
          { discard: true }
        )
      })
    ))

  it.live("freezes workflow control choices into the shared entry draft and reflected surface view model", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeAsyncTestRegistry()
        const runControlAtom = makeRunControlAtom(makeRuntime())

        registry.mount(runControlAtom)
        registry.mount(selectWorkflowSeedAtom)
        registry.mount(selectWorkflowTargetModeAtom)
        registry.mount(selectWorkflowOptimizeAtom)
        registry.mount(selectWorkflowRuntimeProfileAtom)
        registry.mount(selectWorkflowSurfaceProfileAtom)

        registry.set(selectWorkflowSeedAtom, "chat-handoff")
        registry.set(selectWorkflowTargetModeAtom, "search-winner")
        registry.set(selectWorkflowOptimizeAtom, false)
        registry.set(selectWorkflowRuntimeProfileAtom, "preferred")
        registry.set(selectWorkflowSurfaceProfileAtom, "full-panel")

        const draft = readSurface(registry).draft

        expect(draft.entryId).toBe("workflow")
        if (draft.entryId !== "workflow") {
          return
        }

        expect(draft.seedId).toBe("chat-handoff")
        expect(draft.controls.optimize).toBe(false)
        expect(draft.controls.targetMode).toBe("authored-optimized")
        expect(draft.controls.runtimeProfile).toBe("preferred")
        expect(draft.controls.surfaceProfile).toBe("full-panel")

        registry.set(runControlAtom, { action: "run", id: "workflow" })

        const source = yield* waitForSource(0)
        const request = workflowRequestFromStreamUrl(source.url)

        expect(request.draft.seedId).toBe("chat-handoff")
        expect(request.draft.controls.optimize).toBe(false)
        expect(request.draft.controls.targetMode).toBe("authored-optimized")
        expect(request.draft.controls.runtimeProfile).toBe("preferred")
        expect(request.draft.controls.surfaceProfile).toBe("full-panel")

        yield* emitWorkflowAuthoredStream({
          scenarioId: "chat-handoff",
          meta: {
            requestId: "workflow-controls",
            buildSha: "build-workflow-controls",
            durationMs: 19
          },
          source,
          summary: "Workflow controls proof."
        })

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry)).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunSuccess",
              () => "waiting-for-workflow-controls-success"
            )
          )
        )

        const viewModel = readWorkflowViewModel(registry)

        expect(viewModel.plan.controls.optimize).toBe(false)
        expect(viewModel.plan.controls.targetMode).toBe("authored-optimized")
        expect(viewModel.plan.controls.runtimeProfile).toBe("preferred")
        expect(viewModel.plan.controls.surfaceProfile).toBe("full-panel")
        expect(viewModel.runStory).toBe("baseline -> authored optimized replay")
      })
    ))
})
