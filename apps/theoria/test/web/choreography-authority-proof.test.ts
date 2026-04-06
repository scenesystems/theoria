import { Atom, Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"

import { Choreography, encodeEvidenceEventJson, StageAdvance } from "../../app/contracts/evidence-stream.js"
import type { Id } from "../../app/contracts/id.js"
import { makeRunDemoAtom } from "../../app/web/atoms/actions.js"
import { reflowStageViewportWidthAtom } from "../../app/web/atoms/reflow.js"
import { surfaceAtom } from "../../app/web/atoms/surface.js"
import { DemoClient } from "../../app/web/services/DemoClient.js"
import type { SurfaceState } from "../../app/web/state/types.js"
import { errorFixture, programPreviewFixture } from "../helpers/demo-fixtures.js"

type EventListener = (event: Event | MessageEvent<string>) => void

class MockEventSource {
  static instances: ReadonlyArray<MockEventSource> = []

  readonly listeners: Record<string, ReadonlyArray<EventListener>> = {}
  readonly url: string

  constructor(url: string) {
    this.url = url
    MockEventSource.instances = [...MockEventSource.instances, this]
  }

  addEventListener(type: string, listener: EventListener): void {
    this.listeners[type] = [...(this.listeners[type] ?? []), listener]
  }

  close(): void {}

  emitEvidence(data: string): void {
    ;(this.listeners.evidence ?? []).forEach((listener) => listener(new MessageEvent("evidence", { data })))
  }
}

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
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

const readSurface = (registry: Registry.Registry, id: Id): SurfaceState => registry.get(surfaceAtom(id))

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

describe("runtime spine choreography authority", () => {
  it.effect("fails the run when a recognized choreography cue violates the sequencing contract", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const registry = makeTestRegistry()
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

        registry.set(reflowStageViewportWidthAtom, 960)
        registry.mount(runDemoAtom)
        registry.set(runDemoAtom, "effect-text")

        const source = yield* waitForSource

        yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-text")).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunRunning", () => "waiting-for-running")
          )
        )

        source.emitEvidence(
          encodeEvidenceEventJson(
            new Choreography({
              cue: new StageAdvance({
                stageId: "corpus-sweep",
                step: 1
              })
            })
          )
        )

        const final = yield* Effect.eventually(
          Effect.sync(() => readSurface(registry, "effect-text")).pipe(
            Effect.filterOrFail((state) => state.run._tag === "RunFailed", () => "waiting-for-failure")
          )
        )

        expect(final.run._tag).toBe("RunFailed")
        if (final.run._tag === "RunFailed") {
          expect(final.run.error._tag).toBe("DemoExecutionError")
          if (final.run.error._tag === "DemoExecutionError") {
            expect(final.run.error.message).toContain(
              "Recognized choreography cue StageAdvance violated sequencing authority"
            )
          }
        }
      })
    ))
})
