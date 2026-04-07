import * as LanguageModel from "@effect/ai/LanguageModel"
import { HttpServerResponse } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { WorkflowEngine } from "@effect/workflow"
import { Chunk, Effect, Either, Fiber, Layer, Option, Schema, Stream } from "effect"
import { MockLanguageModel } from "effect-dsp/test"

import { moduleSpecifiers, parseTypeScript, readProjectFile } from "@theoria/source-proof"

import { decodeEvidenceEventJson } from "../../app/contracts/evidence-stream.js"
import {
  makeWorkflowComparisonRunPlan,
  resolveWorkflowComparisonRunIdentity,
  WorkflowComparisonRunEnvelope,
  type WorkflowComparisonRunRequest as WorkflowComparisonRunRequestType
} from "../../app/contracts/workflow/comparison-run.js"
import { RuntimeInfoLive } from "../../app/server/config/runtime.js"
import { DspProviderRuntime } from "../../app/server/demos/effect-dsp/provider.js"
import { workflowComparisonRoute } from "../../app/server/routes/workflow-comparison.js"
import { RunStreamSessionRegistry } from "../../app/server/runtime/stream-session-registry.js"
import { frozenComparisonForRequest } from "../../app/server/workflow-comparison/frozen.js"
import {
  replayWorkflowComparisonSearchSelection,
  runWorkflowComparisonSearchStudy,
  workflowComparisonSearchDimensions
} from "../../app/server/workflow-comparison/search-study.js"
import {
  workflowComparisonWorkflow,
  WorkflowComparisonWorkflowLive
} from "../../app/server/workflow-comparison/workflow.js"

const appRootUrl = new URL("../../", import.meta.url)

class ResponseJsonError extends Schema.TaggedError<ResponseJsonError>()("ResponseJsonError", {
  message: Schema.String
}) {}

class ResponseTextError extends Schema.TaggedError<ResponseTextError>()("ResponseTextError", {
  message: Schema.String
}) {}

const mockDspLanguageModelLayer = MockLanguageModel.layer(
  LanguageModel.LanguageModel,
  MockLanguageModel.fixed({
    intervention: "workflow-comparison",
    rationale: "Mock workflow comparison runtime."
  })
)

const mockDspProviderRuntime = DspProviderRuntime.of({
  capability: {
    enabled: true,
    provider: Option.some("openai"),
    model: Option.some("mock-model"),
    routeFamily: Option.none(),
    baseUrl: Option.none(),
    reason: Option.none()
  },
  resolution: {
    desired: Option.none(),
    resolvedRoute: Option.none()
  },
  layer: Option.some(mockDspLanguageModelLayer)
})

const runtimeDependencies = Layer.mergeAll(
  Layer.succeed(DspProviderRuntime, mockDspProviderRuntime),
  RunStreamSessionRegistry.Default,
  RuntimeInfoLive,
  WorkflowEngine.layerMemory
)

const WorkflowComparisonServerLive = Layer.merge(
  runtimeDependencies,
  WorkflowComparisonWorkflowLive.pipe(Layer.provide(runtimeDependencies))
)

const provideWorkflowComparisonServer = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provide(WorkflowComparisonServerLive), Effect.provide(BunContext.layer))

const decodeWebJson = <A, I>(
  response: HttpServerResponse.HttpServerResponse,
  schema: Schema.Schema<A, I>
) =>
  Effect.gen(function*() {
    const webResponse = HttpServerResponse.toWeb(response)
    const body = yield* Effect.tryPromise({
      try: () => webResponse.json(),
      catch: (cause) => new ResponseJsonError({ message: String(cause) })
    }).pipe(Effect.orDie)
    const decoded = yield* Schema.decodeUnknown(schema)(body).pipe(Effect.orDie)

    return { decoded, status: webResponse.status }
  })

const decodeSseEvents = (response: HttpServerResponse.HttpServerResponse) =>
  Effect.gen(function*() {
    const payload = yield* Effect.tryPromise({
      try: () => HttpServerResponse.toWeb(response).text(),
      catch: (cause) => new ResponseTextError({ message: String(cause) })
    }).pipe(Effect.orDie)
    const eventPayloads = payload.split("\n\n").flatMap((frame) =>
      frame.split("\n").flatMap((line) => (line.startsWith("data: ") ? [line.slice(6)] : []))
    )

    return yield* Effect.forEach(
      eventPayloads,
      (eventPayload) =>
        Effect.sync(() => decodeEvidenceEventJson(eventPayload)).pipe(
          Effect.flatMap(
            Either.match({
              onLeft: Effect.die,
              onRight: Effect.succeed
            })
          )
        )
    )
  })

