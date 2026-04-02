import { Atom, Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"

import { DspCanonicalStep } from "../../app/contracts/demo/dsp-runtime.js"
import { EffectTextProjectionStep } from "../../app/contracts/demo/text.js"
import { encodeEvidenceEventJson, SectionAppend, Step, StreamComplete } from "../../app/contracts/evidence-stream.js"
import { makeRunControlAtom } from "../../app/web/atoms/actions.js"
import { animatingAtom } from "../../app/web/atoms/animation.js"
import { powerAnimatingAtom } from "../../app/web/atoms/power-animation.js"
import { reflowStageViewportWidthAtom } from "../../app/web/atoms/reflow.js"
import { surfaceAtom, surfaceRunRuntimeTelemetryAtom } from "../../app/web/atoms/surface.js"
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
}

const streamMeta = {
  requestId: "req-sse",
  buildSha: "build-sse",
  durationMs: 7
}

const makeAsyncTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      queueMicrotask(f)
    }
  })

const readSurface = (registry: Registry.Registry, id: string): SurfaceState => registry.get(surfaceAtom(id))

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

const waitForWithin = <A>(label: string, effect: Effect.Effect<A, string, never>): Effect.Effect<A, never, never> =>
  Effect.raceFirst(
    Effect.eventually(effect).pipe(Effect.orDie),
    Effect.sleep("10 seconds").pipe(Effect.zipRight(Effect.die(`timed-out-${label}`)))
  )

const waitForRunState = (
  registry: Registry.Registry,
  id: string,
  label: string,
  predicate: (state: SurfaceState) => boolean
): Effect.Effect<SurfaceState, never, never> =>
  waitForWithin(
    label,
    Effect.sync(() => readSurface(registry, id)).pipe(
      Effect.filterOrFail(predicate, () => `waiting-for-${label}`)
    )
  )

