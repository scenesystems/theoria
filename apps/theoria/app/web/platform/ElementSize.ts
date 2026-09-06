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
  Stream.unwrap(
    Effect.map(BrowserWindow, (browserWindow) =>
      Stream.asyncPush<number>((emit) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const observer = new browserWindow.ResizeObserver((entries) => {
              Arr.forEach(entries, (entry) => {
                emit.single(Math.floor(entry.contentRect.width))
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
