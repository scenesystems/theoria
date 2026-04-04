import { Atom, Registry } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"

import { DspCanonicalStep } from "../../app/contracts/demo/dsp-runtime.js"
import { EffectTextProjectionStep } from "../../app/contracts/demo/text.js"
import { encodeEvidenceEventJson, SectionAppend, Step, StreamComplete } from "../../app/contracts/evidence-stream.js"
import type { EvidenceItem, EvidenceSection } from "../../app/contracts/evidence.js"
import { makeRunControlAtom, makeRunDemoAtom, selectStageTabAtom } from "../../app/web/atoms/actions.js"
import { animatingAtom } from "../../app/web/atoms/animation.js"
import {
  dspModuleTypeIndexAtom,
  dspOptimizationBudgetAtom,
  dspScenarioIndexAtom
} from "../../app/web/atoms/dsp-widget.js"
import { optimizationAnimatingAtom, trialBudgetAtom } from "../../app/web/atoms/optimization-animation.js"
import {
  optimizationEvidenceBatchSize,
  optimizationEvidenceLiveRowWindow
} from "../../app/web/atoms/optimization-evidence.js"
import { powerAnimatingAtom, powerControlsAtom } from "../../app/web/atoms/power-animation.js"
import { reflowStageViewportWidthAtom, resolveReflowStageMaxWidth } from "../../app/web/atoms/reflow.js"
import {
  surfaceAtom,
  surfaceEvidenceSectionsAtom,
  surfaceEvidenceStreamAtom,
  surfaceRunRuntimeTelemetryAtom
} from "../../app/web/atoms/surface.js"
import { DemoClient } from "../../app/web/services/DemoClient.js"
import type { SurfaceState } from "../../app/web/state/types.js"
import { errorFixture, programPreviewFixture } from "../helpers/demo-fixtures.js"

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

const readSurface = (registry: Registry.Registry, id: string): SurfaceState => registry.get(surfaceAtom(id))
const readEvidenceStream = (registry: Registry.Registry, id: string) => registry.get(surfaceEvidenceStreamAtom(id))
const readRuntimeTelemetry = (registry: Registry.Registry, id: string) =>
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
    section.title.endsWith("— live projections")
      ? section.items.flatMap((item) =>
        isTableItem(item)
          ? item.rows.flatMap((row) => {
            const width = Number(row[1])
            return Number.isFinite(width) ? [width] : []
          })
          : []
      )
      : []
  )

const tableRowsForSection = (
  sections: ReadonlyArray<EvidenceSection>,
  title: string
): ReadonlyArray<ReadonlyArray<string>> =>
  sections.flatMap((section) =>
    section.title === title
      ? section.items.flatMap((item) => (isTableItem(item) ? item.rows : []))
      : []
  )

const streamMeta = {
  requestId: "req-sse",
  buildSha: "build-sse",
  durationMs: 7
}

