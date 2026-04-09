import { Registry } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { moduleSpecifiers, parseTypeScript, readProjectFile } from "@theoria/source-proof"
import { Effect, Option, Ref } from "effect"

import { DspCanonicalStep, isDspRunFrame } from "../../app/contracts/capability/effect-dsp-runtime.js"
import { projectEffectSearchStudyTelemetry } from "../../app/contracts/capability/effect-search-study-telemetry-projection.js"
import {
  EffectSearchCanonicalStep,
  isEffectSearchProjectionScript,
  optimizationEvidenceBatchSize,
  optimizationEvidenceLiveRowWindow
} from "../../app/contracts/capability/effect-search.js"
import type { EntryId } from "../../app/contracts/entry/id.js"
import type { EvidenceItem, EvidenceSection } from "../../app/contracts/evidence/item.js"
import {
  canonicalStepEvent,
  encodeEvidenceEventJson,
  SectionAppend,
  StreamComplete
} from "../../app/contracts/evidence/stream.js"
import { isEffectDspProjectionScript } from "../../app/web/atoms/dsp-run-plan.js"
import { dspModuleTypeAtom, dspOptimizationBudgetAtom, dspScenarioIdAtom } from "../../app/web/atoms/dsp-widget.js"
import { optimizationWidgetViewModelAtom } from "../../app/web/atoms/optimization-widget-view-model.js"
import { reflowStageViewportWidthAtom, resolveReflowStageMaxWidth } from "../../app/web/atoms/reflow.js"
import { animatingAtom } from "../../app/web/atoms/run/animation.js"
import {
  isEffectSearchRunFrame,
  optimizationAnimatingAtom,
  trialBudgetAtom
} from "../../app/web/atoms/run/optimization-animation.js"
import { powerAnimatingAtom, powerControlsAtom } from "../../app/web/atoms/run/power-animation.js"
import { surfaceEvidenceSectionsAtom, surfaceEvidenceStreamAtom } from "../../app/web/atoms/surface/evidence-store.js"
import { surfaceRunRuntimeTelemetryAtom } from "../../app/web/atoms/surface/run-telemetry.js"
import { selectStageTabAtom } from "../../app/web/atoms/surface/selection-actions.js"
import { surfaceAtom } from "../../app/web/atoms/surface/state.js"
import { streamingEntryIds } from "../../app/web/runtime/kernel/surface-runtime.js"
import type { SurfaceState } from "../../app/web/state/surface/state.js"
import { makeAppClientTestRuntime } from "../helpers/entry-client.test-layer.js"
import { errorFixture, programPreviewFixture } from "../helpers/entry-fixtures.js"
import {
  emitEffectMathAuthoredStream,
  emitEffectSearchAuthoredStream,
  emitEffectTextAuthoredStream
} from "../helpers/mock-authored-stream.js"
import { makeRunControlAtom, makeRunDemoAtom } from "../helpers/run-atoms.js"

const appRootUrl = new URL("../../", import.meta.url)

describe("evidence orchestration runtime-boundary", () => {
  it.effect("keeps run execution orchestration free of provider-client imports and provider enums", () =>
    Effect.gen(function*() {
      const executionPath = "app/web/atoms/run/execution.ts"
      const source = yield* readProjectFile(appRootUrl, executionPath)

      expect(source).not.toContain("\"openai\"")
      expect(source).not.toContain("\"anthropic\"")
      expect(source).not.toContain("\"openrouter\"")
      expect(source).not.toContain("@effect/ai-openai")
      expect(source).not.toContain("@effect/ai-anthropic")
      expect(source).not.toContain("@effect/ai-openrouter")
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps workflow decode helpers sourced from effect-inference contracts instead of app-local duplicates", () =>
    Effect.gen(function*() {
      const decodePaths: ReadonlyArray<string> = [
        "app/server/study/workflow/decode.ts",
        "test/fixtures/workflow/decode.ts"
      ]

      const importsByPath = yield* Effect.forEach(
        decodePaths,
        (filePath) =>
          Effect.gen(function*() {
            const source = yield* readProjectFile(appRootUrl, filePath)
            return moduleSpecifiers(parseTypeScript(filePath, source))
          })
      )

      importsByPath.forEach((imports) => {
        expect(imports).toContain("effect-inference/Contracts")
        expect(imports).not.toContain("effect-dsp/contracts")
      })
    }).pipe(Effect.provide(BunContext.layer)))
})

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

  emitError(): void {
    ;(this.listeners.error ?? []).forEach((listener) => listener(new Event("error")))
  }
}

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

const makeAsyncTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      queueMicrotask(f)
    }
  })

const readSurface = (registry: Registry.Registry, id: EntryId): SurfaceState => registry.get(surfaceAtom(id))
const readEvidenceStream = (registry: Registry.Registry, id: EntryId) => registry.get(surfaceEvidenceStreamAtom(id))
const readRuntimeTelemetry = (registry: Registry.Registry, id: EntryId) =>
  registry.get(surfaceRunRuntimeTelemetryAtom(id))

const isTableItem = (
  item: EvidenceItem
): item is Extract<EvidenceItem, { readonly _tag: "Table" }> => item._tag === "Table"

const trialPositionsTables = (sections: ReadonlyArray<EvidenceSection>) =>
  Option.fromNullable(sections.find((section) => section.title === "Trial Positions")).pipe(
    Option.map((section) => section.items.filter(isTableItem))
  )

const firstTrialPositionRowCount = (sections: ReadonlyArray<EvidenceSection>): Option.Option<number> =>
  trialPositionsTables(sections).pipe(
    Option.flatMap((tables) => Option.fromNullable(tables[0])),
    Option.map((table) => table.rows.length)
  )

const effectTextProjectionWidths = (sections: ReadonlyArray<EvidenceSection>): ReadonlyArray<number> =>
  sections.flatMap((section) =>
    section.title === "Width Metrics"
      ? section.items.flatMap((item) =>
        item._tag === "Text"
          ? [Number(item.label.replace("Width ", ""))].filter(Number.isFinite)
          : []
      )
      : []
  )

const textValuesForSection = (sections: ReadonlyArray<EvidenceSection>, title: string): ReadonlyArray<string> =>
  sections.flatMap((section) =>
    section.title === title
      ? section.items.flatMap((item) => (item._tag === "Text" ? [`${item.label}: ${item.value}`] : []))
      : []
  )

