import { Effect, Stream } from "effect"
import * as Arr from "effect/Array"

/**
 * The content-box width of `element`: its width now, then every change the
 * browser observes, as whole pixels. Text is laid out against the content
 * box, so this deliberately excludes padding and borders. The observer is
 * disconnected when the stream ends.
 *
 * @since 0.2.0
 */
export const contentWidths = (element: HTMLElement): Stream.Stream<number> =>
  Stream.concat(
    Stream.succeed(element.clientWidth),
    Stream.asyncPush<number>((emit) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const observer = new ResizeObserver((entries) => {
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
    )
  )
