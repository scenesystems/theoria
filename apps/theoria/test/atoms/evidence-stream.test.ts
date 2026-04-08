import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Either, Fiber, Layer, Option, Stream } from "effect"

import { DemoRequestError } from "../../app/contracts/demo-error.js"
import {
  encodeEvidenceEventJson,
  SectionAppend,
  SectionUpsert,
  StreamComplete,
  StreamFailed
} from "../../app/contracts/evidence-stream.js"
import type { EvidenceSection } from "../../app/contracts/evidence.js"
import { makeServerEvidenceStream } from "../../app/web/atoms/evidence-stream.js"
import {
  surfaceAtom,
  surfaceEvidenceSectionsAtom,
  surfaceEvidenceStoreAtom,
  surfaceEvidenceStreamAtom,
  surfaceEvidenceStreamStateAtom
} from "../../app/web/atoms/surface.js"
import { surfaceRuntimeFor } from "../../app/web/runtime/kernel/surface-runtime.js"
import { EntryClient } from "../../app/web/services/EntryClient.js"
import {
  applyEvidenceEvent,
  emptyEvidenceStoreState,
  emptyEvidenceStreamState,
  evidenceStreamFromStore,
  initialSurfaceState,
  reduceRunState
} from "../../app/web/state/types.js"
import { runStartedMessage } from "../helpers/run-state.js"

const streamMeta = {
  requestId: "req-stream",
  buildSha: "build-stream",
  durationMs: 21
}

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
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

const runtimeStreamRequestFor = (id: "effect-search" | "effect-text") => ({
  id,
  runtime: surfaceRuntimeFor(id),
  runtimeSnapshot: {
    draft: initialSurfaceState(id).draft,
    localProjectionScript: null
  },
  runToken: null
})

const serverEvidenceLayer = Layer.succeed(
  EntryClient,
  {
    _tag: "theoria/EntryClient",
    run: () => Effect.fail(new DemoRequestError({ message: "unused" })),
    runWithMeta: () => Effect.fail(new DemoRequestError({ message: "unused" })),
    preload: () => Effect.fail(new DemoRequestError({ message: "unused" })),
    versions: () => Effect.succeed({})
  }
)

const withMockEventSource = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
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

const performanceSection: EvidenceSection = {
  title: "Performance",
  items: [
    { _tag: "Scalar", label: "Speedup", value: 2.5, unit: "×" }
  ]
}

const corpusSection: EvidenceSection = {
  title: "Corpus",
  items: [
    { _tag: "Text", label: "Entries", value: "5" }
  ]
}