const streamMeta = {
  requestId: "req-sse",
  buildSha: "build-sse",
  durationMs: 7
}

const waitForSource = Effect.eventually(
  Effect.sync(() => Option.fromNullable(MockEventSource.instances[0])).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail("waiting-for-source"),
        onSome: Effect.succeed
      })
    )
  )
)

const makeRuntime = () =>
  makeAppClientTestRuntime({
    run: () => Effect.fail(errorFixture),
    runWithMeta: () => Effect.fail(errorFixture),
    preload: () => Effect.succeed(programPreviewFixture)
  })

const makeRuntimeWithTransportCounters = ({
  runCountRef,
  runWithMetaCountRef
}: {
  readonly runCountRef: Ref.Ref<number>
  readonly runWithMetaCountRef: Ref.Ref<number>
}) =>
  makeAppClientTestRuntime({
    run: () =>
      Ref.update(runCountRef, (count) => count + 1).pipe(
        Effect.zipRight(Effect.fail(errorFixture))
      ),
    runWithMeta: () =>
      Ref.update(runWithMetaCountRef, (count) => count + 1).pipe(
        Effect.zipRight(Effect.fail(errorFixture))
      ),
    preload: () => Effect.succeed(programPreviewFixture)
  })

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

const assertLocalDemoPauseResume = ({
  animatingAtom,
  emitBeforeResume,
  id,
  summary,
  summarySectionTitle
}: {
  readonly animatingAtom: AtomType.Writable<boolean>
  readonly emitBeforeResume?: (
    source: MockEventSource,
    registry: Registry.Registry
  ) => Effect.Effect<void, never, never>
  readonly id: "effect-text" | "effect-math"
  readonly summary: string
  readonly summarySectionTitle: string
}) =>
  withMockEventSource(
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const runtime = makeRuntime()
      const runDemoAtom = makeRunDemoAtom(runtime)
      const runControlAtom = makeRunControlAtom(runtime)

      if (id === "effect-text") {
        registry.set(reflowStageViewportWidthAtom, 960)
      }

      registry.mount(runDemoAtom)
      registry.mount(runControlAtom)
      registry.set(runDemoAtom, id)

      const source = yield* waitForSource

      yield* Effect.eventually(
        Effect.sync(() => readSurface(registry, id)).pipe(
          Effect.filterOrFail(
            (state) => state.run._tag === "RunRunning" && registry.get(animatingAtom) === true,
            () => `waiting-for-${id}-running`
          )
        )
      )

      registry.set(runControlAtom, { action: "pause", id })

      const paused = yield* Effect.eventually(
        Effect.sync(() => readSurface(registry, id)).pipe(
          Effect.filterOrFail(
            (state) => state.run._tag === "RunRunning" && state.run.session.control === "paused",
            () => `waiting-for-${id}-paused`
          )
        )
      )

      expect(paused.run._tag).toBe("RunRunning")
      expect(paused.run.session.control).toBe("paused")

      yield* Option.fromNullable(emitBeforeResume).pipe(
        Option.match({
          onNone: () => Effect.void,
          onSome: (emit) => emit(source, registry)
        })
      )

      registry.set(runControlAtom, { action: "resume", id })

      const resumed = yield* Effect.eventually(
        Effect.sync(() => readSurface(registry, id)).pipe(
          Effect.filterOrFail((state) => state.run._tag === "RunRunning", () => `waiting-for-${id}-resumed`)
        )
      )

      expect(resumed.run._tag).toBe("RunRunning")

      const final = yield* Effect.eventually(
        Effect.sync(() => readSurface(registry, id)).pipe(
          Effect.filterOrFail(
            (state) => state.run._tag === "RunSuccess" && registry.get(animatingAtom) === false,
            () => `waiting-for-${id}-success`
          )
        )
      )

      expect(final.run._tag).toBe("RunSuccess")
      if (final.run._tag === "RunSuccess") {
        expect(final.run.data.summary).toBe(summary)
        expect(final.run.data.sections.some((section) => section.title === summarySectionTitle)).toBe(true)
      }
    })
  )

