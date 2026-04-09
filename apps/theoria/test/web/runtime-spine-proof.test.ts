import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { DspCanonicalStep } from "../../app/contracts/capability/effect-dsp-runtime.js"
import type { EntryId } from "../../app/contracts/entry/id.js"
import type { EvidenceSection } from "../../app/contracts/evidence/item.js"
import {
  canonicalStepEvent,
  encodeEvidenceEventJson,
  SectionAppend,
  StreamComplete
} from "../../app/contracts/evidence/stream.js"
import { isEffectDspProjectionScript } from "../../app/web/atoms/dsp-run-plan.js"
import { surfaceAtom } from "../../app/web/atoms/surface/state.js"
import type { SurfaceState } from "../../app/web/state/surface/state.js"
import { makeAppClientTestRuntime } from "../helpers/entry-client.test-layer.js"
import { errorFixture, programPreviewFixture } from "../helpers/entry-fixtures.js"
import { makeRunDemoAtom } from "../helpers/run-atoms.js"

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
  requestId: "req-runtime-spine",
  buildSha: "build-runtime-spine",
  durationMs: 11
}

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

const readSurface = (registry: Registry.Registry, id: EntryId): SurfaceState => registry.get(surfaceAtom(id))

const waitForLatestSource = Effect.eventually(
  Effect.sync(() => Option.fromNullable(MockEventSource.instances[MockEventSource.instances.length - 1])).pipe(
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

describe("runtime spine proof", () => {
  it.effect("seals RunData.sections from ordered SectionAppend accumulation on the active stream", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeTestRegistry()
        const runtime = makeAppClientTestRuntime({
          run: () => Effect.fail(errorFixture),
          runWithMeta: () => Effect.fail(errorFixture),
          preload: () => Effect.succeed(programPreviewFixture)
        })
        const runDemoAtom = makeRunDemoAtom(runtime)

        registry.mount(runDemoAtom)
        registry.set(runDemoAtom, "effect-dsp")

        const source = yield* waitForLatestSource
        const running = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-dsp")).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunRunning", () => "waiting-for-effect-dsp-running")
          )
        )

        if (!isEffectDspProjectionScript(running.run.session.localProjectionScript)) {
          return yield* Effect.die("missing-effect-dsp-plan")
        }

        const frozenPlan = running.run.session.localProjectionScript
        const expectedSections: ReadonlyArray<EvidenceSection> = [
          {
            title: "Baseline Trace Evidence",
            items: [{ _tag: "Text", label: "Prompt", value: "Baseline stage emitted first." }]
          },
          {
            title: "Optimizer Event Evidence",
            items: [{ _tag: "Text", label: "Event", value: "RoundCompleted round=1 demosCollected=1" }]
          }
        ]

        source.emitEvidence(
          encodeEvidenceEventJson(
            canonicalStepEvent(
              new DspCanonicalStep({
                scenarioId: frozenPlan.scenarioId,
                moduleType: frozenPlan.moduleType,
                stageId: "baseline",
                stepIndex: 1,
                stepCount: 1,
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
        yield* Effect.forEach(expectedSections, (section) =>
          Effect.sync(() => {
            source.emitEvidence(encodeEvidenceEventJson(new SectionAppend({ section })))
          }), { discard: true })
        source.emitEvidence(
          encodeEvidenceEventJson(StreamComplete.make({ summary: "DSP sealing proof.", meta: streamMeta }))
        )

        const final = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-dsp")).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunSuccess", () => "waiting-for-effect-dsp-success")
          )
        )

        expect(final.run._tag).toBe("RunSuccess")
        if (final.run._tag === "RunSuccess") {
          expect(final.run.data.summary).toBe("DSP sealing proof.")
          expect(final.run.data.sections).toEqual(expectedSections)
        }
      })
    ))
})
