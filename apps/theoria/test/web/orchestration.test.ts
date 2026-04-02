import { Atom, Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Deferred, Effect, Layer, Ref } from "effect"

import { corpus } from "../../app/contracts/corpus.js"
import type { Metadata } from "../../app/contracts/envelope.js"
import { makeRunControlAtom, makeRunDemoAtom } from "../../app/web/atoms/actions.js"
import { animatingAtom } from "../../app/web/atoms/animation.js"
import {
  optimizationAnimatingAtom,
  randomTrialsAtom,
  tpeTrialsAtom
} from "../../app/web/atoms/optimization-animation.js"
import { powerAnimatingAtom, powerControlsAtom } from "../../app/web/atoms/power-animation.js"
import { customTextAtom, reflowControlsAtom, reflowSliderMaxWidth } from "../../app/web/atoms/reflow.js"
import { surfaceAtom } from "../../app/web/atoms/surface.js"
import { DemoClient } from "../../app/web/services/DemoClient.js"
import type { SurfaceState } from "../../app/web/state/types.js"
import { errorFixture, programPreviewFixture, runDataFixture } from "../helpers/demo-fixtures.js"
import { failedRunState, runningRunState, succeededRunState } from "../helpers/run-state.js"

const readSurface = (registry: Registry.Registry, id: string): SurfaceState => registry.get(surfaceAtom(id))

const updateSurface = (
  registry: Registry.Registry,
  id: string,
  f: (s: SurfaceState) => SurfaceState
): void => {
  registry.update(surfaceAtom(id), f)
}

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

const streamMeta = (requestId: string, durationMs: number): Metadata => ({
  requestId,
  buildSha: `build-${requestId}`,
  durationMs
})

