import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Either, Fiber, Layer, Option, Stream } from "effect"

import { EntryRequestError } from "../../app/contracts/entry-error.js"
import type { EvidenceSection } from "../../app/contracts/evidence/item.js"
import { EvidenceStore } from "../../app/contracts/evidence/store.js"
import {
  encodeEvidenceEventJson,
  type EvidenceEvent,
  SectionAppend,
  SectionUpsert,
  StreamComplete,
  StreamFailed
} from "../../app/contracts/evidence/stream.js"
import {
  surfaceEvidenceSectionsAtom,
  surfaceEvidenceStoreAtom,
  surfaceEvidenceStreamAtom
} from "../../app/web/atoms/surface/evidence-store.js"
import { ServerEvidenceStream } from "../../app/web/atoms/surface/evidence-stream.js"
import { surfaceAtom } from "../../app/web/atoms/surface/state.js"
import { surfaceRuntimeFor } from "../../app/web/runtime/kernel/surface-runtime.js"
import { EntryClient } from "../../app/web/services/EntryClient.js"
import { EvidenceStreamState } from "../../app/web/state/evidence/stream.js"
import { reduceRunState } from "../../app/web/state/run/reducer.js"
import { RunOwnership } from "../../app/web/state/run/types.js"
import { initialSurfaceState } from "../../app/web/state/surface/state.js"
import { programPreviewFixture } from "../helpers/entry-fixtures.js"
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
    run: () => Effect.fail(new EntryRequestError({ message: "unused" })),
    runWithMeta: () => Effect.fail(new EntryRequestError({ message: "unused" })),
    preload: () => Effect.fail(new EntryRequestError({ message: "unused" })),
    capabilityAvailability: () =>
      Effect.succeed({
        entries: [],
        dsp: {
          enabled: false,
          reason: "unused"
        }
      }),
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

const streamFromEvents = (...events: ReadonlyArray<EvidenceEvent>): EvidenceStreamState =>
  EvidenceStreamState.fromStore(events.reduce((store, event) => store.apply(event), EvidenceStore.empty()))

