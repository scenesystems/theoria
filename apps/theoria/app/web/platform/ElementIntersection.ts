import { Effect, Stream } from "effect"
import * as Arr from "effect/Array"

import { BrowserWindow } from "./BrowserWindow.js"

/**
 * Every intersection the window's `IntersectionObserver` reports for
 * `elements` against the viewport, beginning with the ones it delivers when
 * observation starts, one entry at a time. `init` shapes the observed band
 * of the viewport (`rootMargin`) and the ratios reported (`threshold`), as
 * the observer itself takes them. The observer is disconnected when the
 * stream ends.
 *
 * @since 0.3.0
 */
export const intersections = (
  elements: ReadonlyArray<Element>,
  init: IntersectionObserverInit
): Stream.Stream<IntersectionObserverEntry, never, BrowserWindow> =>
  Stream.unwrap(
    Effect.map(BrowserWindow, (browserWindow) =>
      Stream.asyncPush<IntersectionObserverEntry>((emit) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const observer = new browserWindow.IntersectionObserver((entries) => {
              Arr.forEach(entries, (entry) => {
                emit.single(entry)
              })
            }, init)
            Arr.forEach(elements, (element) => {
              observer.observe(element)
            })

            return observer
          }),
          (observer) =>
            Effect.sync(() => {
              observer.disconnect()
            })
        )
      ))
  )
