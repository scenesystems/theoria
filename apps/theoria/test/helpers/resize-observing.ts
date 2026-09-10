import { Context, Effect, Layer, MutableHashMap, MutableHashSet, MutableRef, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { BrowserWindow } from "../../app/web/platform/BrowserWindow.js"

/**
 * A `ResizeObserver` the test drives by hand, in place of the window's own
 * for as long as the layer lives. Observing a target delivers its last
 * reported size at once, as the browser's does; `report` delivers a new
 * size to every observer of that target, so anything the app measures with
 * the observer can be shown to answer a size change and nothing else.
 */

/** A content box, in CSS pixels. */
export const ContentBox = Schema.Struct({ width: Schema.Number, height: Schema.Number })
export type ContentBox = typeof ContentBox.Type

const unmeasured: ContentBox = { width: 0, height: 0 }

export class ResizeObserving extends Context.Tag("test/ResizeObserving")<ResizeObserving, {
  /** Delivers `box` as the size of `target` to every observer watching it. */
  readonly report: (target: Element, box: ContentBox) => Effect.Effect<void>
}>() {}

export const layer: Layer.Layer<ResizeObserving, never, BrowserWindow> = Layer.scoped(
  ResizeObserving,
  Effect.gen(function*() {
    const browserWindow = yield* BrowserWindow
    const sizes = MutableHashMap.empty<Element, ContentBox>()
    const sizeOf = (target: Element): ContentBox =>
      Option.getOrElse(MutableHashMap.get(sizes, target), () => unmeasured)

    const entryFor = (target: Element, box: ContentBox): ResizeObserverEntry => {
      const size: ResizeObserverSize = { blockSize: box.height, inlineSize: box.width }
      return {
        borderBoxSize: [size],
        contentBoxSize: [size],
        contentRect: new browserWindow.DOMRectReadOnly(0, 0, box.width, box.height),
        devicePixelContentBoxSize: [size],
        target
      }
    }

    const observers = MutableHashSet.empty<DrivenResizeObserver>()

    class DrivenResizeObserver implements ResizeObserver {
      private readonly watching = MutableRef.make(Arr.empty<Element>())

      constructor(private readonly callback: ResizeObserverCallback) {
        MutableHashSet.add(observers, this)
      }

      observe(target: Element): void {
        MutableRef.update(this.watching, Arr.append(target))
        this.callback([entryFor(target, sizeOf(target))], this)
      }

      unobserve(target: Element): void {
        MutableRef.update(this.watching, Arr.filter((watched) => watched !== target))
      }

      disconnect(): void {
        MutableRef.set(this.watching, Arr.empty())
        MutableHashSet.remove(observers, this)
      }

      /** Delivers `box` for `target` if this observer is watching it. */
      deliver(target: Element, box: ContentBox): void {
        if (Arr.contains(MutableRef.get(this.watching), target)) {
          this.callback([entryFor(target, box)], this)
        }
      }
    }

    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const original = browserWindow.ResizeObserver
        Reflect.defineProperty(browserWindow, "ResizeObserver", { configurable: true, value: DrivenResizeObserver })
        return original
      }),
      (original) =>
        Effect.sync(() => {
          Reflect.defineProperty(browserWindow, "ResizeObserver", { configurable: true, value: original })
        })
    )

    const report = (target: Element, box: ContentBox): Effect.Effect<void> =>
      Effect.sync(() => {
        MutableHashMap.set(sizes, target, box)
        Arr.forEach(Arr.fromIterable(observers), (observer) => {
          observer.deliver(target, box)
        })
      })

    return { report }
  })
)