const emitEffectTextProjectionSteps = (
  registry: Registry.Registry,
  source: MockEventSource,
  id: "effect-text" = "effect-text"
): Effect.Effect<void, never, never> =>
  Effect.gen(function*() {
    const run = readSurface(registry, id).run

    if (run.session.localRunPlan === null || run.session.localRunPlan._tag !== "effect-text") {
      return
    }

    const projectionSteps = run.session.localRunPlan.entries.flatMap((entry) =>
      entry.steps.map((planStep) =>
        new EffectTextProjectionStep({
          corpusIndex: entry.corpusIndex,
          requestedWidthPx: planStep.requestedWidthPx,
          stageWidthPx: planStep.stageWidthPx,
          obstaclesEnabled: planStep.obstaclesEnabled
        })
      )
    )

    yield* Effect.forEach(
      projectionSteps,
      (step) =>
        Effect.sync(() => {
          source.emitEvidence(encodeEvidenceEventJson(new Step({ step })))
        }),
      { discard: true }
    )
  })

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
  Atom.runtime(
    Layer.succeed(
      DemoClient,
      DemoClient.make({
        run: () => Effect.fail(errorFixture),
        runWithMeta: () => Effect.fail(errorFixture),
        preload: () => Effect.succeed(programPreviewFixture),
        versions: () => Effect.succeed({}),
        streamUrl: (id) => `/api/demos/${id}/stream`
      })
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
          Effect.filterOrFail((state) => state.run._tag === "RunPaused", () => `waiting-for-${id}-paused`)
        )
      )

      expect(paused.run._tag).toBe("RunPaused")

      yield* Option.fromNullable(emitBeforeResume).pipe(
        Option.match({
          onNone: () => Effect.void,
          onSome: (emit) => emit(source, registry)
        })
      )

      source.emitEvidence(encodeEvidenceEventJson(new StreamComplete({ summary, meta: streamMeta })))

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
  it.effect("effect-text can pause immediately after start and still resume to completion", () =>
    assertLocalDemoPauseResume({
      animatingAtom,
      emitBeforeResume: (source, registry) => emitEffectTextProjectionSteps(registry, source),
      id: "effect-text",
      summary: "Text animation complete.",
      summarySectionTitle: "Animation Summary"
    }))

  it.effect("effect-math can pause immediately after start and still resume to completion", () =>
    assertLocalDemoPauseResume({
      animatingAtom: powerAnimatingAtom,
      id: "effect-math",
      summary: "Power animation complete.",
      summarySectionTitle: "Animation Summary"
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

        expect(running.run.session.localRunPlan?._tag).toBe("effect-dsp")

        registry.set(runControlAtom, { action: "pause", id: "effect-dsp" })

        const paused = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-dsp")).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunPaused", () => "waiting-for-effect-dsp-paused")
          )
        )

        expect(paused.run._tag).toBe("RunPaused")

        if (running.run.session.localRunPlan === null || running.run.session.localRunPlan._tag !== "effect-dsp") {
          return
        }

        source.emitEvidence(
          encodeEvidenceEventJson(
            new Step({
              step: new DspCanonicalStep({
                scenarioId: running.run.session.localRunPlan.scenarioId,
                moduleType: running.run.session.localRunPlan.moduleType,
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
            })
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
        source.emitEvidence(encodeEvidenceEventJson(new StreamComplete({ summary: "DSP resumed.", meta: streamMeta })))

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

        source.emitEvidence(
          encodeEvidenceEventJson(new StreamComplete({ summary: "Controls switched.", meta: streamMeta }))
        )

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

          const phase1Rows = tableRowsForSection(
            final.run.data.sections,
            `Effect size sweep — N=${frozenControls.n}, α=${frozenControls.alpha.toFixed(2)}`
          )
          const phase2Rows = tableRowsForSection(
            final.run.data.sections,
            `Sample size sweep — d=${frozenControls.d.toFixed(2)}, α=${frozenControls.alpha.toFixed(2)}`
          )

          expect(phase1Rows.length).toBeGreaterThan(0)
          expect(
            phase1Rows.every((row) => row[1] === `${frozenControls.n}` && row[2] === frozenControls.alpha.toFixed(2))
          ).toBe(true)
          expect(phase2Rows.length).toBeGreaterThan(0)
          expect(
            phase2Rows.every((row) =>
              row[0] === frozenControls.d.toFixed(2) && row[2] === frozenControls.alpha.toFixed(2)
            )
          ).toBe(true)
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

        registry.set(dspScenarioIndexAtom, 0)
        registry.set(dspModuleTypeIndexAtom, 0)
        registry.set(dspOptimizationBudgetAtom, 2)
        registry.mount(runDemoAtom)
        registry.set(runDemoAtom, "effect-dsp")

        const source = yield* waitForSource
        const running = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-dsp")).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunRunning", () => "waiting-for-effect-dsp-running")
          )
        )

        expect(running.run.session.localRunPlan?._tag).toBe("effect-dsp")

        if (running.run.session.localRunPlan === null || running.run.session.localRunPlan._tag !== "effect-dsp") {
          return
        }

        const frozenPlan = running.run.session.localRunPlan

        registry.set(dspScenarioIndexAtom, 2)
        registry.set(dspModuleTypeIndexAtom, 1)
        registry.set(dspOptimizationBudgetAtom, 5)

        source.emitEvidence(
          encodeEvidenceEventJson(
            new Step({
              step: new DspCanonicalStep({
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
            })
          )
        )
        source.emitEvidence(
          encodeEvidenceEventJson(
            new SectionAppend({
              section: {
                title: "DSP Stream Snapshot",
                items: [{ _tag: "Text", label: "Stage", value: "baseline 2/4" }]
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

        expect(withFrame.run.session.localRunPlan?._tag).toBe("effect-dsp")
        if (withFrame.run.session.localRunPlan !== null && withFrame.run.session.localRunPlan._tag === "effect-dsp") {
          expect(withFrame.run.session.localRunPlan.scenarioId).toBe(frozenPlan.scenarioId)
          expect(withFrame.run.session.localRunPlan.moduleType).toBe(frozenPlan.moduleType)
          expect(withFrame.run.session.localRunPlan.optimizationBudget).toBe(2)
        }
        if (withFrame.run.session.localRunFrame !== null && withFrame.run.session.localRunFrame._tag === "effect-dsp") {
          expect(withFrame.run.session.localRunFrame.stageId).toBe("baseline")
          expect(withFrame.run.session.localRunFrame.stepIndex).toBe(2)
          expect(withFrame.run.session.localRunFrame.metrics.baselineAccuracy).toBe(0.5)
        }

        source.emitEvidence(
          encodeEvidenceEventJson(new StreamComplete({ summary: "DSP stream complete.", meta: streamMeta }))
        )

        const final = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-dsp")).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunSuccess", () => "waiting-for-effect-dsp-success")
          )
        )

        expect(final.run._tag).toBe("RunSuccess")
        if (final.run._tag === "RunSuccess") {
          expect(final.run.data.summary).toBe("DSP stream complete.")
          expect(final.run.data.sections.some((section) => section.title === "DSP Stream Snapshot")).toBe(true)
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

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-text")).pipe(
            Effect.filterOrFail(
              (state) => state.run._tag === "RunRunning" && registry.get(animatingAtom) === true,
              () => "waiting-for-effect-text-running"
            )
          )
        )

        registry.set(reflowStageViewportWidthAtom, resizedViewportWidthPx)
        registry.set(selectStageTabAtom, { id: "effect-text", tab: "evidence" })
        expect(readSurface(registry, "effect-text").stageTab).toBe("evidence")

        yield* emitEffectTextProjectionSteps(registry, source)
        source.emitEvidence(encodeEvidenceEventJson(new StreamComplete({ summary: "Tab switched.", meta: streamMeta })))

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

        source.emitEvidence(encodeEvidenceEventJson(new StreamComplete({ summary: "Too short.", meta: streamMeta })))

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
          expect(final.run.error._tag).toBe("DemoExecutionError")

          if (final.run.error._tag === "DemoExecutionError") {
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
            Effect.filterOrFail((state) => state.run._tag === "RunPaused", () => "waiting-for-paused")
          )
        )

        expect(paused.run._tag).toBe("RunPaused")

        source.emitEvidence(encodeEvidenceEventJson(new StreamComplete({ summary: "Paused early.", meta: streamMeta })))

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
        }

        const telemetry = readRuntimeTelemetry(registry, "effect-search")
        const telemetryKinds = telemetry.events.map((event) => event.kind)
        const pauseRequestedIndex = telemetryKinds.indexOf("pause-requested")
        const checkpointReachedIndex = telemetryKinds.indexOf("checkpoint-reached")
        const finalizedIndex = telemetryKinds.indexOf("run-finalized")

        expect(telemetryKinds).toContain("pause-requested")
        expect(telemetryKinds).toContain("server-completed")
        expect(telemetryKinds).toContain("local-completed")
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
            Effect.filterOrFail((state) => state.run._tag === "RunPaused", () => "waiting-for-async-paused")
          )
        )

        expect(paused.run._tag).toBe("RunPaused")

        source.emitEvidence(encodeEvidenceEventJson(new StreamComplete({ summary: "Paused async.", meta: streamMeta })))

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
              (state) => state.run._tag === "RunPaused",
              () => "waiting-for-control-run-paused"
            )
          )
        )

        expect(paused.run._tag).toBe("RunPaused")

        source.emitEvidence(
          encodeEvidenceEventJson(new StreamComplete({ summary: "Control atom paused async.", meta: streamMeta }))
        )

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
        expect(telemetryKinds).toContain("server-completed")
        expect(telemetryKinds).toContain("local-completed")
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

        source.emitEvidence(
          encodeEvidenceEventJson(
            new SectionAppend({
              section: {
                title: "Server Results",
                items: [{ _tag: "Text", label: "Status", value: "streaming" }]
              }
            })
          )
        )
        source.emitEvidence(encodeEvidenceEventJson(new StreamComplete({ summary: "Server done.", meta: streamMeta })))

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
          expect(final.run.session.completion.server.state).toBe("completed")
          expect(final.run.session.completion.local.state).toBe("completed")
          expect(final.run.data.summary).toBe("Server done.")
          expect(final.run.meta?.requestId).toBe("req-sse")
          expect(readEvidenceStream(registry, "effect-search").complete).toBe(true)
          expect(readEvidenceStream(registry, "effect-search").summary).toBe("Server done.")
          expect(final.run.data.sections.some((section) => section.title === "Server Results")).toBe(true)
          expect(final.run.data.sections.some((section) => section.title === "Animation Summary")).toBe(true)
          expect(final.run.data.sections.length).toBeGreaterThan(1)
        }
      })
    ))

  it.effect("effect-search can finish local work before the server and still finalize only after server completion", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeTestRegistry()
        registry.set(trialBudgetAtom, 1)
        const runtime = makeRuntime()
        const runDemoAtom = makeRunDemoAtom(runtime)

        registry.mount(runDemoAtom)
        registry.set(runDemoAtom, "effect-search")

        const source = yield* waitForSource

        const awaitingServer = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) =>
                state.run._tag === "RunRunning"
                && state.run.session.completion.local.state === "completed"
                && state.run.session.completion.server.state === "pending"
                && registry.get(optimizationAnimatingAtom) === false,
              () => "waiting-for-local-before-server"
            )
          )
        )

        expect(awaitingServer.run._tag).toBe("RunRunning")
        const preServerStream = readEvidenceStream(registry, "effect-search")
        expect(preServerStream.complete).toBe(false)
        expect(preServerStream.sections.some((section) => section.title === "Animation Summary")).toBe(true)

        source.emitEvidence(
          encodeEvidenceEventJson(new StreamComplete({ summary: "Server after local.", meta: streamMeta }))
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
          expect(final.run.session.completion.server.state).toBe("completed")
          expect(final.run.session.completion.local.state).toBe("completed")
          expect(final.run.data.summary).toBe("Server after local.")
        }

        const telemetry = readRuntimeTelemetry(registry, "effect-search")

        expect(telemetry.events.map((event) => event.kind)).toEqual([
          "run-started",
          "local-completed",
          "server-completed",
          "run-finalized"
        ])
        expect(telemetry.events[3]?.detail).toBe("succeeded")
      })
    ))

  it.effect("effect-search can finalize while paused once local work is done and server completion arrives", () =>
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

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-search")).pipe(
            Effect.filterOrFail(
              (state) =>
                state.run._tag === "RunRunning"
                && state.run.session.completion.local.state === "completed"
                && state.run.session.completion.server.state === "pending"
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
                state.run._tag === "RunPaused"
                && state.run.session.completion.local.state === "completed"
                && state.run.session.completion.server.state === "pending",
              () => "waiting-for-paused-awaiting-server"
            )
          )
        )

        expect(paused.run._tag).toBe("RunPaused")

        source.emitEvidence(
          encodeEvidenceEventJson(new StreamComplete({ summary: "Server while paused.", meta: streamMeta }))
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
          expect(final.run.session.completion.server.state).toBe("completed")
          expect(final.run.session.completion.local.state).toBe("completed")
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
      const runtime = Atom.runtime(
        Layer.succeed(
          DemoClient,
          DemoClient.make({
            run: () => Effect.fail(errorFixture),
            runWithMeta: () => Effect.fail(errorFixture),
            preload: () => Effect.succeed(programPreviewFixture),
            versions: () => Effect.succeed({}),
            streamUrl: (id) => `/api/demos/${id}/stream`
          })
        )
      )

      const runDemoAtom = makeRunDemoAtom(runtime)

      registry.mount(runDemoAtom)
      registry.set(runDemoAtom, "effect-search")

      const source = yield* waitForSource

      yield* Effect.eventually(
        Effect.sync(() => livePublishedTrialCounts.current).pipe(
          Effect.filterOrFail(
            (counts) => counts.length >= 2 && (counts[counts.length - 1] ?? 0) >= optimizationEvidenceLiveRowWindow,
            () => "waiting-for-windowed-trial-publications"
          )
        )
      )

      source.emitEvidence(encodeEvidenceEventJson(new StreamComplete({ summary: "Coalesced.", meta: streamMeta })))

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
      const runtime = Atom.runtime(
        Layer.succeed(
          DemoClient,
          DemoClient.make({
            run: () => Effect.fail(errorFixture),
            runWithMeta: () => Effect.fail(errorFixture),
            preload: () => Effect.succeed(programPreviewFixture),
            versions: () => Effect.succeed({}),
            streamUrl: (id) => `/api/demos/${id}/stream`
          })
        )
      )

      const runDemoAtom = makeRunDemoAtom(runtime)

      registry.mount(runDemoAtom)
      registry.set(runDemoAtom, "effect-search")

      const source = yield* waitForSource
      yield* Effect.eventually(
        Effect.sync(() => registry.get(optimizationAnimatingAtom)).pipe(
          Effect.filterOrFail((active) => active, () => "waiting-for-animation")
        )
      )

      source.emitEvidence(
        encodeEvidenceEventJson(
          new SectionAppend({
            section: {
              title: "Partial Results",
              items: [{ _tag: "Text", label: "Status", value: "partial" }]
            }
          })
        )
      )
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