describe("server/workflow-comparison-runtime", () => {
  it.effect("executes task, chat, retrieval, and render-sensitive workflow comparisons through the workflow engine seam and shared stream registry", () =>
    provideWorkflowComparisonServer(
      Effect.gen(function*() {
        const registry = yield* RunStreamSessionRegistry
        const requests: ReadonlyArray<WorkflowComparisonRunRequestType> = [
          {
            runToken: "workflow-comparison-task",
            plan: makeWorkflowComparisonRunPlan({ comparisonId: "workflow-comparison/task-briefing" })
          },
          {
            runToken: "workflow-comparison-chat",
            plan: makeWorkflowComparisonRunPlan({
              comparisonId: "workflow-comparison/chat-handoff",
              comparisonMode: "authored-optimized",
              optimize: false,
              runtimeProfile: "preferred",
              surfaceProfile: "full-panel"
            })
          },
          {
            runToken: "workflow-comparison-retrieval",
            plan: makeWorkflowComparisonRunPlan({
              comparisonId: "workflow-comparison/retrieval-required",
              runtimeProfile: "preferred"
            })
          },
          {
            runToken: "workflow-comparison-render",
            plan: makeWorkflowComparisonRunPlan({
              comparisonId: "workflow-comparison/render-sensitive",
              comparisonMode: "authored-optimized",
              optimize: false,
              surfaceProfile: "sidebar"
            })
          }
        ]

        yield* Effect.forEach(
          requests,
          (request) =>
            Effect.gen(function*() {
              const identity = yield* resolveWorkflowComparisonRunIdentity(request)

              yield* registry.ensureSession(identity.requestFingerprint)

              const workflowFiber = yield* Effect.fork(workflowComparisonWorkflow.execute(request))
              const events = yield* Stream.runCollect(
                Stream.unwrapScoped(registry.subscribe(identity.requestFingerprint)).pipe(
                  Stream.takeUntil((event) => event._tag === "StreamComplete" || event._tag === "StreamFailed")
                )
              )
              const success = yield* Fiber.join(workflowFiber)
              const eventTags = Chunk.toReadonlyArray(events).map((event) => event._tag)

              expect(success.identity.runToken).toBe(request.runToken)
              expect(success.baseline.graphProjection.traversal).toEqual(
                success.baseline.nodeExecutions.map((execution) => execution.node.nodeId)
              )
              expect(success.optimized.graphProjection.traversal).toEqual(
                success.optimized.nodeExecutions.map((execution) => execution.node.nodeId)
              )
              expect(success.baseline.nodeExecutions.every((execution) => execution.trace.prompt.length > 0)).toBe(true)
              expect(success.baseline.nodeExecutions.every((execution) => execution.trace.rawResponse.length > 0)).toBe(
                true
              )
              expect(
                success.baseline.nodeExecutions.every(
                  (execution) =>
                    Option.fromNullable(execution.runtimeEvidence.resolvedRuntime.completedAtMs).pipe(
                      Option.isSome
                    )
                )
              ).toBe(true)
              expect(success.optimized.report.aggregateScore).toBeGreaterThan(success.baseline.report.aggregateScore)
              expect(eventTags.filter((tag) => tag === "Step").length).toBeGreaterThan(0)
              expect(eventTags.filter((tag) => tag === "StreamComplete").length).toBe(1)
              expect(eventTags.includes("StreamFailed")).toBe(false)
            }),
          { discard: true }
        )
      })
    ))

  it.effect("surfaces the blocking run envelope with the typed success payload and honors explicit run tokens", () =>
    provideWorkflowComparisonServer(
      Effect.gen(function*() {
        const response = yield* workflowComparisonRoute(
          "/api/workflow-comparison/run",
          "request-run",
          "http://127.0.0.1/api/workflow-comparison/run?comparisonId=workflow-comparison/task-briefing&runToken=route-proof&optimize=false&comparisonMode=authored-optimized&runtimeProfile=preferred&surfaceProfile=full-panel"
        )
        const envelope = yield* decodeWebJson(response, WorkflowComparisonRunEnvelope)

        expect(envelope.status).toBe(200)
        expect(envelope.decoded.ok).toBe(true)

        if (!envelope.decoded.ok) {
          return
        }

        expect(envelope.decoded.data.identity.runToken).toBe("route-proof")
        expect(envelope.decoded.data.workflowKind).toBe("task-first")
        expect(envelope.decoded.data.runData.id).toBe("workflow-comparison")
        expect(envelope.decoded.data.identity.optimize).toBe(false)
        expect(envelope.decoded.data.identity.comparisonMode).toBe("authored-optimized")
        expect(envelope.decoded.data.identity.runtimeProfile).toBe("preferred")
        expect(envelope.decoded.data.identity.surfaceProfile).toBe("full-panel")
        expect(envelope.decoded.data.baseline.nodeExecutions.length).toBeGreaterThan(0)
        expect(envelope.decoded.data.baseline.nodeExecutions[0]?.trace.prompt.length).toBeGreaterThan(0)
      })
    ))

  it.effect("streams canonical Step and StreamComplete events from the route-backed SSE surface", () =>
    provideWorkflowComparisonServer(
      Effect.gen(function*() {
        const response = yield* workflowComparisonRoute(
          "/api/workflow-comparison/stream",
          "request-stream",
          "http://127.0.0.1/api/workflow-comparison/stream?comparisonId=workflow-comparison/chat-handoff&runToken=stream-proof"
        )
        const events = yield* decodeSseEvents(response)
        const eventTags = events.map((event) => event._tag)
        const optimizationStudyAdvances = events.filter(
          (event) =>
            event._tag === "Choreography"
            && event.cue._tag === "StageAdvance"
            && event.cue.stageId === "optimization-study"
        )

        expect(eventTags.filter((tag) => tag === "Step").length).toBeGreaterThan(0)
        expect(eventTags.filter((tag) => tag === "StreamComplete").length).toBe(1)
        expect(optimizationStudyAdvances.length).toBeGreaterThan(0)
        expect(eventTags.includes("StreamFailed")).toBe(false)
      })
    ))

  it.effect("returns an invalid-query envelope when the selected workflow comparison is outside the published contract", () =>
    provideWorkflowComparisonServer(
      Effect.gen(function*() {
        const response = yield* workflowComparisonRoute(
          "/api/workflow-comparison/run",
          "request-invalid",
          "http://127.0.0.1/api/workflow-comparison/run?comparisonId=workflow-comparison/unknown"
        )
        const envelope = yield* decodeWebJson(response, WorkflowComparisonRunEnvelope)

        expect(envelope.status).toBe(400)
        expect(envelope.decoded.ok).toBe(false)

        if (envelope.decoded.ok) {
          return
        }

        expect(envelope.decoded.error.code).toBe("invalid-query")
      })
    ))

  it.effect("terminates the workflow-comparison stream with a typed StreamFailed event when the query is invalid", () =>
    provideWorkflowComparisonServer(
      Effect.gen(function*() {
        const response = yield* workflowComparisonRoute(
          "/api/workflow-comparison/stream",
          "request-stream-invalid",
          "http://127.0.0.1/api/workflow-comparison/stream?comparisonId=workflow-comparison/task-briefing&optimize=maybe"
        )
        const events = yield* decodeSseEvents(response)

        expect(events).toHaveLength(1)
        expect(events[0]?._tag).toBe("StreamFailed")

        if (events[0]?._tag !== "StreamFailed") {
          return
        }

        expect(events[0].error.code).toBe("invalid-query")
      })
    ))

  it.effect("wires the workflow-comparison workflow into the app server layer, router boundary, and activity-backed execution path", () =>
    Effect.gen(function*() {
      const appSource = yield* readProjectFile(appRootUrl, "app/server/app.ts")
      const routerSource = yield* readProjectFile(appRootUrl, "app/server/router.ts")
      const workflowSource = yield* readProjectFile(appRootUrl, "app/server/workflow-comparison/workflow.ts")
      const appImports = moduleSpecifiers(parseTypeScript("app/server/app.ts", appSource))
      const routerImports = moduleSpecifiers(parseTypeScript("app/server/router.ts", routerSource))
      const workflowImports = moduleSpecifiers(
        parseTypeScript("app/server/workflow-comparison/workflow.ts", workflowSource)
      )

      expect(appImports).toContain("./workflow-comparison/workflow.js")
      expect(appSource).toContain("Layer.merge(DemoWorkflowLive, WorkflowComparisonWorkflowLive)")
      expect(routerImports).toContain("./routes/workflow-comparison.js")
      expect(routerSource).toContain("/api/workflow-comparison/")
      expect(workflowImports).toContain("@effect/workflow")
      expect(workflowSource).toContain("Workflow.make({")
      expect(workflowSource).toContain("Activity.make({")
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("opens an effect-search study, checkpoints a canonical StudySnapshot, and recovers or improves on the authored optimized manifest", () =>
    Effect.gen(function*() {
      const comparison = yield* frozenComparisonForRequest("workflow-comparison/task-briefing")
      const outcome = yield* runWorkflowComparisonSearchStudy({
        comparison,
        lane: "deterministic-fallback",
        plan: makeWorkflowComparisonRunPlan({ comparisonId: "workflow-comparison/task-briefing" })
      })
      const eventTags = outcome.events.map((event) => event._tag)

      expect(eventTags.filter((tag) => tag === "TrialStarted").length).toBe(outcome.trialBudget)
      expect(eventTags.filter((tag) => tag === "TrialCompleted").length).toBe(outcome.trialBudget)
      expect(eventTags.at(-1)).toBe("StudyCompleted")
      expect(outcome.snapshot.completedCount).toBe(outcome.trialBudget)
      expect(outcome.snapshot.nextTrialNumber).toBe(outcome.trialBudget)
      expect(outcome.winner.execution.report.aggregateScore).toBeGreaterThanOrEqual(
        outcome.authored.execution.report.aggregateScore
      )
    }).pipe(Effect.provideService(DspProviderRuntime, mockDspProviderRuntime)))

  it.effect("replays the winning manifest under the deterministic fallback lane with the same score report", () =>
    Effect.gen(function*() {
      const comparison = yield* frozenComparisonForRequest("workflow-comparison/chat-handoff")
      const plan = makeWorkflowComparisonRunPlan({
        comparisonId: "workflow-comparison/chat-handoff",
        runtimeProfile: "preferred",
        surfaceProfile: "full-panel"
      })
      const dimensions = yield* workflowComparisonSearchDimensions(comparison, plan)
      const outcome = yield* runWorkflowComparisonSearchStudy({
        comparison,
        lane: "deterministic-fallback",
        plan
      })
      const replay = yield* replayWorkflowComparisonSearchSelection({
        comparison,
        dimensions,
        lane: "deterministic-fallback",
        selection: outcome.winner.selection
      })

      expect(replay.execution.report.aggregateScore).toBe(outcome.winner.execution.report.aggregateScore)
      expect(replay.execution.record.graph.nodes).toEqual(outcome.winner.execution.record.graph.nodes)
      expect(replay.execution.graphProjection.traversal).toEqual(outcome.winner.execution.graphProjection.traversal)
    }).pipe(Effect.provideService(DspProviderRuntime, mockDspProviderRuntime)))

  it.effect("streams study-backed optimization evidence on the same workflow execution record as the canonical winner run", () =>
    provideWorkflowComparisonServer(
      Effect.gen(function*() {
        const success = yield* workflowComparisonWorkflow.execute({
          runToken: "study-evidence-proof",
          plan: makeWorkflowComparisonRunPlan({
            comparisonId: "workflow-comparison/task-briefing",
            runtimeProfile: "preferred",
            surfaceProfile: "sidebar"
          })
        })
        const sectionTitles = success.runData.sections.map((section) => section.title)

        expect(sectionTitles).toContain("Optimization Study Summary")
        expect(sectionTitles).toContain("Optimization Winner")
        expect(sectionTitles).toContain("Optimization Snapshot")
        expect(sectionTitles).toContain("Optimization Study Event Trace")
        expect(success.optimized.report.aggregateScore).toBeGreaterThan(success.baseline.report.aggregateScore)
      })
    ))
})
