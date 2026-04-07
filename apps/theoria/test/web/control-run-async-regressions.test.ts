import { Registry } from "@effect-atom/atom"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { moduleSpecifiers, parseTypeScript, readProjectFile } from "@theoria/source-proof"
import type { Duration } from "effect"
import { Effect, Option } from "effect"

import { DspCanonicalStep } from "../../app/contracts/demo/dsp-runtime.js"
import {
  canonicalStepEvent,
  encodeEvidenceEventJson,
  SectionAppend,
  StreamComplete
} from "../../app/contracts/evidence-stream.js"
import type { Id } from "../../app/contracts/id.js"
import { makeRunControlAtom } from "../../app/web/atoms/actions.js"
import { animatingAtom } from "../../app/web/atoms/animation.js"
import { isEffectDspRunPlan } from "../../app/web/atoms/dsp-run-plan.js"
import { powerAnimatingAtom } from "../../app/web/atoms/power-animation.js"
import { reflowStageViewportWidthAtom } from "../../app/web/atoms/reflow.js"
import { surfaceAtom, surfaceRunRuntimeTelemetryAtom } from "../../app/web/atoms/surface.js"
import type { SurfaceState } from "../../app/web/state/types.js"
import { makeAppClientTestRuntime } from "../helpers/demo-client.test-layer.js"
import { errorFixture, programPreviewFixture } from "../helpers/demo-fixtures.js"
import { emitEffectMathAuthoredStream, emitEffectTextAuthoredStream } from "../helpers/mock-authored-stream.js"

const appRootUrl = new URL("../../", import.meta.url)

type EventListener = (event: Event | MessageEvent<string>) => void

type DemoId = Extract<Id, "effect-text" | "effect-math" | "effect-dsp">

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

const readSurface = (registry: Registry.Registry, id: Id): SurfaceState => registry.get(surfaceAtom(id))

const makeRuntime = () =>
  makeAppClientTestRuntime({
    run: () => Effect.fail(errorFixture),
    runWithMeta: () => Effect.fail(errorFixture),
    preload: () => Effect.succeed(programPreviewFixture),
    streamUrl: (id) => `/api/demos/${id}/stream`
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

const waitForWithin = <A>(
  label: string,
  effect: Effect.Effect<A, string, never>,
  timeout: Duration.DurationInput = "10 seconds"
): Effect.Effect<A, never, never> =>
  Effect.raceFirst(
    Effect.eventually(effect).pipe(Effect.orDie),
    Effect.sleep(timeout).pipe(Effect.zipRight(Effect.die(`timed-out-${label}`)))
  )

const waitForRunState = (
  registry: Registry.Registry,
  id: DemoId,
  label: string,
  predicate: (state: SurfaceState) => boolean,
  timeout?: Duration.DurationInput
): Effect.Effect<SurfaceState, never, never> =>
  waitForWithin(
    label,
    Effect.sync(() => readSurface(registry, id)).pipe(
      Effect.filterOrFail(predicate, () => `waiting-for-${label}`)
    ),
    timeout
  )

const emitDspProgressStep = (registry: Registry.Registry, source: MockEventSource): Effect.Effect<void, never, never> =>
  Effect.gen(function*() {
    const run = readSurface(registry, "effect-dsp").run
    const plan = run.session.localRunPlan

    if (!isEffectDspRunPlan(plan)) {
      return yield* Effect.die("missing-effect-dsp-plan")
    }

    yield* Effect.sync(() => {
      source.emitEvidence(
        encodeEvidenceEventJson(
          canonicalStepEvent(
            new DspCanonicalStep({
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
          )
        )
      )
    })
  }).pipe(Effect.orDie)

describe("control-run async authority boundary", () => {
  it.effect("keeps DSP graph projections and workflow score contracts split across effect-dsp and effect-inference authorities", () =>
    Effect.gen(function*() {
      const contractPath = "app/contracts/workflow/comparison-run.ts"
      const source = yield* readProjectFile(appRootUrl, contractPath)
      const imports = moduleSpecifiers(parseTypeScript(contractPath, source))

      expect(imports).toContain("effect-dsp/contracts")
      expect(imports).toContain("effect-inference/Contracts")
    }).pipe(Effect.provide(BunContext.layer)))
})

type AsyncRunRegression = {
  readonly configureRegistry?: (registry: Registry.Registry) => void
  readonly emitAfterResume?: (registry: Registry.Registry, source: MockEventSource) => Effect.Effect<void, never, never>
  readonly emitWhilePaused: (registry: Registry.Registry, source: MockEventSource) => Effect.Effect<void, never, never>
  readonly expectedSectionTitle: string
  readonly expectedSummary: string
  readonly finalizationTimeout?: Duration.DurationInput
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
  finalizationTimeout,
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

      const paused = yield* waitForRunState(
        registry,
        id,
        `${id}-paused`,
        (state) => state.run._tag === "RunRunning" && state.run.session.control === "paused"
      )

      expect(paused.run._tag).toBe("RunRunning")
      expect(paused.run.session.control).toBe("paused")

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

      const final = yield* waitForRunState(
        registry,
        id,
        `${id}-success`,
        (state) => isFinalized(registry, state),
        finalizationTimeout
      )

      expect(final.run._tag).toBe("RunSuccess")
      if (final.run._tag === "RunSuccess") {
        expect(final.run.data.summary).toBe(expectedSummary)
        expect(final.run.data.sections.some((section) => section.title === expectedSectionTitle)).toBe(true)
      }

      const telemetryKinds = registry.get(surfaceRunRuntimeTelemetryAtom(id)).events.map((event) => event.kind)

      expect(telemetryKinds).toContain("run-started")
      expect(telemetryKinds).toContain("pause-requested")
      expect(telemetryKinds).toContain("resume-requested")
      expect(telemetryKinds).toContain("stream-complete-observed")
      expect(telemetryKinds).toContain("step-queue-drained")
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
        emitEffectTextAuthoredStream({ meta: streamMeta, registry, source, summary: "Control atom text async." }),
      expectedSectionTitle: "Performance",
      expectedSummary: "Control atom text async.",
      finalizationTimeout: "20 seconds",
      id: "effect-text",
      isFinalized: (registry, state) => state.run._tag === "RunSuccess" && registry.get(animatingAtom) === false,
      isRunning: (_registry, state) => state.run._tag === "RunRunning"
    }))

  it.live("effect-math launched through controlRunAtom survives pause-resume under async registry scheduling", () =>
    assertAsyncControlRunRegression({
      emitWhilePaused: (registry, source) =>
        emitEffectMathAuthoredStream({ meta: streamMeta, registry, source, summary: "Control atom math async." }),
      expectedSectionTitle: "Runtime Summary",
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
                  title: "Optimizer Event Evidence",
                  items: [{ _tag: "Text", label: "Event", value: "RoundCompleted round=1 demosCollected=1" }]
                }
              })
            )
          )
          source.emitEvidence(
            encodeEvidenceEventJson(new StreamComplete({ summary: "Control atom dsp async.", meta: streamMeta }))
          )
        }),
      emitWhilePaused: emitDspProgressStep,
      expectedSectionTitle: "Optimizer Event Evidence",
      expectedSummary: "Control atom dsp async.",
      id: "effect-dsp",
      isFinalized: (_registry, state) => state.run._tag === "RunSuccess",
      isRunning: (_registry, state) => state.run._tag === "RunRunning"
    }))
})