const emitEffectTextProjectionSteps = (
  registry: Registry.Registry,
  source: MockEventSource
): Effect.Effect<void, never, never> =>
  Effect.gen(function*() {
    const run = readSurface(registry, "effect-text").run

    if (run.session.localRunPlan === null || run.session.localRunPlan._tag !== "effect-text") {
      return yield* Effect.die("missing-effect-text-plan")
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
  }).pipe(Effect.orDie)

const emitDspProgressStep = (registry: Registry.Registry, source: MockEventSource): Effect.Effect<void, never, never> =>
  Effect.gen(function*() {
    const run = readSurface(registry, "effect-dsp").run
    const plan = run.session.localRunPlan

    if (plan === null || plan._tag !== "effect-dsp") {
      return yield* Effect.die("missing-effect-dsp-plan")
    }

    yield* Effect.sync(() => {
      source.emitEvidence(
        encodeEvidenceEventJson(
          new Step({
            step: new DspCanonicalStep({
              scenarioId: plan.scenarioId,
              moduleType: plan.moduleType,
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
    })
  }).pipe(Effect.orDie)

type DemoId = "effect-text" | "effect-math" | "effect-dsp"

type AsyncRunRegression = {
  readonly configureRegistry?: (registry: Registry.Registry) => void
  readonly emitAfterResume?: (registry: Registry.Registry, source: MockEventSource) => Effect.Effect<void, never, never>
  readonly emitWhilePaused: (registry: Registry.Registry, source: MockEventSource) => Effect.Effect<void, never, never>
  readonly expectedSectionTitle: string
  readonly expectedSummary: string
  readonly id: DemoId
  readonly isFinalized: (registry: Registry.Registry, state: SurfaceState) => boolean
  readonly isRunning: (registry: Registry.Registry, state: SurfaceState) => boolean
}

const assertAsyncControlRunRegression = ({
  configureRegistry,
  emitAfterResume,
  emitWhilePaused,
  expectedSectionTitle,
  expectedSummary,
  id,
  isFinalized,
  isRunning
}: AsyncRunRegression): Effect.Effect<void, never, never> =>
  withMockEventSource(
    Effect.gen(function*() {
      const registry = makeAsyncTestRegistry()
      const runtime = makeRuntime()
      const runControlAtom = makeRunControlAtom(runtime)

      yield* Option.fromNullable(configureRegistry).pipe(
        Option.match({
          onNone: () => Effect.void,
          onSome: (configure) =>
            Effect.sync(() => {
              configure(registry)
            })
        })
      )

      registry.mount(runControlAtom)
      registry.set(runControlAtom, { action: "run", id })

      const source = yield* waitForSource

      yield* waitForRunState(registry, id, `${id}-running`, (state) => isRunning(registry, state))

      registry.set(runControlAtom, { action: "pause", id })

      const paused = yield* waitForRunState(registry, id, `${id}-paused`, (state) => state.run._tag === "RunPaused")

      expect(paused.run._tag).toBe("RunPaused")

      yield* emitWhilePaused(registry, source)

      registry.set(runControlAtom, { action: "resume", id })

      const resumed = yield* waitForRunState(registry, id, `${id}-resumed`, (state) => state.run._tag === "RunRunning")

      expect(resumed.run._tag).toBe("RunRunning")

      yield* Option.fromNullable(emitAfterResume).pipe(
        Option.match({
          onNone: () => Effect.void,
          onSome: (emit) => emit(registry, source)
        })
      )

      const final = yield* waitForRunState(registry, id, `${id}-success`, (state) => isFinalized(registry, state))

      expect(final.run._tag).toBe("RunSuccess")
      if (final.run._tag === "RunSuccess") {
        expect(final.run.data.summary).toBe(expectedSummary)
        expect(final.run.data.sections.some((section) => section.title === expectedSectionTitle)).toBe(true)
      }

      const telemetryKinds = registry.get(surfaceRunRuntimeTelemetryAtom(id)).events.map((event) => event.kind)

      expect(telemetryKinds).toContain("run-started")
      expect(telemetryKinds).toContain("pause-requested")
      expect(telemetryKinds).toContain("resume-requested")
      expect(telemetryKinds).toContain("server-completed")
      expect(telemetryKinds).toContain("local-completed")
      expect(telemetryKinds).toContain("run-finalized")
    })
  )

describe("controlRunAtom async regressions", () => {
  it.live("effect-text launched through controlRunAtom survives pause-resume under async registry scheduling", () =>
    assertAsyncControlRunRegression({
      configureRegistry: (registry) => {
        registry.set(reflowStageViewportWidthAtom, 960)
      },
      emitWhilePaused: (registry, source) =>
        emitEffectTextProjectionSteps(registry, source).pipe(
          Effect.zipRight(
            Effect.sync(() => {
              source.emitEvidence(
                encodeEvidenceEventJson(new StreamComplete({ summary: "Control atom text async.", meta: streamMeta }))
              )
            })
          )
        ),
      expectedSectionTitle: "Animation Summary",
      expectedSummary: "Control atom text async.",
      id: "effect-text",
      isFinalized: (registry, state) => state.run._tag === "RunSuccess" && registry.get(animatingAtom) === false,
      isRunning: (_registry, state) => state.run._tag === "RunRunning"
    }))

  it.live("effect-math launched through controlRunAtom survives pause-resume under async registry scheduling", () =>
    assertAsyncControlRunRegression({
      emitWhilePaused: (_registry, source) =>
        Effect.sync(() => {
          source.emitEvidence(
            encodeEvidenceEventJson(new StreamComplete({ summary: "Control atom math async.", meta: streamMeta }))
          )
        }),
      expectedSectionTitle: "Animation Summary",
      expectedSummary: "Control atom math async.",
      id: "effect-math",
      isFinalized: (registry, state) => state.run._tag === "RunSuccess" && registry.get(powerAnimatingAtom) === false,
      isRunning: (_registry, state) => state.run._tag === "RunRunning"
    }))

  it.live("effect-dsp launched through controlRunAtom survives pause-resume under async registry scheduling", () =>
    assertAsyncControlRunRegression({
      emitAfterResume: (_registry, source) =>
        Effect.sync(() => {
          source.emitEvidence(
            encodeEvidenceEventJson(
              new SectionAppend({
                section: {
                  title: "DSP Async Resume",
                  items: [{ _tag: "Text", label: "Stage", value: "baseline 2/4" }]
                }
              })
            )
          )
          source.emitEvidence(
            encodeEvidenceEventJson(new StreamComplete({ summary: "Control atom dsp async.", meta: streamMeta }))
          )
        }),
      emitWhilePaused: emitDspProgressStep,
      expectedSectionTitle: "DSP Async Resume",
      expectedSummary: "Control atom dsp async.",
      id: "effect-dsp",
      isFinalized: (_registry, state) => state.run._tag === "RunSuccess",
      isRunning: (_registry, state) => state.run._tag === "RunRunning"
    }))
})
