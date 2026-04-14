import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Option, Ref, Stream } from "effect"

import { EntryRequestError } from "../../app/contracts/entry-error.js"
import { EntryRunIdentity } from "../../app/contracts/entry/routing.js"
import type { EvidenceSection } from "../../app/contracts/evidence/item.js"
import { encodeEvidenceEventJson, SectionAppend, StreamComplete } from "../../app/contracts/evidence/stream.js"
import { ServerEvidenceStream } from "../../app/web/atoms/surface/evidence-stream.js"
import {
  streamingEntryIds,
  SurfaceRuntime,
  surfaceRuntimeFor,
  type SurfaceRuntimeSnapshot
} from "../../app/web/runtime/kernel/surface-runtime.js"
import { initialSurfaceState } from "../../app/web/state/surface/state.js"
import { makeAppClientTestLayer } from "../helpers/entry-client.test-layer.js"

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

const performanceSection: EvidenceSection = {
  title: "Performance",
  items: [{ _tag: "Text", label: "Proof", value: "Server-authored stream event." }]
}

const streamMeta = {
  requestId: "req-stream-proof",
  buildSha: "build-stream-proof",
  durationMs: 13
}

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

type RuntimeStreamRequest = {
  readonly id: "workflow"
  readonly runtime: SurfaceRuntime
  readonly runtimeSnapshot: SurfaceRuntimeSnapshot
  readonly runToken: string | null
}

const runtimeStreamRequestFor = (id: "workflow"): RuntimeStreamRequest => ({
  id,
  runtime: surfaceRuntimeFor(id),
  runtimeSnapshot: {
    draft: initialSurfaceState(id).draft,
    localProjectionScript: null
  },
  runToken: null
})

const runtimeStreamUrlFor = (request: RuntimeStreamRequest): string | null =>
  Option.match(request.runtime.streamUrl, {
    onNone: () => null,
    onSome: (streamUrl) => streamUrl(request.runtimeSnapshot, request.runToken)
  })

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

const streamingProofLayer = ({
  runCountRef,
  runWithMetaCountRef
}: {
  readonly runCountRef: Ref.Ref<number>
  readonly runWithMetaCountRef: Ref.Ref<number>
}) =>
  makeAppClientTestLayer({
    run: () =>
      Ref.update(runCountRef, (count) => count + 1).pipe(
        Effect.zipRight(Effect.fail(new EntryRequestError({ message: "unexpected /run data path" })))
      ),
    runWithMeta: () =>
      Ref.update(runWithMetaCountRef, (count) => count + 1).pipe(
        Effect.zipRight(Effect.fail(new EntryRequestError({ message: "unexpected /run terminal path" })))
      ),
    preload: () => Effect.fail(new EntryRequestError({ message: "unused preload" }))
  })

const fetchProofLayer = ({
  runCountRef,
  runWithMetaCountRef
}: {
  readonly runCountRef: Ref.Ref<number>
  readonly runWithMetaCountRef: Ref.Ref<number>
}) =>
  makeAppClientTestLayer({
    run: () =>
      Ref.update(runCountRef, (count) => count + 1).pipe(
        Effect.zipRight(Effect.fail(new EntryRequestError({ message: "unused /run data path" })))
      ),
    runWithMeta: () =>
      Ref.update(runWithMetaCountRef, (count) => count + 1).pipe(
        Effect.as({
          data: {
            id: "workflow",
            packageName: EntryRunIdentity.fromEntryId("workflow").packageName,
            summary: "Fetched terminal result.",
            durationMs: streamMeta.durationMs,
            program: {
              files: [{ language: "ts", entry: "server/run.ts", name: "run.ts", source: "export const run = true" }]
            },
            sections: [performanceSection]
          },
          meta: streamMeta
        })
      ),
    preload: () => Effect.fail(new EntryRequestError({ message: "unused preload" }))
  })

const fetchRuntimeRequest: RuntimeStreamRequest = {
  id: "workflow",
  runtime: SurfaceRuntime.entryFetch({
    entryId: "workflow",
    snapshot: () => ({
      draft: initialSurfaceState("workflow").draft,
      localProjectionScript: null
    })
  }),
  runtimeSnapshot: {
    draft: initialSurfaceState("workflow").draft,
    localProjectionScript: null
  },
  runToken: null
}

describe("evidence stream transport proof", () => {
  it.effect("keeps every hardened streaming surface on the SSE ledger instead of the /run terminal path", () =>
    withMockEventSource(
      Effect.gen(function*() {
        const runCountRef = yield* Ref.make(0)
        const runWithMetaCountRef = yield* Ref.make(0)
        const layer = streamingProofLayer({ runCountRef, runWithMetaCountRef })

        yield* Effect.forEach(streamingEntryIds, (id) =>
          Effect.gen(function*() {
            yield* Effect.sync(() => {
              MockEventSource.instances = []
            })

            const request = runtimeStreamRequestFor(id)

            const fiber = yield* ServerEvidenceStream.fromRuntime(request).pipe(
              Stream.runCollect,
              Effect.provide(layer),
              Effect.fork
            )
            const source = yield* waitForLatestSource
            const expectedUrl = runtimeStreamUrlFor(request)

            expect(expectedUrl).not.toBeNull()
            expect(source.url).toBe(expectedUrl)

            source.emitEvidence(encodeEvidenceEventJson(new SectionAppend({ section: performanceSection })))
            source.emitEvidence(
              encodeEvidenceEventJson(StreamComplete.make({ summary: `${id} complete.`, meta: streamMeta }))
            )

            const events = yield* Fiber.join(fiber)

            expect(Chunk.toReadonlyArray(events).map((event) => event._tag)).toEqual([
              "SectionAppend",
              "StreamComplete"
            ])
          }), { discard: true })

        expect(yield* Ref.get(runCountRef)).toBe(0)
        expect(yield* Ref.get(runWithMetaCountRef)).toBe(0)
      })
    ))

  it.effect("keeps fetch-only surfaces on the /run terminal path when no SSE runtime is declared", () =>
    Effect.gen(function*() {
      const runCountRef = yield* Ref.make(0)
      const runWithMetaCountRef = yield* Ref.make(0)
      const events = yield* ServerEvidenceStream.fromRuntime(fetchRuntimeRequest).pipe(
        Stream.runCollect,
        Effect.provide(fetchProofLayer({ runCountRef, runWithMetaCountRef }))
      )

      expect(Chunk.toReadonlyArray(events).map((event) => event._tag)).toEqual(["SectionAppend", "StreamComplete"])
      expect(yield* Ref.get(runCountRef)).toBe(0)
      expect(yield* Ref.get(runWithMetaCountRef)).toBe(1)
    }))
})
