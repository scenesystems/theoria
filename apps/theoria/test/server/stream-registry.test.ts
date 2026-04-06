import * as LanguageModel from "@effect/ai/LanguageModel"
import { BunContext, BunFileSystem, BunPath } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { WorkflowEngine } from "@effect/workflow"
import { Chunk, Effect, Fiber, Layer, Option, Schema, Stream } from "effect"
import * as Contracts from "effect-dsp/contracts"
import * as Optimizer from "effect-dsp/Optimizer"
import { MockLanguageModel } from "effect-dsp/test"

import { moduleSpecifiers, parseTypeScript, readProjectFile } from "@theoria/source-proof"
import { scenarioById } from "../../app/contracts/demo/dsp.js"
import { effectTextProjectionSteps } from "../../app/contracts/demo/text.js"
import { runnableDemoIds } from "../../app/contracts/id.js"
import { resolveRunWorkflowIdentity, type RunPlan } from "../../app/contracts/run-plan.js"
import { EffectDspManifest, EffectTextManifest } from "../../app/contracts/stream-manifest.js"
import { RuntimeInfoLive } from "../../app/server/config/runtime.js"
import { DspProviderRuntime } from "../../app/server/demos/effect-dsp/provider.js"
import { defaultDspRunRequest, type DspExecutionStory } from "../../app/server/demos/effect-dsp/runtime.js"
import { buildDspStageStories } from "../../app/server/demos/effect-dsp/stage-story.js"
import { streamElementsForStageStories } from "../../app/server/demos/effect-dsp/stream.js"
import { ExecutionPolicyLive } from "../../app/server/demos/policy.js"
import { DemoWorkflowLive, lookup } from "../../app/server/demos/registry.js"
import { DemoStreamSessionRegistry } from "../../app/server/demos/stream-session-registry.js"

const appRootUrl = new URL("../../", import.meta.url)
const workflowComparisonContractPaths: ReadonlyArray<string> = [
  "app/contracts/workflow/comparison.ts",
  "app/contracts/workflow/comparison-step.ts"
]