describe("Evidence Stream State", () => {
  it.effect("surfaceEvidenceStreamAtom starts with empty state before any run", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const state = registry.get(surfaceEvidenceStreamAtom("effect-text"))
      expect(state.sections).toEqual([])
      expect(state.complete).toBe(false)
      expect(state.summary).toBeNull()
      expect(state.meta).toBeNull()
    }))

  it.effect("applyEvidenceEvent accumulates sections via SectionAppend", () =>
    Effect.gen(function*() {
      const state0 = emptyEvidenceStreamState
      const state1 = applyEvidenceEvent(state0, new SectionAppend({ section: performanceSection }))

      expect(state1.sections).toHaveLength(1)
      expect(state1.sections[0]?.title).toBe("Performance")
      expect(state1.complete).toBe(false)
    }))

  it.effect("applyEvidenceEvent accumulates multiple sections in order", () =>
    Effect.gen(function*() {
      const state0 = emptyEvidenceStreamState
      const state1 = applyEvidenceEvent(state0, new SectionAppend({ section: performanceSection }))
      const state2 = applyEvidenceEvent(state1, new SectionAppend({ section: corpusSection }))

      expect(state2.sections).toHaveLength(2)
      expect(state2.sections[0]?.title).toBe("Performance")
      expect(state2.sections[1]?.title).toBe("Corpus")
    }))

  it.effect("SectionUpsert replaces an existing section in place", () =>
    Effect.gen(function*() {
      const state0 = applyEvidenceEvent(emptyEvidenceStreamState, new SectionAppend({ section: performanceSection }))
      const state1 = applyEvidenceEvent(
        state0,
        new SectionUpsert({
          section: {
            title: "Performance",
            items: [
              { _tag: "Scalar", label: "Speedup", value: 3.1, unit: "×" },
              { _tag: "Text", label: "Status", value: "streaming" }
            ]
          }
        })
      )

      expect(state1.sections).toHaveLength(1)
      expect(state1.sections[0]?.items).toHaveLength(2)
      expect(state1.sections[0]?.items[0]?._tag).toBe("Scalar")
    }))

  it.effect("StreamComplete marks the stream as done with summary metadata", () =>
    Effect.gen(function*() {
      const state0 = emptyEvidenceStreamState
      const state1 = applyEvidenceEvent(state0, new SectionAppend({ section: performanceSection }))
      const state2 = applyEvidenceEvent(
        state1,
        new StreamComplete({ summary: "Benchmark complete.", meta: streamMeta })
      )

      expect(state2.complete).toBe(true)
      expect(state2.summary).toBe("Benchmark complete.")
      expect(state2.meta?.durationMs).toBe(21)
      expect(state2.sections).toHaveLength(1)
    }))

  it.effect("StreamFailed is transport-only and does not discard already streamed sections", () =>
    Effect.gen(function*() {
      const state0 = applyEvidenceEvent(emptyEvidenceStreamState, new SectionAppend({ section: performanceSection }))
      const state1 = applyEvidenceEvent(
        state0,
        new StreamFailed({
          error: {
            code: "execution-failed",
            message: "stream failed",
            retryable: true
          }
        })
      )

      expect(state1.sections).toHaveLength(1)
      expect(state1.complete).toBe(false)
      expect(state1.summary).toBeNull()
      expect(state1.meta).toBeNull()
    }))

  it.effect("surfaceEvidenceSectionsAtom derives sections from the active running run", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      registry.update(surfaceAtom("effect-text"), (surface) => ({
        ...surface,
        run: reduceRunState(
          surface.run,
          runStartedMessage({
            draft: surface.draft,
            ownership: { localDriver: true, serverStream: true },
            program: {
              files: [{ language: "ts", entry: "demo.ts", name: "demo.ts", source: "export const demo = true" }]
            }
          })
        )
      }))
      registry.update(surfaceEvidenceStreamStateAtom("effect-text"), (stream) =>
        applyEvidenceEvent(stream, new SectionAppend({ section: performanceSection })))

      const sections = registry.get(surfaceEvidenceSectionsAtom("effect-text"))
      expect(sections).toHaveLength(1)
      expect(sections[0]?.title).toBe("Performance")
    }))

  it.effect("separate ids maintain independent evidence projections", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      registry.update(surfaceAtom("effect-text"), (surface) => ({
        ...surface,
        run: reduceRunState(
          surface.run,
          runStartedMessage({
            draft: surface.draft,
            ownership: { localDriver: true, serverStream: true },
            program: {
              files: [{ language: "ts", entry: "demo.ts", name: "demo.ts", source: "export const demo = true" }]
            }
          })
        )
      }))
      registry.update(surfaceEvidenceStreamStateAtom("effect-text"), (stream) =>
        applyEvidenceEvent(stream, new SectionAppend({ section: performanceSection })))

      const textSections = registry.get(surfaceEvidenceSectionsAtom("effect-text"))
      const searchSections = registry.get(surfaceEvidenceSectionsAtom("effect-search"))
      expect(textSections).toHaveLength(1)
      expect(searchSections).toEqual([])
    }))

  it.effect("surfaceEvidenceStreamAtom returns the same atom reference via Atom.family", () =>
    Effect.gen(function*() {
      const a = surfaceEvidenceStreamAtom("effect-text")
      const b = surfaceEvidenceStreamAtom("effect-text")
      expect(a).toBe(b)
    }))

  it.effect("makeServerEvidenceStream remains exported for async producers", () =>
    Effect.gen(function*() {
      expect(typeof makeServerEvidenceStream).toBe("function")
    }))

  it.effect("makeServerEvidenceStream emits explicit server completion before closing the SSE transport", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const fiber = yield* makeServerEvidenceStream(runtimeStreamRequestFor("effect-search")).pipe(
          Stream.runCollect,
          Effect.provide(serverEvidenceLayer),
          Effect.fork
        )

        const source = yield* waitForSource
        source.emitEvidence(
          encodeEvidenceEventJson(new SectionAppend({ section: performanceSection }))
        )
        source.emitEvidence(
          encodeEvidenceEventJson(new StreamComplete({ summary: "Complete.", meta: streamMeta }))
        )

        const events = yield* Fiber.join(fiber)
        const collected = Chunk.toReadonlyArray(events)

        expect(collected).toHaveLength(2)
        expect(collected[0]?._tag).toBe("SectionAppend")
        expect(collected[1]?._tag).toBe("StreamComplete")
        expect(source.closed).toBe(true)
      })
    ))

  it.effect("makeServerEvidenceStream fails on decode errors before finalization", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const fiber = yield* makeServerEvidenceStream(runtimeStreamRequestFor("effect-search")).pipe(
          Stream.runDrain,
          Effect.provide(serverEvidenceLayer),
          Effect.fork
        )

        const source = yield* waitForSource
        source.emitEvidence("not-json")

        const result = yield* Fiber.join(fiber).pipe(Effect.either)

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe("DemoDecodeError")
        }
      })
    ))

  it.effect("makeServerEvidenceStream reports premature close after partial evidence without inventing completion", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const fiber = yield* makeServerEvidenceStream(runtimeStreamRequestFor("effect-search")).pipe(
          Stream.runDrain,
          Effect.provide(serverEvidenceLayer),
          Effect.fork
        )

        const source = yield* waitForSource
        source.emitEvidence(encodeEvidenceEventJson(new SectionAppend({ section: performanceSection })))
        source.emitError()

        const result = yield* Fiber.join(fiber).pipe(Effect.either)

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe("DemoRequestError")
          expect(result.left.message).toContain("completion metadata")
        }
      })
    ))

  it.effect("makeServerEvidenceStream promotes terminal server failures onto the typed error channel", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const fiber = yield* makeServerEvidenceStream(runtimeStreamRequestFor("effect-search")).pipe(
          Stream.runDrain,
          Effect.provide(serverEvidenceLayer),
          Effect.fork
        )

        const source = yield* waitForSource
        source.emitEvidence(
          encodeEvidenceEventJson(
            new StreamFailed({
              error: {
                code: "execution-failed",
                message: "server failed",
                retryable: true
              }
            })
          )
        )

        const result = yield* Fiber.join(fiber).pipe(Effect.either)

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe("DemoExecutionError")
          expect(result.left.message).toBe("server failed")
        }
        expect(source.closed).toBe(true)
      })
    ))

  it.effect("normalized store projections keep completion metadata separate from section entities", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      registry.update(surfaceEvidenceStoreAtom("effect-text"), (store) =>
        applyEvidenceEvent(
          applyEvidenceEvent(store, new SectionAppend({ section: performanceSection })),
          new StreamComplete({ summary: "Benchmark complete.", meta: streamMeta })
        ))

      const store = registry.get(surfaceEvidenceStreamStateAtom("effect-text"))
      const stream = evidenceStreamFromStore(store)

      expect(store.sectionOrder).toHaveLength(1)
      expect(store.sectionsById[store.sectionOrder[0] ?? ""]?.title).toBe("Performance")
      expect(stream.complete).toBe(true)
      expect(stream.summary).toBe("Benchmark complete.")
      expect(stream.meta?.requestId).toBe("req-stream")
      expect(emptyEvidenceStoreState.sectionOrder).toEqual([])
    }))
})
