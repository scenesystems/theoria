import { describe, expect, it } from "@effect/vitest"
import { Duration, Effect, Layer, MutableRef, Queue, type Scope, Stream } from "effect"

import type { PlaceAct } from "../../app/contracts/demo/imagined-place-provenance.js"
import {
  placeActAttribute,
  placeActsRead,
  placeStageReadPastNow
} from "../../app/web/atoms/imagined-place-experience.js"
import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import * as BrowserWindow from "../../app/web/platform/BrowserWindow.js"
import * as ResizeObserving from "../helpers/resize-observing.js"

/**
 * Where the visitor is reading, and whether the stage has been read past,
 * are projections of where the page stands in the viewport now. The page
 * moves under the viewport not only when it is scrolled but when its layout
 * changes above the reading line — the build landing, the paper growing
 * under a search — so both are measured again on a change of the page's
 * height, with no scroll to have seen.
 */

/** A rectangle at `top`, `height` tall, as an element reports it. */
const rectAt = (browserWindow: typeof window, top: number, height: number): DOMRect =>
  new browserWindow.DOMRect(0, top, 600, height)

/** An element whose reported rectangle is the one at the top the test sets. */
const standingAt = (
  browserDocument: Document,
  browserWindow: typeof window,
  tag: string,
  top: MutableRef.MutableRef<number>,
  height: number
): HTMLElement => {
  const element = browserDocument.createElement(tag)
  Reflect.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => rectAt(browserWindow, MutableRef.get(top), height)
  })
  return element
}

/** A page with the arrival, the build's landmark below it, and the stage's column beside them. */
const onThePage = Effect.gen(function*() {
  const browserDocument = yield* BrowserDocument.BrowserDocument
  const browserWindow = yield* BrowserWindow.BrowserWindow
  const viewport = browserWindow.innerHeight
  const arrivalTop = MutableRef.make(0)
  const buildTop = MutableRef.make(viewport * 3)
  const columnTop = MutableRef.make(viewport)
  const arrival = standingAt(browserDocument, browserWindow, "section", arrivalTop, viewport)
  arrival.setAttribute(placeActAttribute, "arrive")
  const build = standingAt(browserDocument, browserWindow, "section", buildTop, viewport)
  build.setAttribute(placeActAttribute, "build")
  const column = standingAt(browserDocument, browserWindow, "aside", columnTop, viewport)
  column.setAttribute("data-place-stage", "column")
  yield* Effect.acquireRelease(
    Effect.sync(() => {
      browserDocument.body.append(arrival, column, build)
    }),
    () =>
      Effect.sync(() => {
        arrival.remove()
        column.remove()
        build.remove()
      })
  )
  return { browserDocument, viewport, buildTop, columnTop }
})

/** Every value of `stream` as it comes, taken one at a time; waiting on one that never comes fails fast. */
const following = <A>(stream: Stream.Stream<A, never, BrowserDocument.BrowserDocument | BrowserWindow.BrowserWindow>) =>
  Effect.gen(function*() {
    const seen = yield* Queue.unbounded<A>()
    yield* Effect.forkScoped(Stream.runForEach(stream, (value) => Queue.offer(seen, value)))
    return seen
  }).pipe(Effect.map((seen) =>
    Queue.take(seen).pipe(Effect.timeoutFail({
      duration: Duration.seconds(2),
      onTimeout: () => "nothing was measured again"
    }))
  ))

const pageLayer = Layer.mergeAll(BrowserDocument.layer, BrowserWindow.layer)

const withPage = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    Scope.Scope | BrowserDocument.BrowserDocument | BrowserWindow.BrowserWindow | ResizeObserving.ResizeObserving
  >
) => effect.pipe(Effect.scoped, Effect.provide(Layer.provideMerge(ResizeObserving.layer, pageLayer)))

describe("where the visitor is reading", () => {
  it.live("the act is measured again when the page's height changes, with no scroll", () =>
    withPage(Effect.gen(function*() {
      const { browserDocument, buildTop } = yield* onThePage
      const resizes = yield* ResizeObserving.ResizeObserving
      const next = yield* following<PlaceAct>(placeActsRead)
      expect(yield* next).toBe("arrive")
      // The paper above the build's landmark shrinks: the landmark rises past the reading line.
      MutableRef.set(buildTop, 0)
      yield* resizes.report(browserDocument.body, { width: 600, height: 1800 })
      expect(yield* next).toBe("build")
    })))

  it.live("the stage counts as read past when the page's height changes, with no scroll", () =>
    withPage(Effect.gen(function*() {
      const { browserDocument, columnTop, viewport } = yield* onThePage
      const resizes = yield* ResizeObserving.ResizeObserving
      const next = yield* following<boolean>(placeStageReadPastNow)
      expect(yield* next).toBe(false)
      MutableRef.set(columnTop, -viewport - 1)
      yield* resizes.report(browserDocument.body, { width: 600, height: 1800 })
      expect(yield* next).toBe(true)
    })))
})