const mockDspLanguageModelLayer = MockLanguageModel.layer(
  LanguageModel.LanguageModel,
  MockLanguageModel.fixed({
    intervention: "norms",
    rationale: "Mock rationale."
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

const DemoWorkflowTestLive = DemoWorkflowLive.pipe(
  Layer.provideMerge(WorkflowEngine.layerMemory),
  Layer.provideMerge(DemoStreamSessionRegistry.Default),
  Layer.provideMerge(ExecutionPolicyLive),
  Layer.provideMerge(Layer.succeed(DspProviderRuntime, mockDspProviderRuntime)),
  Layer.provideMerge(RuntimeInfoLive),
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunPath.layer)
)

const fixtureModuleId = Schema.decodeSync(Contracts.ModuleId)("fixture-dsp-module")

const dspStoryFixture: DspExecutionStory = {
  request: {
    scenarioId: defaultDspRunRequest.scenarioId,
    moduleType: "predict",
    optimizationBudget: 1
  },
  scenario: scenarioById(defaultDspRunRequest.scenarioId),
  provider: "mock-provider",
  model: "mock-model",
  durationMs: 12,
  baselineReport: {
    overallScores: { exactMatch: 0.5 },
    results: [{ index: 0, scores: { exactMatch: 0.5 }, durationMs: 3 }],
    totalExamples: 1,
    successCount: 0
  },
  baselineEvidence: {
    projections: [
      new Contracts.OptimizationObjectiveSurface({
        moduleId: fixtureModuleId,
        signatureDescription: "Fixture DSP evaluation",
        input: { question: "What is the capital of France?" },
        prompt: "[[ ## question ## ]]\nWhat is the capital of France?",
        output: { answer: "Paris" },
        score: Option.none(),
        rawResponse: "[[ ## answer ## ]]\nParis\n\n[[ ## completed ## ]]",
        usage: new Contracts.OptimizationObjectiveUsage({
          inputTokens: Option.some(12),
          outputTokens: Option.some(4),
          cached: false
        }),
        totalTokens: 16,
        durationMs: 3,
        timestamp: 1_700_000_000_000
      })
    ],
    usage: new Contracts.Usage({
      inputTokens: 12,
      outputTokens: 4,
      callCount: 1,
      cachedCount: 0
    })
  },
  optimizedReport: {
    overallScores: { exactMatch: 1 },
    results: [{ index: 0, scores: { exactMatch: 1 }, durationMs: 2 }],
    totalExamples: 1,
    successCount: 1
  },
  optimizedEvidence: {
    projections: [
      new Contracts.OptimizationObjectiveSurface({
        moduleId: fixtureModuleId,
        signatureDescription: "Fixture DSP evaluation",
        input: { question: "What is the capital of France?" },
        prompt: "[[ ## question ## ]]\nWhat is the capital of France?",
        output: { answer: "Paris" },
        score: Option.none(),
        rawResponse: "[[ ## answer ## ]]\nParis\n\n[[ ## completed ## ]]",
        usage: new Contracts.OptimizationObjectiveUsage({
          inputTokens: Option.some(10),
          outputTokens: Option.some(4),
          cached: false
        }),
        totalTokens: 14,
        durationMs: 2,
        timestamp: 1_700_000_000_100
      })
    ],
    usage: new Contracts.Usage({
      inputTokens: 10,
      outputTokens: 4,
      callCount: 1,
      cachedCount: 0
    })
  },
  baselineScore: 0.5,
  optimizedScore: 1,
  optimization: {
    fallbackUsed: false,
    learnedDemos: 1,
    roundsUsed: 1,
    traceAcceptedCount: 1,
    traceRejectedCount: 0
  },
  optimizationEvidence: {
    events: [
      Optimizer.BootstrapEvent.RoundStarted({ round: 1, maxRounds: 1 }),
      Optimizer.BootstrapEvent.TraceAccepted({ moduleName: "fixture-dsp-module", score: 1 }),
      Optimizer.BootstrapEvent.RoundCompleted({ round: 1, demosCollected: 1 }),
      Optimizer.BootstrapEvent.BootstrapCompleted({ totalDemos: 1, roundsUsed: 1, fallbackUsed: false })
    ]
  }
}

const manifestForStreamingProof = (id: typeof runnableDemoIds[number]) =>
  id === "effect-dsp"
    ? new EffectDspManifest({
      scenarioId: dspStoryFixture.request.scenarioId,
      moduleType: dspStoryFixture.request.moduleType,
      optimizationBudget: dspStoryFixture.request.optimizationBudget
    })
    : null

describe("Theoria Demo Stream Registry", () => {
  it.effect("keeps workflow-comparison contract authority sourced from effect-inference contracts", () =>
    Effect.gen(function*() {
      const importsByPath = yield* Effect.forEach(
        workflowComparisonContractPaths,
        (filePath) =>
          Effect.gen(function*() {
            const source = yield* readProjectFile(appRootUrl, filePath)
            return {
              filePath,
              imports: moduleSpecifiers(parseTypeScript(filePath, source))
            }
          })
      )

      importsByPath.forEach(({ imports }) => {
        expect(imports).toContain("effect-inference/Contracts")
        expect(imports).not.toContain("effect-dsp/contracts")
      })
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("collects the effect-text stream definition without circular initialization", () =>
    Effect.gen(function*() {
      const definition = lookup("effect-text")

      expect(Option.isSome(definition)).toBe(true)

      if (Option.isNone(definition)) {
        return
      }

      const elements = definition.value.streamElements(null)

      expect(elements).not.toBeNull()

      if (elements === null) {
        return
      }

      const collected = yield* Stream.runCollect(elements)
      const streamElements = Chunk.toReadonlyArray(collected)
      const sectionCount = streamElements.filter((element) => element._tag === "section").length
      const stepCount = streamElements.filter((element) => element._tag === "step").length
      const sectionTitles = streamElements.flatMap((element) =>
        element._tag === "section" ? [element.section.title] : []
      )

      expect(sectionCount).toBe(8)
      expect(stepCount).toBe(effectTextProjectionSteps("").length)
      expect(sectionTitles).toContain("React Surface")
      expect(sectionTitles).toContain("Browser Surface")
      expect(sectionTitles).toContain("Calibration")
      expect(streamElements.some((element) => element._tag === "cue")).toBe(true)
    }))

  it.effect("authors the effect-dsp stream with staged cues, canonical steps, and evidence sections", () =>
    Effect.gen(function*() {
      const definition = lookup("effect-dsp")

      expect(Option.isSome(definition)).toBe(true)

      const collected = yield* Stream.runCollect(streamElementsForStageStories(buildDspStageStories(dspStoryFixture)))
      const streamElements = Chunk.toReadonlyArray(collected)
      const stageEntries = streamElements.flatMap((element) =>
        element._tag === "cue" && element.cue._tag === "StageEnter" ? [element.cue.stageId] : []
      )
      const sectionTitles = streamElements.flatMap((element) =>
        element._tag === "section" ? [element.section.title] : []
      )

      expect(stageEntries).toEqual([
        "signature",
        "baseline",
        "optimizing",
        "optimized-eval",
        "comparison"
      ])
      expect(streamElements.some((element) => element._tag === "step")).toBe(true)
      expect(sectionTitles).toContain("Baseline Evaluation")
      expect(sectionTitles).toContain("Baseline Trace Evidence")
      expect(sectionTitles).toContain("Optimizer Event Evidence")
      expect(sectionTitles).toContain("Optimized Evaluation")
      expect(sectionTitles).toContain("Optimized Trace Evidence")
    }))

  it.effect("derives stable workflow identities from the run token and frozen plan", () =>
    Effect.gen(function*() {
      const definition = lookup("effect-text")

      expect(Option.isSome(definition)).toBe(true)

      if (Option.isNone(definition)) {
        return
      }

      const plan: RunPlan = {
        id: "effect-text",
        manifest: new EffectTextManifest({
          customText: "workflow",
          viewportWidthPx: 720
        })
      }

      const firstExecutionId = yield* definition.value.workflow.executionId({
        runToken: "run-1",
        plan
      })
      const repeatedExecutionId = yield* definition.value.workflow.executionId({
        runToken: "run-1",
        plan
      })
      const nextExecutionId = yield* definition.value.workflow.executionId({
        runToken: "run-2",
        plan
      })

      expect(firstExecutionId).toBe(repeatedExecutionId)
      expect(nextExecutionId).not.toBe(firstExecutionId)
    }))

  it.effect("derives digest-backed run identities from the frozen manifest and request", () =>
    Effect.gen(function*() {
      const first = yield* resolveRunWorkflowIdentity({
        runToken: "run-1",
        plan: {
          id: "effect-text",
          manifest: new EffectTextManifest({ customText: "workflow", viewportWidthPx: 720 })
        }
      })
      const repeated = yield* resolveRunWorkflowIdentity({
        runToken: "run-1",
        plan: {
          id: "effect-text",
          manifest: new EffectTextManifest({ customText: "workflow", viewportWidthPx: 720 })
        }
      })
      const nextRunToken = yield* resolveRunWorkflowIdentity({
        runToken: "run-2",
        plan: {
          id: "effect-text",
          manifest: new EffectTextManifest({ customText: "workflow", viewportWidthPx: 720 })
        }
      })
      const nextManifest = yield* resolveRunWorkflowIdentity({
        runToken: "run-1",
        plan: {
          id: "effect-text",
          manifest: new EffectTextManifest({ customText: "workflow", viewportWidthPx: 840 })
        }
      })

      expect(first).toEqual(repeated)
      expect(nextRunToken.manifestFingerprint).toBe(first.manifestFingerprint)
      expect(nextRunToken.planFingerprint).toBe(first.planFingerprint)
      expect(nextRunToken.requestFingerprint).not.toBe(first.requestFingerprint)
      expect(nextManifest.manifestFingerprint).not.toBe(first.manifestFingerprint)
      expect(nextManifest.planFingerprint).not.toBe(first.planFingerprint)
      expect(nextManifest.requestFingerprint).not.toBe(first.requestFingerprint)
    }))

  it.effect("every local workflow-backed streaming registration emits at least one authoritative Step and exactly one terminal StreamComplete", () =>
    Effect.gen(function*() {
      const registry = yield* DemoStreamSessionRegistry
      const streamingIds = runnableDemoIds.filter((id) => {
        const definition = lookup(id)

        return Option.isSome(definition) && definition.value.streamPlan !== null && definition.value.lane === "local"
      })

      yield* Effect.forEach(streamingIds, (id) =>
        Effect.gen(function*() {
          const definition = lookup(id)

          expect(Option.isSome(definition)).toBe(true)

          if (Option.isNone(definition)) {
            return
          }

          const request = {
            runToken: `proof-${id}`,
            plan: {
              id,
              manifest: manifestForStreamingProof(id)
            }
          }
          const identity = yield* resolveRunWorkflowIdentity(request)

          yield* registry.ensureSession(identity.requestFingerprint)

          const workflowFiber = yield* Effect.fork(definition.value.workflow.execute(request))
          const events = yield* Stream.runCollect(
            Stream.unwrapScoped(registry.subscribe(identity.requestFingerprint)).pipe(
              Stream.takeUntil((event) => event._tag === "StreamComplete" || event._tag === "StreamFailed")
            )
          )

          yield* Fiber.join(workflowFiber)

          const tags = Chunk.toReadonlyArray(events).map((event) => event._tag)

          expect(tags.filter((tag) => tag === "Step").length).toBeGreaterThan(0)
          expect(tags.filter((tag) => tag === "StreamComplete").length).toBe(1)
          expect(tags.includes("StreamFailed")).toBe(false)
        }), { discard: true })
    }).pipe(Effect.provide(DemoWorkflowTestLive)))

  it.effect("executes the effect-text run through the registered workflow layer", () =>
    Effect.gen(function*() {
      const definition = lookup("effect-text")

      expect(Option.isSome(definition)).toBe(true)

      if (Option.isNone(definition)) {
        return
      }

      const data = yield* definition.value.workflow.execute({
        runToken: "run-effect-text",
        plan: {
          id: "effect-text",
          manifest: null
        }
      })

      expect(data.id).toBe("effect-text")
      expect(data.sections.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(DemoWorkflowTestLive)))

  it.effect("keeps the effect-dsp deep-dive runtime delegated to the effect-inference-backed provider service", () =>
    Effect.gen(function*() {
      const runtimePath = "app/server/demos/effect-dsp/runtime.ts"
      const source = yield* readProjectFile(appRootUrl, runtimePath)
      const parsed = parseTypeScript(runtimePath, source)
      const imports = moduleSpecifiers(parsed)

      expect(imports).toContain("./provider.js")
      expect(imports).not.toContain("@effect/ai-openai/OpenAiClient")
      expect(imports).not.toContain("@effect/ai-anthropic/AnthropicClient")
      expect(imports).not.toContain("@effect/ai-openrouter/OpenRouterClient")
    }).pipe(Effect.provide(BunContext.layer)))
})