describe("Theoria Orchestration", () => {
  it.effect("preload state machine transitions through Idle → Loading → Ready", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      const initial = readSurface(registry, "effect-text")
      expect(initial.preload._tag).toBe("PreloadIdle")

      updateSurface(registry, "effect-text", (s) => ({
        ...s,
        preload: { _tag: "PreloadLoading" }
      }))
      expect(readSurface(registry, "effect-text").preload._tag).toBe("PreloadLoading")

      updateSurface(registry, "effect-text", (s) => ({
        ...s,
        preload: { _tag: "PreloadReady", data: programPreviewFixture }
      }))
      expect(readSurface(registry, "effect-text").preload._tag).toBe("PreloadReady")
    }))

  it.effect("sequence guard rejects stale run completions", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      const seq1 = readSurface(registry, "effect-text").nextSequence
      updateSurface(registry, "effect-text", (s) => ({
        ...s,
        nextSequence: s.nextSequence + 1,
        run: runningRunState({ program: programPreviewFixture.program, sequence: seq1 })
      }))

      const seq2 = readSurface(registry, "effect-text").nextSequence
      updateSurface(registry, "effect-text", (s) => ({
        ...s,
        nextSequence: s.nextSequence + 1,
        run: runningRunState({ program: programPreviewFixture.program, sequence: seq2, token: 2 })
      }))

      updateSurface(registry, "effect-text", (s) => {
        if (s.run._tag !== "RunRunning" || s.run.sequence !== seq1) {
          return s
        }
        return { ...s, run: succeededRunState({ data: runDataFixture("stale"), sequence: seq1 }) }
      })

      const afterStale = readSurface(registry, "effect-text")
      expect(afterStale.run._tag).toBe("RunRunning")
      if (afterStale.run._tag === "RunRunning") {
        expect(afterStale.run.sequence).toBe(seq2)
      }
    }))

  it.effect("run failure does not mutate the active stage tab", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      updateSurface(registry, "effect-text", (s) => ({
        ...s,
        stageTab: "evidence"
      }))

      const seq = readSurface(registry, "effect-text").nextSequence
      updateSurface(registry, "effect-text", (s) => ({
        ...s,
        nextSequence: s.nextSequence + 1,
        run: runningRunState({ program: programPreviewFixture.program, sequence: seq })
      }))

      updateSurface(registry, "effect-text", (s) => {
        if (s.run._tag !== "RunRunning" || s.run.sequence !== seq) {
          return s
        }
        return {
          ...s,
          run: failedRunState({ error: errorFixture, program: programPreviewFixture.program, sequence: seq })
        }
      })

      const final = readSurface(registry, "effect-text")
      expect(final.stageTab).toBe("evidence")
      expect(final.run._tag).toBe("RunFailed")
    }))

  it.effect("stacked runDemoAtom invocations interrupt the prior run and keep the latest completion metadata", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const firstStarted = yield* Deferred.make<void, never>()
      const firstInterrupted = yield* Deferred.make<void, never>()
      const holdFirstRun = yield* Deferred.make<void, never>()
      const callCount = yield* Ref.make(0)

      const runWithMeta = (_id: string) =>
        Ref.updateAndGet(callCount, (count) => count + 1).pipe(
          Effect.flatMap((count) =>
            count === 1
              ? Deferred.succeed(firstStarted, undefined).pipe(
                Effect.zipRight(Deferred.await(holdFirstRun)),
                Effect.as({
                  data: runDataFixture("stale"),
                  meta: streamMeta("req-stale", 13)
                }),
                Effect.onInterrupt(() => Deferred.succeed(firstInterrupted, undefined))
              )
              : Effect.succeed({
                data: runDataFixture("latest"),
                meta: streamMeta("req-latest", 41)
              })
          )
        )

      const runDemoAtom = makeRunDemoAtom(
        Atom.runtime(
          Layer.succeed(
            DemoClient,
            DemoClient.make({
              run: (id) => runWithMeta(id).pipe(Effect.map(({ data }) => data)),
              runWithMeta,
              preload: () => Effect.succeed(programPreviewFixture),
              versions: () => Effect.succeed({}),
              streamUrl: (id) => `/api/demos/${id}/stream`
            })
          )
        )
      )

      registry.mount(runDemoAtom)
      registry.set(runDemoAtom, "digest")
      yield* Deferred.await(firstStarted)

      registry.set(runDemoAtom, "digest")
      yield* Deferred.await(firstInterrupted)

      const final = yield* Effect.eventually(
        Effect.sync(() => readSurface(registry, "digest")).pipe(
          Effect.filterOrFail(
            (state) => state.run._tag === "RunSuccess" && state.run.data.summary === "latest",
            () => "waiting-for-latest-run"
          )
        )
      )

      expect(final.run._tag).toBe("RunSuccess")
      if (final.run._tag === "RunSuccess") {
        expect(final.run.data.summary).toBe("latest")
        expect(final.run.data.durationMs).toBe(41)
        expect(final.run.meta?.requestId).toBe("req-latest")
      }
    }))

  it.effect("stop and reset expose explicit run lifecycle states without mutating the active stage tab", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const runStarted = yield* Deferred.make<void, never>()
      const runInterrupted = yield* Deferred.make<void, never>()
      const holdRun = yield* Deferred.make<void, never>()
      const runtime = Atom.runtime(
        Layer.succeed(
          DemoClient,
          DemoClient.make({
            run: () => Effect.fail(errorFixture),
            runWithMeta: () =>
              Deferred.succeed(runStarted, undefined).pipe(
                Effect.zipRight(Deferred.await(holdRun)),
                Effect.as({
                  data: runDataFixture("ignored"),
                  meta: streamMeta("req-stop", 17)
                }),
                Effect.onInterrupt(() => Deferred.succeed(runInterrupted, undefined))
              ),
            preload: () => Effect.succeed(programPreviewFixture),
            versions: () => Effect.succeed({}),
            streamUrl: (id, customText = null) =>
              customText === null
                ? `/api/demos/${id}/stream`
                : `/api/demos/${id}/stream?customText=${encodeURIComponent(customText)}`
          })
        )
      )
      const runDemoAtom = makeRunDemoAtom(runtime)
      const runControlAtom = makeRunControlAtom(runtime)

      registry.mount(runDemoAtom)
      registry.mount(runControlAtom)
      registry.update(surfaceAtom("digest"), (state): SurfaceState => ({ ...state, stageTab: "evidence" }))

      registry.set(runDemoAtom, "digest")
      yield* Deferred.await(runStarted)

      registry.set(runControlAtom, { action: "stop", id: "digest" })
      yield* Deferred.await(runInterrupted)

      const stopped = yield* Effect.eventually(
        Effect.sync(() => readSurface(registry, "digest")).pipe(
          Effect.filterOrFail((state) => state.run._tag === "RunStopped", () => "waiting-for-stopped")
        )
      )

      expect(stopped.stageTab).toBe("evidence")

      registry.set(runControlAtom, { action: "reset", id: "digest" })

      const reset = readSurface(registry, "digest")
      expect(reset.stageTab).toBe("evidence")
      expect(reset.run._tag).toBe("RunIdle")
    }))

  it.effect("reset routes local interactive cleanup through the shared driver boundary", () =>
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
            streamUrl: (id, customText = null) =>
              customText === null
                ? `/api/demos/${id}/stream`
                : `/api/demos/${id}/stream?customText=${encodeURIComponent(customText)}`
          })
        )
      )
      const runControlAtom = makeRunControlAtom(runtime)

      registry.mount(runControlAtom)

      registry.set(customTextAtom, "custom text")
      registry.set(animatingAtom, true)
      registry.set(reflowControlsAtom, {
        corpusIndex: 1,
        width: reflowSliderMaxWidth,
        obstaclesEnabled: true
      })
      registry.set(optimizationAnimatingAtom, true)
      registry.set(tpeTrialsAtom, [{ x: 0.1, y: 0.2, value: 0.3, index: 0 }])
      registry.set(randomTrialsAtom, [{ x: 0.4, y: 0.5, value: 0.6, index: 0 }])
      registry.set(powerAnimatingAtom, true)
      registry.set(powerControlsAtom, { d: 1.2, n: 120, alpha: 0.1 })

      registry.set(runControlAtom, { action: "reset", id: "effect-text" })
      registry.set(runControlAtom, { action: "reset", id: "effect-search" })
      registry.set(runControlAtom, { action: "reset", id: "effect-math" })

      expect(registry.get(animatingAtom)).toBe(false)
      expect(registry.get(reflowControlsAtom)).toEqual({
        corpusIndex: corpus.length,
        width: Math.round(reflowSliderMaxWidth / 2),
        obstaclesEnabled: false
      })
      expect(registry.get(optimizationAnimatingAtom)).toBe(false)
      expect(registry.get(tpeTrialsAtom)).toEqual([])
      expect(registry.get(randomTrialsAtom)).toEqual([])
      expect(registry.get(powerAnimatingAtom)).toBe(false)
      expect(registry.get(powerControlsAtom)).toEqual({ d: 0.5, n: 30, alpha: 0.05 })
    }))
})
