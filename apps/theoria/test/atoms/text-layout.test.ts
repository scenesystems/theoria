import { describe, expect, it } from "@effect/vitest"
import { Deferred, Effect, Layer, Ref } from "effect"
import * as Arr from "effect/Array"
import { AtomRegistry as Registry } from "effect/reactivity"

import { fontReadinessRevisionAtom, textLayoutLayerAtom, textLayoutRuntime } from "../../app/web/atoms/text-layout.js"
import type { CanvasUnavailable } from "../../app/web/platform/BrowserDocument.js"
import {
  type BrowserTextLayout,
  deterministicTextLayoutLive,
  FontReadiness
} from "../../app/web/text/browserTextLayout.js"

/**
 * The layout runtime is built at the fonts' current revision. A layout that
 * finds its faces in flight measures in the stand-in the page shows and tells
 * of their arrival when they land; the registry answers by advancing the
 * revision, and the runtime is built again — once — at the next one, so every
 * width measured in the stand-in is left behind with the layout that measured
 * it.
 */

/**
 * A layout that records the revision it is built at, and at the first finds
 * its faces in flight: they land when the test says so, as a page's do —
 * after the build, from the document's promise — never inside it.
 */
const layoutWhoseFacesLand = (built: Ref.Ref<ReadonlyArray<number>>, landed: Deferred.Deferred<void>) =>
  Layer.unwrap(
    Effect.gen(function*() {
      const readiness = yield* FontReadiness
      yield* Ref.update(built, Arr.append(readiness.revision))
      yield* Effect.when(
        Effect.forkScoped(Deferred.await(landed).pipe(Effect.andThen(readiness.facesArrived))),
        Effect.succeed(readiness.revision === 0)
      )
      return deterministicTextLayoutLive
    })
  )

/** A layout that records the revision it is built at, with every face in hand. */
const layoutWithFacesInHand = (built: Ref.Ref<ReadonlyArray<number>>) =>
  Layer.unwrap(
    Effect.map(FontReadiness, (readiness) =>
      Layer.effectDiscard(Ref.update(built, Arr.append(readiness.revision))).pipe(
        Layer.merge(deterministicTextLayoutLive)
      ))
  )

const registryWith = (layout: Layer.Layer<BrowserTextLayout, CanvasUnavailable, FontReadiness>) =>
  Effect.acquireRelease(
    Effect.sync(() => Registry.make({ initialValues: [[textLayoutLayerAtom, layout]] })),
    (registry) => Effect.sync(() => registry.dispose())
  )

/** A measurement in the runtime; what a surface would read. */
const probe = textLayoutRuntime.atom(Effect.succeed("measured"))

const measured = (registry: Registry.AtomRegistry) => Registry.getResult(registry, probe)

/** Keeps the runtime mounted, through the probe, for as long as the scope lives. */
const runtimeMounted = (registry: Registry.AtomRegistry) =>
  Effect.acquireRelease(Effect.sync(() => registry.mount(probe)), (unmount) => Effect.sync(() => unmount())).pipe(
    Effect.andThen(measured(registry))
  )

const builtTwice = (built: Ref.Ref<ReadonlyArray<number>>) =>
  Effect.repeat(Ref.get(built), { until: (revisions) => revisions.length >= 2 })

describe("the text layout runtime and the fonts' revision", () => {
  it.effect("a layout whose faces land after it was built is built again, once, at the next revision", () =>
    Effect.gen(function*() {
      const built = yield* Ref.make<ReadonlyArray<number>>([])
      const landed = yield* Deferred.make<void>()
      const registry = yield* registryWith(layoutWhoseFacesLand(built, landed))
      yield* runtimeMounted(registry)
      expect(yield* Ref.get(built)).toEqual([0])

      yield* Deferred.succeed(landed, undefined)
      yield* builtTwice(built)
      yield* measured(registry)
      yield* Effect.yieldNow

      expect(yield* Ref.get(built)).toEqual([0, 1])
      expect(registry.get(fontReadinessRevisionAtom)).toBe(1)
    }))

  it.effect("faces that land between a surface's first read and its subscription are not missed", () =>
    Effect.gen(function*() {
      const built = yield* Ref.make<ReadonlyArray<number>>([])
      const landed = yield* Deferred.make<void>()
      const registry = yield* registryWith(layoutWhoseFacesLand(built, landed))
      // A render reads before it commits its subscription; the faces land in between.
      yield* measured(registry)
      yield* Deferred.succeed(landed, undefined)
      yield* Effect.repeat(Effect.sync(() => registry.get(fontReadinessRevisionAtom)), {
        until: (revision) => revision === 1
      })

      yield* runtimeMounted(registry)
      yield* builtTwice(built)

      expect(yield* Ref.get(built)).toEqual([0, 1])
    }))

  it.effect("a layout with its faces in hand is built once, at the first revision", () =>
    Effect.gen(function*() {
      const built = yield* Ref.make<ReadonlyArray<number>>([])
      const registry = yield* registryWith(layoutWithFacesInHand(built))
      yield* runtimeMounted(registry)
      yield* Effect.yieldNow

      expect(yield* Ref.get(built)).toEqual([0])
      expect(registry.get(fontReadinessRevisionAtom)).toBe(0)
    }))
})
