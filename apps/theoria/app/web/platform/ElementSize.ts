import { Effect, Stream } from "effect"
import * as Arr from "effect/Array"

import { BrowserWindow } from "./BrowserWindow.js"

/**
 * The content-box width of `element` as whole pixels: the width it has the
 * moment observation starts, then every width the window's `ResizeObserver`
 * reports. Text is laid out against the content box, so this deliberately
 * excludes padding and borders, and it reports nothing that has not been
 * measured: an element that is not rendered has no width until it is. The
 * first width is read synchronously so that what is cut to the element can be
 * cut in the same frame the element is laid out, before the browser paints:
 * the observer's first report comes only at the next rendering step. The
 * observer is disconnected when the stream ends.
 *
 * @since 0.2.0
 */
export const contentWidths = (element: HTMLElement): Stream.Stream<number, never, BrowserWindow> =>
  contentMeasure(element, (size) => Math.floor(size.width))

/**
 * The content-box height of `element` as whole pixels, on the same terms as
 * `contentWidths`. The height of the document's body is the height of the
 * page: anything laid out by hand that changes its own height moves what is
 * below it, so what is measured against the viewport measures again on each.
 *
 * @since 0.3.0
 */
export const contentHeights = (element: HTMLElement): Stream.Stream<number, never, BrowserWindow> =>
  contentMeasure(element, (size) => Math.floor(size.height))

const px = (length: string): number => Number.parseFloat(length)

/**
 * The content box as the observer reports it, to the same fraction of a pixel:
 * the border box the layout gave the element, less its borders and padding.
 * `clientWidth` is not used because it is rounded, and a rounded width would
 * disagree with the observer's by a pixel.
 */
const contentBox = (
  browserWindow: typeof window,
  element: HTMLElement
): { readonly width: number; readonly height: number } => {
  const style = browserWindow.getComputedStyle(element)
  const box = element.getBoundingClientRect()
  return {
    width: box.width - px(style.borderLeftWidth) - px(style.borderRightWidth) - px(style.paddingLeft)
      - px(style.paddingRight),
    height: box.height - px(style.borderTopWidth) - px(style.borderBottomWidth) - px(style.paddingTop)
      - px(style.paddingBottom)
  }
}

const contentMeasure = (
  element: HTMLElement,
  measure: (size: { readonly width: number; readonly height: number }) => number
): Stream.Stream<number, never, BrowserWindow> =>
  Stream.unwrap(
    Effect.map(BrowserWindow, (browserWindow) =>
      Stream.concat(
        Stream.sync(() => measure(contentBox(browserWindow, element))),
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
        )
      ).pipe(Stream.changes))
  )