describe("Theoria Evidence Orchestration", () => {
  it.effect("keeps every streaming surface off DemoClient.run and runWithMeta during the active run lifecycle", () =>
    withMockEventSource(
      Effect.gen(function*() {
        yield* Effect.forEach(streamingEntryIds, (id) =>
          Effect.gen(function*() {
            const registry = makeTestRegistry()
            const runCountRef = yield* Ref.make(0)
            const runWithMetaCountRef = yield* Ref.make(0)
            const runtime = makeRuntimeWithTransportCounters({ runCountRef, runWithMetaCountRef })
            const runDemoAtom = makeRunDemoAtom(runtime)
            const runControlAtom = makeRunControlAtom(runtime)

            yield* Effect.sync(() => {
              MockEventSource.instances = []
            })

            if (id === "effect-search") {
              registry.set(trialBudgetAtom, 2)
            }

            if (id === "effect-text") {
              registry.set(reflowStageViewportWidthAtom, 960)
            }

            registry.mount(runDemoAtom)
            registry.mount(runControlAtom)
            registry.set(runDemoAtom, id)

            yield* waitForSource
            yield* Effect.eventually(
              Effect.sync(() => readSurface(registry, id)).pipe(
                Effect.filterOrFail((state) => state.run._tag === "RunRunning", () => `waiting-for-${id}-running`)
              )
            )

            expect(yield* Ref.get(runCountRef)).toBe(0)
            expect(yield* Ref.get(runWithMetaCountRef)).toBe(0)

            registry.set(runControlAtom, { action: "stop", id })

            yield* Effect.eventually(
              Effect.sync(() => readSurface(registry, id)).pipe(
                Effect.filterOrFail((state) => state.run._tag === "RunIdle", () => `waiting-for-${id}-idle`)
              )
            )

            expect(yield* Ref.get(runCountRef)).toBe(0)
            expect(yield* Ref.get(runWithMetaCountRef)).toBe(0)
          }), { discard: true })
      })
    ))

  it.effect("effect-text can pause immediately after start and still resume to completion", () =>
    assertLocalDemoPauseResume({
      animatingAtom,
      emitBeforeResume: (source, registry) =>
        emitEffectTextAuthoredStream({ meta: streamMeta, registry, source, summary: "Text animation complete." }),
      id: "effect-text",
      summary: "Text animation complete.",
      summarySectionTitle: "Performance"
    }))

  it.effect("effect-math can pause immediately after start and still resume to completion", () =>
    assertLocalDemoPauseResume({
      animatingAtom: powerAnimatingAtom,
      emitBeforeResume: (source, registry) =>
        emitEffectMathAuthoredStream({ meta: streamMeta, registry, source, summary: "Power animation complete." }),
      id: "effect-math",
      summary: "Power animation complete.",
      summarySectionTitle: "Runtime Summary"
    }))

  it.effect("effect-dsp can pause immediately after start and still resume to completion", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeTestRegistry()
        const runtime = makeRuntime()
        const runDemoAtom = makeRunDemoAtom(runtime)
        const runControlAtom = makeRunControlAtom(runtime)

        registry.mount(runDemoAtom)
        registry.mount(runControlAtom)
        registry.set(runDemoAtom, "effect-dsp")

        const source = yield* waitForSource

        const running = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-dsp")).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunRunning", () => "waiting-for-effect-dsp-running")
          )
        )

        expect(running.run.session.localProjectionScript?._tag).toBe("effect-dsp")

        registry.set(runControlAtom, { action: "pause", id: "effect-dsp" })

        const paused = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-dsp")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunRunning" && state.run.session.control === "paused",
              () => "waiting-for-effect-dsp-paused"
            )
          )
        )

        expect(paused.run._tag).toBe("RunRunning")
        expect(paused.run.session.control).toBe("paused")

        if (!isEffectDspProjectionScript(running.run.session.localProjectionScript)) {
          return
        }

        source.emitEvidence(
          encodeEvidenceEventJson(
            canonicalStepEvent(
              new DspCanonicalStep({
                scenarioId: running.run.session.localProjectionScript.scenarioId,
                moduleType: running.run.session.localProjectionScript.moduleType,
                stageId: "baseline",
                stepIndex: 2,
                stepCount: 4,
                metrics: {
                  baselineAccuracy: 0.5,
                  optimizedAccuracy: null,
                  demosLearned: null,
                  improvementDelta: null
                }
              })
            )
          )
        )

        registry.set(runControlAtom, { action: "resume", id: "effect-dsp" })

        const resumed = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-dsp")).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunRunning", () => "waiting-for-effect-dsp-resumed")
          )
        )

        expect(resumed.run._tag).toBe("RunRunning")

        source.emitEvidence(
          encodeEvidenceEventJson(
            new SectionAppend({
              section: {
                title: "DSP Pause Resume",
                items: [{ _tag: "Text", label: "Stage", value: "baseline 2/4" }]
              }
            })
          )
        )
        source.emitEvidence(
          encodeEvidenceEventJson(StreamComplete.make({ summary: "DSP resumed.", meta: streamMeta }))
        )

        const final = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-dsp")).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunSuccess", () => "waiting-for-effect-dsp-success")
          )
        )

        expect(final.run._tag).toBe("RunSuccess")
        if (final.run._tag === "RunSuccess") {
          expect(final.run.data.summary).toBe("DSP resumed.")
          expect(final.run.data.sections.some((section) => section.title === "DSP Pause Resume")).toBe(true)
        }
      })
    ))

  it.effect("effect-math freezes its run plan so manual control changes do not alter the run", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeTestRegistry()
        const runtime = makeRuntime()
        const runDemoAtom = makeRunDemoAtom(runtime)
        const frozenControls = { d: 1.35, n: 77, alpha: 0.07 }

        registry.set(powerControlsAtom, frozenControls)
        registry.mount(runDemoAtom)
        registry.mount(selectStageTabAtom)
        registry.set(runDemoAtom, "effect-math")

        const source = yield* waitForSource

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-math")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunRunning" && registry.get(powerAnimatingAtom) === true,
              () => "waiting-for-effect-math-running"
            )
          )
        )

        registry.set(powerControlsAtom, { d: 0.2, n: 15, alpha: 0.02 })
        registry.set(selectStageTabAtom, { id: "effect-math", tab: "evidence" })
        expect(readSurface(registry, "effect-math").stageTab).toBe("evidence")

        yield* emitEffectMathAuthoredStream({
          meta: streamMeta,
          registry,
          source,
          summary: "Controls switched."
        })

        const final = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-math")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunSuccess" && registry.get(powerAnimatingAtom) === false,
              () => "waiting-for-effect-math-success-after-control-change"
            )
          )
        )

        expect(final.run._tag).toBe("RunSuccess")
        if (final.run._tag === "RunSuccess") {
          expect(final.run.data.summary).toBe("Controls switched.")

          const titles = final.run.data.sections.map((section) => section.title)
          const inferentialSummary = textValuesForSection(final.run.data.sections, "Inferential Summary")
          const solverStatus = textValuesForSection(final.run.data.sections, "Solver Status")
          const method = textValuesForSection(final.run.data.sections, "Method")

          expect(titles).toContain(
            `Effect Size Sensitivity — N=${frozenControls.n}, α=${frozenControls.alpha.toFixed(2)}`
          )
          expect(titles).toContain(`Power by Sample Size — α=${frozenControls.alpha.toFixed(2)}`)
          expect(titles).toContain(`Distribution Geometry — d=${frozenControls.d.toFixed(2)}`)
          expect(titles).toContain("Inferential Summary")
          expect(titles).toContain("Solver Status")
          expect(inferentialSummary.some((row) => row.startsWith("Two-sample Welch t-test: t="))).toBe(true)
          expect(inferentialSummary.some((row) => row.includes("confidence interval"))).toBe(true)
          expect(solverStatus.some((row) => row.includes("Sample-size inversion: brent"))).toBe(true)
          expect(method.some((row) => row.includes("powerForMeanDifference, sampleSizeForTargetPower"))).toBe(true)
        }

        expect(readSurface(registry, "effect-math").stageTab).toBe("evidence")
      })
    ))

  it.effect("effect-dsp freezes the manifest and projects authored frames from the shared stream", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeTestRegistry()
        const runtime = makeRuntime()
        const runDemoAtom = makeRunDemoAtom(runtime)

        registry.set(dspScenarioIdAtom, "intervention-classifier")
        registry.set(dspModuleTypeAtom, "chainOfThought")
        registry.set(dspOptimizationBudgetAtom, 2)
        registry.mount(runDemoAtom)
        registry.set(runDemoAtom, "effect-dsp")

        const source = yield* waitForSource
        const running = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-dsp")).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunRunning", () => "waiting-for-effect-dsp-running")
          )
        )

        expect(running.run.session.localProjectionScript?._tag).toBe("effect-dsp")
        const runningRunDraft = running.run.session.draft

        expect(runningRunDraft !== null && runningRunDraft.entryId === "effect-dsp").toBe(true)
        if (runningRunDraft === null || runningRunDraft.entryId !== "effect-dsp") {
          return
        }
        expect(runningRunDraft.entryId).toBe("effect-dsp")

        if (!isEffectDspProjectionScript(running.run.session.localProjectionScript)) {
          return
        }

        const frozenPlan = running.run.session.localProjectionScript
        const frozenRunDraft = runningRunDraft

        expect(frozenRunDraft.input.scenarioId).toBe(frozenPlan.scenarioId)
        expect(frozenRunDraft.input.moduleType).toBe(frozenPlan.moduleType)
        expect(frozenRunDraft.input.optimizationBudget).toBe(2)

        registry.set(dspScenarioIdAtom, "probe-follow-up")
        registry.set(dspModuleTypeAtom, "predict")
        registry.set(dspOptimizationBudgetAtom, 5)

        source.emitEvidence(
          encodeEvidenceEventJson(
            canonicalStepEvent(
              new DspCanonicalStep({
                scenarioId: frozenPlan.scenarioId,
                moduleType: frozenPlan.moduleType,
                stageId: "baseline",
                stepIndex: 2,
                stepCount: 4,
                metrics: {
                  baselineAccuracy: 0.5,
                  optimizedAccuracy: null,
                  demosLearned: null,
                  improvementDelta: null
                }
              })
            )
          )
        )
        source.emitEvidence(
          encodeEvidenceEventJson(
            new SectionAppend({
              section: {
                title: "Baseline Trace Evidence",
                items: [{ _tag: "Text", label: "Prompt", value: "[[ ## question ## ]] What is the capital of France?" }]
              }
            })
          )
        )
        source.emitEvidence(
          encodeEvidenceEventJson(
            new SectionAppend({
              section: {
                title: "Optimizer Event Evidence",
                items: [{ _tag: "Text", label: "Event", value: "RoundCompleted round=1 demosCollected=1" }]
              }
            })
          )
        )

        const withFrame = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-dsp")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunRunning" && state.run.session.localRunFrame?._tag === "effect-dsp",
              () => "waiting-for-effect-dsp-frame"
            )
          )
        )

        expect(withFrame.run.session.localProjectionScript?._tag).toBe("effect-dsp")
        expect(withFrame.run.session.draft).toEqual(frozenRunDraft)
        if (isEffectDspProjectionScript(withFrame.run.session.localProjectionScript)) {
          expect(withFrame.run.session.localProjectionScript.scenarioId).toBe(frozenPlan.scenarioId)
          expect(withFrame.run.session.localProjectionScript.moduleType).toBe(frozenPlan.moduleType)
          expect(withFrame.run.session.localProjectionScript.optimizationBudget).toBe(2)
        }
        if (isDspRunFrame(withFrame.run.session.localRunFrame)) {
          expect(withFrame.run.session.localRunFrame.stageId).toBe("baseline")
          expect(withFrame.run.session.localRunFrame.stepIndex).toBe(2)
          expect(withFrame.run.session.localRunFrame.metrics.baselineAccuracy).toBe(0.5)
        }

        source.emitEvidence(
          encodeEvidenceEventJson(StreamComplete.make({ summary: "DSP stream complete.", meta: streamMeta }))
        )

        const final = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-dsp")).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunSuccess", () => "waiting-for-effect-dsp-success")
          )
        )

        expect(final.run._tag).toBe("RunSuccess")
        if (final.run._tag === "RunSuccess") {
          expect(final.run.data.summary).toBe("DSP stream complete.")
          expect(final.run.data.sections.some((section) => section.title === "Baseline Trace Evidence")).toBe(true)
          expect(final.run.data.sections.some((section) => section.title === "Optimizer Event Evidence")).toBe(true)
        }
      })
    ))

  it.effect("effect-text freezes its execution widths so tab and viewport changes do not alter the run", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeTestRegistry()
        const runtime = makeRuntime()
        const runDemoAtom = makeRunDemoAtom(runtime)
        const frozenViewportWidthPx = 960
        const resizedViewportWidthPx = 260

        registry.set(reflowStageViewportWidthAtom, frozenViewportWidthPx)
        registry.mount(runDemoAtom)
        registry.mount(selectStageTabAtom)
        registry.set(runDemoAtom, "effect-text")

        const source = yield* waitForSource

        const running = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-text")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunRunning" && registry.get(animatingAtom) === true,
              () => "waiting-for-effect-text-running"
            )
          )
        )

        const runningRunDraft = running.run.session.draft

        expect(runningRunDraft !== null && runningRunDraft.entryId === "effect-text").toBe(true)
        if (runningRunDraft === null || runningRunDraft.entryId !== "effect-text") {
          return
        }
        expect(runningRunDraft.entryId).toBe("effect-text")
        const initialRunDraft = runningRunDraft

        expect(initialRunDraft.input.viewportWidthPx).toBe(frozenViewportWidthPx)

        registry.set(reflowStageViewportWidthAtom, resizedViewportWidthPx)
        registry.set(selectStageTabAtom, { id: "effect-text", tab: "evidence" })
        expect(readSurface(registry, "effect-text").stageTab).toBe("evidence")
        const runDraftAfterViewportChange = readSurface(registry, "effect-text").run.session.draft

        if (runDraftAfterViewportChange !== null && runDraftAfterViewportChange.entryId === "effect-text") {
          expect(runDraftAfterViewportChange.input.viewportWidthPx).toBe(frozenViewportWidthPx)
        }

        yield* emitEffectTextAuthoredStream({
          meta: streamMeta,
          registry,
          source,
          summary: "Tab switched."
        })

        const final = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-text")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunSuccess" && registry.get(animatingAtom) === false,
              () => "waiting-for-effect-text-success-after-tab-switch"
            )
          )
        )

        expect(final.run._tag).toBe("RunSuccess")
        if (final.run._tag === "RunSuccess") {
          expect(final.run.data.summary).toBe("Tab switched.")
          expect(effectTextProjectionWidths(final.run.data.sections).length).toBeGreaterThan(0)
          expect(
            effectTextProjectionWidths(final.run.data.sections).some(
              (width) => width > resolveReflowStageMaxWidth(resizedViewportWidthPx)
            )
          ).toBe(true)
        }
        expect(readSurface(registry, "effect-text").stageTab).toBe("evidence")
      })
    ))

  it.effect("effect-text fails fast when the server completes before all projection steps arrive", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeTestRegistry()
        const runtime = makeRuntime()
        const runDemoAtom = makeRunDemoAtom(runtime)

        registry.set(reflowStageViewportWidthAtom, 960)
        registry.mount(runDemoAtom)
        registry.set(runDemoAtom, "effect-text")

        const source = yield* waitForSource

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-text")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunRunning" && registry.get(animatingAtom) === true,
              () => "waiting-for-effect-text-running-before-truncated-stream"
            )
          )
        )

        source.emitEvidence(
          encodeEvidenceEventJson(StreamComplete.make({ summary: "Too short.", meta: streamMeta }))
        )

        const final = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-text")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunFailed" && registry.get(animatingAtom) === false,
              () => "waiting-for-effect-text-failure-after-truncated-stream"
            )
          )
        )

        expect(final.run._tag).toBe("RunFailed")
        if (final.run._tag === "RunFailed") {
          expect(final.run.error._tag).toBe("EntryExecutionError")

          if (final.run.error._tag === "EntryExecutionError") {
            expect(final.run.error.code).toBe("execution-failed")
            expect(final.run.error.message).toContain("before all authored projection steps arrived")
          }
        }
      })
    ))

  it.effect("effect-search can pause immediately after start and still resume to completion", () => {
    return withMockEventSource(
      Effect.gen(function*() {
        const registry = makeTestRegistry()
        registry.set(trialBudgetAtom, 30)
        const runtime = makeRuntime()

        const runDemoAtom = makeRunDemoAtom(runtime)
        const runControlAtom = makeRunControlAtom(runtime)

        registry.mount(runDemoAtom)
        registry.mount(runControlAtom)
        registry.set(runDemoAtom, "effect-search")

        const source = yield* waitForSource

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunRunning" && registry.get(optimizationAnimatingAtom),
              () => "waiting-for-running"
            )
          )
        )

        registry.set(runControlAtom, { action: "pause", id: "effect-search" })

        const paused = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunRunning" && state.run.session.control === "paused",
              () => "waiting-for-paused"
            )
          )
        )

        expect(paused.run._tag).toBe("RunRunning")
        expect(paused.run.session.control).toBe("paused")

        registry.set(trialBudgetAtom, 55)

        const frozenDuringPause = readSurface(registry, "effect-search")

        expect(frozenDuringPause.run.session.localProjectionScript?._tag).toBe("effect-search")
        if (isEffectSearchProjectionScript(frozenDuringPause.run.session.localProjectionScript)) {
          expect(frozenDuringPause.run.session.localProjectionScript.trialBudget).toBe(30)
        }

        yield* emitEffectSearchAuthoredStream({
          meta: streamMeta,
          registry,
          source,
          summary: "Paused early."
        })

        registry.set(runControlAtom, { action: "resume", id: "effect-search" })

        const resumed = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunRunning", () => "waiting-for-resumed")
          )
        )

        expect(resumed.run._tag).toBe("RunRunning")

        const final = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunSuccess" && registry.get(optimizationAnimatingAtom) === false,
              () => "waiting-for-success-after-early-pause"
            )
          )
        )

        expect(final.run._tag).toBe("RunSuccess")
        if (final.run._tag === "RunSuccess") {
          expect(final.run.data.summary).toBe("Paused early.")
          expect(final.run.data.sections.some((section) => section.title === "Trial Positions")).toBe(true)
          expect(final.run.data.sections.some((section) => section.title === "Study runtime")).toBe(true)
          expect(final.run.data.sections.some((section) => section.title === "Study event trace")).toBe(true)
          expect(final.run.session.localRunFrame?._tag).toBe("effect-search")
          if (isEffectSearchRunFrame(final.run.session.localRunFrame)) {
            expect(final.run.session.localRunFrame.telemetry.trialBudget).toBe(30)
            expect(final.run.session.localRunFrame.telemetry.tpe.completedTrials).toBe(30)
            expect(final.run.session.localRunFrame.telemetry.random.completedTrials).toBe(30)
          }
        }

        const telemetry = readRuntimeTelemetry(registry, "effect-search")
        const telemetryKinds = telemetry.events.map((event) => event.kind)
        const pauseRequestedIndex = telemetryKinds.indexOf("pause-requested")
        const checkpointReachedIndex = telemetryKinds.indexOf("checkpoint-reached")
        const finalizedIndex = telemetryKinds.indexOf("run-finalized")

        expect(telemetryKinds).toContain("pause-requested")
        expect(telemetryKinds).toContain("stream-complete-observed")
        expect(telemetryKinds).toContain("step-queue-drained")
        expect(pauseRequestedIndex).toBeGreaterThanOrEqual(0)
        expect(finalizedIndex).toBeGreaterThan(pauseRequestedIndex)
        if (checkpointReachedIndex !== -1) {
          expect(finalizedIndex).toBeGreaterThan(checkpointReachedIndex)
        }
        expect(telemetry.events[finalizedIndex]?.detail).toBe("succeeded")
      })
    )
  })

  it.effect("effect-search pause-resume survives async registry scheduling", () => {
    return withMockEventSource(
      Effect.gen(function*() {
        const registry = makeAsyncTestRegistry()
        registry.set(trialBudgetAtom, 30)
        const runtime = makeRuntime()

        const runDemoAtom = makeRunDemoAtom(runtime)
        const runControlAtom = makeRunControlAtom(runtime)

        registry.mount(runDemoAtom)
        registry.mount(runControlAtom)
        registry.set(runDemoAtom, "effect-search")

        const source = yield* waitForSource

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunRunning" && registry.get(optimizationAnimatingAtom),
              () => "waiting-for-async-running"
            )
          )
        )

        registry.set(runControlAtom, { action: "pause", id: "effect-search" })

        const paused = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunRunning" && state.run.session.control === "paused",
              () => "waiting-for-async-paused"
            )
          )
        )

        expect(paused.run._tag).toBe("RunRunning")
        expect(paused.run.session.control).toBe("paused")

        yield* emitEffectSearchAuthoredStream({
          meta: streamMeta,
          registry,
          source,
          summary: "Paused async."
        })

        registry.set(runControlAtom, { action: "resume", id: "effect-search" })

        const final = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunSuccess" && registry.get(optimizationAnimatingAtom) === false,
              () => "waiting-for-async-success"
            )
          )
        )

        expect(final.run._tag).toBe("RunSuccess")
        if (final.run._tag === "RunSuccess") {
          expect(final.run.data.summary).toBe("Paused async.")
          expect(final.run.data.sections.some((section) => section.title === "Trial Positions")).toBe(true)
        }
      })
    )
  })

  it.effect("effect-search run launched through controlRunAtom survives pause-resume under async registry scheduling", () => {
    return withMockEventSource(
      Effect.gen(function*() {
        const registry = makeAsyncTestRegistry()
        registry.set(trialBudgetAtom, 30)
        const runtime = makeRuntime()
        const runControlAtom = makeRunControlAtom(runtime)

        registry.mount(runControlAtom)
        registry.set(runControlAtom, { action: "run", id: "effect-search" })

        const source = yield* waitForSource

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunRunning" && registry.get(optimizationAnimatingAtom),
              () => "waiting-for-control-run-running"
            )
          )
        )

        registry.set(runControlAtom, { action: "pause", id: "effect-search" })

        const paused = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunRunning" && state.run.session.control === "paused",
              () => "waiting-for-control-run-paused"
            )
          )
        )

        expect(paused.run._tag).toBe("RunRunning")
        expect(paused.run.session.control).toBe("paused")

        yield* emitEffectSearchAuthoredStream({
          meta: streamMeta,
          registry,
          source,
          summary: "Control atom paused async."
        })

        registry.set(runControlAtom, { action: "resume", id: "effect-search" })

        const final = yield* Effect.raceFirst(
          Effect.eventually(
            Effect.sync(() => readSurface(registry, "effect-search")).pipe(
              Effect.filterOrFail(
                (state) => state.run._tag === "RunSuccess" && registry.get(optimizationAnimatingAtom) === false,
                () => "waiting-for-control-run-success"
              )
            )
          ),
          Effect.sleep("5 seconds").pipe(Effect.zipRight(Effect.die("timed-out-control-run-success")))
        )

        expect(final.run._tag).toBe("RunSuccess")
        if (final.run._tag === "RunSuccess") {
          expect(final.run.data.summary).toBe("Control atom paused async.")
          expect(final.run.data.sections.some((section) => section.title === "Trial Positions")).toBe(true)
        }

        const telemetry = readRuntimeTelemetry(registry, "effect-search")
        const telemetryKinds = telemetry.events.map((event) => event.kind)

        expect(telemetryKinds).toContain("run-started")
        expect(telemetryKinds).toContain("pause-requested")
        expect(telemetryKinds).toContain("resume-requested")
        expect(telemetryKinds).toContain("stream-complete-observed")
        expect(telemetryKinds).toContain("step-queue-drained")
        expect(telemetryKinds).toContain("run-finalized")
      })
    )
  })

  it.effect("effect-search success merges server evidence and local animation into the authoritative run stream", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeTestRegistry()
        registry.set(trialBudgetAtom, 2)
        const runtime = makeRuntime()
        const runDemoAtom = makeRunDemoAtom(runtime)

        registry.mount(runDemoAtom)
        registry.set(runDemoAtom, "effect-search")

        const source = yield* waitForSource

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunRunning" && registry.get(optimizationAnimatingAtom),
              () => "waiting-for-running"
            )
          )
        )

        yield* emitEffectSearchAuthoredStream({
          extraSections: [{
            title: "Server Results",
            items: [{ _tag: "Text", label: "Status", value: "streaming" }]
          }],
          meta: streamMeta,
          registry,
          source,
          summary: "Server done."
        })

        const final = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunSuccess", () => "waiting-for-success")
          )
        )

        yield* Effect.eventually(
          Effect.sync(() => registry.get(optimizationAnimatingAtom)).pipe(
            Effect.filterOrFail((active) => active === false, () => "waiting-for-animation-reset")
          )
        )

        expect(final.run._tag).toBe("RunSuccess")
        if (final.run._tag === "RunSuccess") {
          expect(final.run.session.facts.streamComplete.state).toBe("observed")
          expect(final.run.session.facts.stepQueueDrain.state).toBe("observed")
          expect(final.run.data.summary).toBe("Server done.")
          expect(final.run.meta?.requestId).toBe("req-sse")
          expect(readEvidenceStream(registry, "effect-search").complete).toBe(true)
          expect(readEvidenceStream(registry, "effect-search").summary).toBe("Server done.")
          expect(final.run.data.sections.some((section) => section.title === "Server Results")).toBe(true)
          expect(final.run.data.sections.some((section) => section.title === "Runtime Summary")).toBe(true)
          expect(final.run.data.sections.some((section) => section.title === "Study runtime")).toBe(true)
          expect(final.run.data.sections.some((section) => section.title === "Study event trace")).toBe(true)
          expect(final.run.data.sections.length).toBeGreaterThan(1)
        }
      })
    ))

  it.effect("effect-search makes server evidence visible before local projection work drains", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeTestRegistry()
        registry.set(trialBudgetAtom, 2)
        const runtime = makeRuntime()
        const runDemoAtom = makeRunDemoAtom(runtime)

        registry.mount(runDemoAtom)
        registry.set(runDemoAtom, "effect-search")

        const source = yield* waitForSource

        yield* Effect.eventually(
          Effect.sync(() => registry.get(optimizationAnimatingAtom)).pipe(
            Effect.filterOrFail((active) => active, () => "waiting-for-server-evidence-animation")
          )
        )

        yield* Effect.sync(() => {
          source.emitEvidence(
            encodeEvidenceEventJson(
              new SectionAppend({
                section: {
                  title: "Immediate Server Evidence",
                  items: [{ _tag: "Text", label: "Proof", value: "visible-before-local-drain" }]
                }
              })
            )
          )
        })

        yield* Effect.eventually(
          Effect.sync(() => ({
            animating: registry.get(optimizationAnimatingAtom),
            sections: registry.get(surfaceEvidenceSectionsAtom("effect-search")),
            surface: readSurface(registry, "effect-search")
          })).pipe(
            Effect.filterOrFail(
              ({ animating, sections, surface }) =>
                animating
                && surface.run._tag === "RunRunning"
                && sections.some((section) => section.title === "Immediate Server Evidence"),
              () => "waiting-for-immediate-server-evidence"
            )
          )
        )

        yield* emitEffectSearchAuthoredStream({
          meta: streamMeta,
          registry,
          source,
          summary: "Immediate server evidence."
        })

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunSuccess",
              () => "waiting-for-immediate-evidence-success"
            )
          )
        )
      })
    ))

  it.effect("effect-search projects the first authored canonical step without browser pacing", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeTestRegistry()
        registry.set(trialBudgetAtom, 2)
        const runtime = makeRuntime()
        const runDemoAtom = makeRunDemoAtom(runtime)

        registry.mount(runDemoAtom)
        registry.set(runDemoAtom, "effect-search")

        const source = yield* waitForSource

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunRunning" && registry.get(optimizationAnimatingAtom),
              () => "waiting-for-effect-search-reactor-running"
            )
          )
        )

        const tpeTrials: ReadonlyArray<{
          readonly index: number
          readonly value: number
          readonly x: number
          readonly y: number
        }> = [{ index: 0, value: 0.125, x: 1.5, y: -0.5 }]
        const randomTrials: ReadonlyArray<{
          readonly index: number
          readonly value: number
          readonly x: number
          readonly y: number
        }> = [{ index: 0, value: 0.75, x: -2.1, y: 2.2 }]

        yield* Effect.sync(() => {
          source.emitEvidence(
            encodeEvidenceEventJson(
              canonicalStepEvent(
                new EffectSearchCanonicalStep({
                  trialBudget: 2,
                  phase: "running",
                  tpeTrials,
                  randomTrials,
                  telemetry: projectEffectSearchStudyTelemetry({
                    randomEvents: [],
                    randomTrialPoints: randomTrials,
                    trialBudget: 2,
                    tpeEvents: [],
                    tpeTrialPoints: tpeTrials
                  })
                })
              )
            )
          )
        })

        const projected = yield* Effect.eventually(
          Effect.sync(() => ({
            surface: readSurface(registry, "effect-search"),
            viewModel: registry.get(optimizationWidgetViewModelAtom)
          })).pipe(
            Effect.filterOrFail(
              ({ surface, viewModel }) =>
                surface.run._tag === "RunRunning"
                && viewModel.projection.tpeTrials.length === 1
                && viewModel.projection.randomTrials.length === 1,
              () => "waiting-for-effect-search-first-frame"
            )
          )
        )

        expect(projected.surface.run._tag).toBe("RunRunning")
        expect(projected.viewModel.isAnimating).toBe(true)
        expect(projected.viewModel.projection.tpeTrials[0]?.value).toBe(0.125)
        expect(projected.viewModel.projection.randomTrials[0]?.value).toBe(0.75)
      })
    ))

  it.effect("effect-search can drain projection work before the stream completes and still finalize only after the stream closes", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeTestRegistry()
        registry.set(trialBudgetAtom, 1)
        const runtime = makeRuntime()
        const runDemoAtom = makeRunDemoAtom(runtime)

        registry.mount(runDemoAtom)
        registry.set(runDemoAtom, "effect-search")

        const source = yield* waitForSource

        yield* emitEffectSearchAuthoredStream({
          includeComplete: false,
          meta: streamMeta,
          registry,
          source,
          summary: "Server after local."
        })

        const awaitingServer = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) =>
                state.run._tag === "RunRunning"
                && state.run.session.facts.stepQueueDrain.state === "observed"
                && state.run.session.facts.streamComplete.state === "pending"
                && registry.get(optimizationAnimatingAtom) === false,
              () => "waiting-for-local-before-server"
            )
          )
        )

        expect(awaitingServer.run._tag).toBe("RunRunning")
        const preServerStream = readEvidenceStream(registry, "effect-search")
        const preServerWidget = registry.get(optimizationWidgetViewModelAtom)
        expect(preServerStream.complete).toBe(false)
        expect(preServerStream.sections.some((section) => section.title === "Runtime Summary")).toBe(true)
        expect(preServerWidget.controlsLocked).toBe(true)
        expect(preServerWidget.isAnimating).toBe(true)

        source.emitEvidence(
          encodeEvidenceEventJson(StreamComplete.make({ summary: "Server after local.", meta: streamMeta }))
        )

        const final = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunSuccess",
              () => "waiting-for-local-before-server-success"
            )
          )
        )

        expect(final.run._tag).toBe("RunSuccess")
        if (final.run._tag === "RunSuccess") {
          expect(final.run.session.facts.streamComplete.state).toBe("observed")
          expect(final.run.session.facts.stepQueueDrain.state).toBe("observed")
          expect(final.run.data.summary).toBe("Server after local.")
        }

        const telemetry = readRuntimeTelemetry(registry, "effect-search")

        expect(telemetry.events.map((event) => event.kind)).toEqual([
          "run-started",
          "step-queue-drained",
          "stream-complete-observed",
          "run-finalized"
        ])
        expect(telemetry.events[3]?.detail).toBe("succeeded")
      })
    ))

  it.effect("effect-search can finalize while paused once projection work is drained and stream completion arrives", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeTestRegistry()
        registry.set(trialBudgetAtom, 1)
        const runtime = makeRuntime()
        const runDemoAtom = makeRunDemoAtom(runtime)
        const runControlAtom = makeRunControlAtom(runtime)

        registry.mount(runDemoAtom)
        registry.mount(runControlAtom)
        registry.set(runDemoAtom, "effect-search")

        const source = yield* waitForSource

        yield* emitEffectSearchAuthoredStream({
          includeComplete: false,
          meta: streamMeta,
          registry,
          source,
          summary: "Server while paused."
        })

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) =>
                state.run._tag === "RunRunning"
                && state.run.session.facts.stepQueueDrain.state === "observed"
                && state.run.session.facts.streamComplete.state === "pending"
                && registry.get(optimizationAnimatingAtom) === false,
              () => "waiting-for-local-complete-before-pause"
            )
          )
        )

        registry.set(runControlAtom, { action: "pause", id: "effect-search" })

        const paused = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) =>
                state.run._tag === "RunRunning"
                && state.run.session.control === "paused"
                && state.run.session.facts.stepQueueDrain.state === "observed"
                && state.run.session.facts.streamComplete.state === "pending",
              () => "waiting-for-paused-awaiting-server"
            )
          )
        )

        expect(paused.run._tag).toBe("RunRunning")
        expect(paused.run.session.control).toBe("paused")

        source.emitEvidence(
          encodeEvidenceEventJson(StreamComplete.make({ summary: "Server while paused.", meta: streamMeta }))
        )

        const final = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunSuccess",
              () => "waiting-for-paused-success-without-resume"
            )
          )
        )

        expect(final.run._tag).toBe("RunSuccess")
        if (final.run._tag === "RunSuccess") {
          expect(final.run.data.summary).toBe("Server while paused.")
          expect(final.run.session.facts.streamComplete.state).toBe("observed")
          expect(final.run.session.facts.stepQueueDrain.state).toBe("observed")
        }
      })
    ))

  it.effect("effect-search coalesces trial-position transcript publishes while preserving the final evidence rows", () => {
    const previousEventSource = globalThis.EventSource
    const trialBudget = 30

    return Effect.gen(function*() {
      yield* Effect.sync(() => {
        MockEventSource.instances = []
        Reflect.set(globalThis, "EventSource", MockEventSource)
      })

      const registry = makeTestRegistry()
      const livePublishedTrialCounts: { current: ReadonlyArray<number> } = { current: [] }
      const liveMaxRowCount = { current: 0 }
      const unsubscribe = registry.subscribe(
        surfaceEvidenceSectionsAtom("effect-search"),
        (sections) => {
          firstTrialPositionRowCount(sections).pipe(
            Option.match({
              onNone: () => undefined,
              onSome: (count) => {
                liveMaxRowCount.current = Math.max(liveMaxRowCount.current, count)
                livePublishedTrialCounts.current =
                  livePublishedTrialCounts.current[livePublishedTrialCounts.current.length - 1] === count
                    ? livePublishedTrialCounts.current
                    : [...livePublishedTrialCounts.current, count]
              }
            })
          )
        },
        { immediate: true }
      )

      registry.set(trialBudgetAtom, trialBudget)
      const runtime = makeAppClientTestRuntime({
        run: () => Effect.fail(errorFixture),
        runWithMeta: () => Effect.fail(errorFixture),
        preload: () => Effect.succeed(programPreviewFixture)
      })

      const runDemoAtom = makeRunDemoAtom(runtime)

      registry.mount(runDemoAtom)
      registry.set(runDemoAtom, "effect-search")

      const source = yield* waitForSource

      yield* emitEffectSearchAuthoredStream({
        meta: streamMeta,
        registry,
        source,
        summary: "Coalesced."
      })

      yield* Effect.eventually(
        Effect.sync(() => livePublishedTrialCounts.current).pipe(
          Effect.filterOrFail(
            (counts) => counts.length >= 2 && (counts[counts.length - 1] ?? 0) >= optimizationEvidenceLiveRowWindow,
            () => "waiting-for-windowed-trial-publications"
          )
        )
      )

      const final = yield* Effect.eventually(
        Effect.sync(() => readSurface(registry, "effect-search")).pipe(
          Effect.filterOrFail(
            (state) => state.run._tag === "RunSuccess" && registry.get(optimizationAnimatingAtom) === false,
            () => "waiting-for-coalesced-success"
          )
        )
      )

      expect(final.run._tag).toBe("RunSuccess")
      if (final.run._tag === "RunSuccess") {
        const counts = livePublishedTrialCounts.current
        const windowedCounts = counts.slice(0, -1)
        const finalTables = trialPositionsTables(final.run.data.sections)

        expect(counts[0]).toBe(1)
        expect(counts[counts.length - 1]).toBe(trialBudget)
        expect(counts.length).toBeLessThanOrEqual(1 + Math.ceil(trialBudget / optimizationEvidenceBatchSize))
        expect(windowedCounts.every((count) => count <= optimizationEvidenceLiveRowWindow)).toBe(true)
        expect(windowedCounts.some((count) => count === optimizationEvidenceLiveRowWindow)).toBe(true)
        expect(liveMaxRowCount.current).toBe(trialBudget)
        expect(Option.isSome(finalTables)).toBe(true)
        if (Option.isSome(finalTables)) {
          expect(finalTables.value.length).toBe(2)
          expect(finalTables.value.every((table) => table.rows.length === trialBudget)).toBe(true)
        }
      }

      unsubscribe()
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          MockEventSource.instances = []
          Reflect.set(globalThis, "EventSource", previousEventSource)
        })
      )
    )
  })

  it.effect("unexpected SSE errors fail the run and clear animation state after partial results", () => {
    const previousEventSource = globalThis.EventSource

    return Effect.gen(function*() {
      yield* Effect.sync(() => {
        MockEventSource.instances = []
        Reflect.set(globalThis, "EventSource", MockEventSource)
      })

      const registry = makeTestRegistry()
      registry.set(trialBudgetAtom, 8)
      const runtime = makeAppClientTestRuntime({
        run: () => Effect.fail(errorFixture),
        runWithMeta: () => Effect.fail(errorFixture),
        preload: () => Effect.succeed(programPreviewFixture)
      })

      const runDemoAtom = makeRunDemoAtom(runtime)

      registry.mount(runDemoAtom)
      registry.set(runDemoAtom, "effect-search")

      const source = yield* waitForSource
      yield* Effect.eventually(
        Effect.sync(() => registry.get(optimizationAnimatingAtom)).pipe(
          Effect.filterOrFail((active) => active, () => "waiting-for-animation")
        )
      )

      yield* emitEffectSearchAuthoredStream({
        extraSections: [{
          title: "Partial Results",
          items: [{ _tag: "Text", label: "Status", value: "partial" }]
        }],
        includeAnimationSummary: false,
        includeComplete: false,
        meta: streamMeta,
        registry,
        source,
        stepCount: optimizationEvidenceBatchSize,
        summary: "Unused."
      })
      source.emitError()

      const final = yield* Effect.eventually(
        Effect.sync(() => readSurface(registry, "effect-search")).pipe(
          Effect.filterOrFail(
            (state) => state.run._tag === "RunFailed" && registry.get(optimizationAnimatingAtom) === false,
            () => "waiting-for-failure"
          )
        )
      )

      expect(final.run._tag).toBe("RunFailed")
      if (final.run._tag === "RunFailed") {
        const stream = readEvidenceStream(registry, "effect-search")
        expect(stream.sections.some((section) => section.title === "Partial Results")).toBe(true)
        expect(stream.sections.some((section) => section.title === "Trial Positions")).toBe(true)
        expect(final.run.error.message).toContain("completion metadata")
      }
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          MockEventSource.instances = []
          Reflect.set(globalThis, "EventSource", previousEventSource)
        })
      )
    )
  })
})
