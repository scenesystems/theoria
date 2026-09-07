import { Effect, Stream } from "effect"
import * as Arr from "effect/Array"

import { BrowserWindow } from "./BrowserWindow.js"

/**
 * The content-box width of `element` as whole pixels: every width the window's
 * `ResizeObserver` reports, beginning with the one it delivers when
 * observation starts. Text is laid out against the content box, so this
 * deliberately excludes padding and borders, and it reports nothing the
 * observer has not measured: an element that is not rendered has no width
 * until it is. The observer is disconnected when the stream ends.
 *
 * @since 0.2.0
 */
export const contentWidths = (element: HTMLElement): Stream.Stream<number, never, BrowserWindow> =>
  contentMeasure(element, (rect) => Math.floor(rect.width))

/**
 * The content-box height of `element` as whole pixels, on the same terms as
 * `contentWidths`. The height of the document's body is the height of the
 * page: anything laid out by hand that changes its own height moves what is
 * below it, so what is measured against the viewport measures again on each.
 *
 * @since 0.3.0
 */
export const contentHeights = (element: HTMLElement): Stream.Stream<number, never, BrowserWindow> =>
  contentMeasure(element, (rect) => Math.floor(rect.height))

const contentMeasure = (
  element: HTMLElement,
  measure: (rect: DOMRectReadOnly) => number
): Stream.Stream<number, never, BrowserWindow> =>
  Stream.unwrap(
    Effect.map(BrowserWindow, (browserWindow) =>
      Stream.asyncPush<number>((emit) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const observer = new browserWindow.ResizeObserver((entries) => {
              Arr.forEach(entries, (entry) => {
                emit.single(measure(entry.contentRect))
              })
            })
            observer.observe(element)

            return observer
          }),
          (observer) =>
            Effect.sync(() => {
              observer.disconnect()
            })
        )
      ))
  )