const updateStoreWithEvent = (store: EvidenceStore, event: EvidenceEvent): EvidenceStore => store.apply(event)

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

  it.effect("EvidenceStreamState projects appended sections from the contract store", () =>
    Effect.gen(function*() {
      const state = streamFromEvents(new SectionAppend({ section: performanceSection }))

      expect(state.sections).toHaveLength(1)
      expect(state.sections[0]?.title).toBe("Performance")
      expect(state.complete).toBe(false)
    }))

  it.effect("EvidenceStreamState preserves section order from the contract store", () =>
    Effect.gen(function*() {
      const state = streamFromEvents(
        new SectionAppend({ section: performanceSection }),
        new SectionAppend({ section: corpusSection })
      )

      expect(state.sections).toHaveLength(2)
      expect(state.sections[0]?.title).toBe("Performance")
      expect(state.sections[1]?.title).toBe("Corpus")
    }))

  it.effect("SectionUpsert replaces an existing section in place", () =>
    Effect.gen(function*() {
      const state = streamFromEvents(
        new SectionAppend({ section: performanceSection }),
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

      expect(state.sections).toHaveLength(1)
      expect(state.sections[0]?.items).toHaveLength(2)
      expect(state.sections[0]?.items[0]?._tag).toBe("Scalar")
    }))

  it.effect("StreamComplete marks the stream as done with summary metadata", () =>
    Effect.gen(function*() {
      const state = streamFromEvents(
        new SectionAppend({ section: performanceSection }),
        StreamComplete.make({ summary: "Benchmark complete.", meta: streamMeta })
      )

      expect(state.complete).toBe(true)
      expect(state.summary).toBe("Benchmark complete.")
      expect(state.meta?.durationMs).toBe(21)
      expect(state.sections).toHaveLength(1)
    }))

  it.effect("StreamFailed is transport-only and does not discard already streamed sections", () =>
    Effect.gen(function*() {
      const state = streamFromEvents(
        new SectionAppend({ section: performanceSection }),
        StreamFailed.make({
          error: {
            code: "execution-failed",
            message: "stream failed",
            retryable: true
          }
        })
      )

      expect(state.sections).toHaveLength(1)
      expect(state.complete).toBe(false)
      expect(state.summary).toBeNull()
      expect(state.meta).toBeNull()
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
            ownership: RunOwnership.sharedStreaming(),
            program: programPreviewFixture.program
          })
        )
      }))
      registry.update(surfaceEvidenceStoreAtom("effect-text"), (store) =>
        updateStoreWithEvent(store, new SectionAppend({ section: performanceSection })))

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
            ownership: RunOwnership.sharedStreaming(),
            program: programPreviewFixture.program
          })
        )
      }))
      registry.update(surfaceEvidenceStoreAtom("effect-text"), (store) =>
        updateStoreWithEvent(store, new SectionAppend({ section: performanceSection })))

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

  it.effect("ServerEvidenceStream.fromRuntime remains exported for async producers", () =>
    Effect.gen(function*() {
      expect(typeof ServerEvidenceStream.fromRuntime).toBe("function")
    }))

  it.effect("ServerEvidenceStream.fromRuntime emits explicit server completion before closing the SSE transport", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const fiber = yield* ServerEvidenceStream.fromRuntime(runtimeStreamRequestFor("effect-search")).pipe(
          Stream.runCollect,
          Effect.provide(serverEvidenceLayer),
          Effect.fork
        )

        const source = yield* waitForSource
        source.emitEvidence(
          encodeEvidenceEventJson(new SectionAppend({ section: performanceSection }))
        )
        source.emitEvidence(
          encodeEvidenceEventJson(StreamComplete.make({ summary: "Complete.", meta: streamMeta }))
        )

        const events = yield* Fiber.join(fiber)
        const collected = Chunk.toReadonlyArray(events)

        expect(collected).toHaveLength(2)
        expect(collected[0]?._tag).toBe("SectionAppend")
        expect(collected[1]?._tag).toBe("StreamComplete")
        expect(source.closed).toBe(true)
      })
    ))

  it.effect("ServerEvidenceStream.fromRuntime fails on decode errors before finalization", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const fiber = yield* ServerEvidenceStream.fromRuntime(runtimeStreamRequestFor("effect-search")).pipe(
          Stream.runDrain,
          Effect.provide(serverEvidenceLayer),
          Effect.fork
        )

        const source = yield* waitForSource
        source.emitEvidence("not-json")

        const result = yield* Fiber.join(fiber).pipe(Effect.either)

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe("EntryDecodeError")
        }
      })
    ))

  it.effect("ServerEvidenceStream.fromRuntime reports premature close after partial evidence without inventing completion", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const fiber = yield* ServerEvidenceStream.fromRuntime(runtimeStreamRequestFor("effect-search")).pipe(
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
          expect(result.left._tag).toBe("EntryRequestError")
          expect(result.left.message).toContain("completion metadata")
        }
      })
    ))

  it.effect("ServerEvidenceStream.fromRuntime promotes terminal server failures onto the typed error channel", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const fiber = yield* ServerEvidenceStream.fromRuntime(runtimeStreamRequestFor("effect-search")).pipe(
          Stream.runDrain,
          Effect.provide(serverEvidenceLayer),
          Effect.fork
        )

        const source = yield* waitForSource
        source.emitEvidence(
          encodeEvidenceEventJson(
            StreamFailed.make({
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
          expect(result.left._tag).toBe("EntryExecutionError")
          expect(result.left.message).toBe("server failed")
        }
        expect(source.closed).toBe(true)
      })
    ))

  it.effect("normalized store projections keep completion metadata separate from section entities", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      registry.update(surfaceEvidenceStoreAtom("effect-text"), (store) =>
        updateStoreWithEvent(
          updateStoreWithEvent(store, new SectionAppend({ section: performanceSection })),
          StreamComplete.make({ summary: "Benchmark complete.", meta: streamMeta })
        ))

      const store = registry.get(surfaceEvidenceStoreAtom("effect-text"))
      const stream = EvidenceStreamState.fromStore(store)

      expect(store.sectionOrder).toHaveLength(1)
      expect(store.sectionsById[store.sectionOrder[0] ?? ""]?.title).toBe("Performance")
      expect(stream.complete).toBe(true)
      expect(stream.summary).toBe("Benchmark complete.")
      expect(stream.meta?.requestId).toBe("req-stream")
      expect(EvidenceStore.empty().sectionOrder).toEqual([])
    }))
})
