import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"
import type { ReactNode } from "react"

import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import * as BrowserWindow from "../../app/web/platform/BrowserWindow.js"
import { SemanticText } from "../../app/web/view/primitives/SemanticText.js"
import { mountWithRegistry, waitForValue } from "../helpers/react-mount.js"

const BrowserTest = Layer.merge(BrowserWindow.layer, BrowserDocument.layer)

/**
 * happy-dom lays nothing out and its `ResizeObserver` never reports, so for the
 * duration of the effect the test window's observer reports `width` as the
 * content width of every element it is asked to observe, the way a browser
 * delivers the first observation when observation starts.
 */
function withObservedContentWidth<A, E, R>(
  width: number,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | BrowserWindow.BrowserWindow> {
  return Effect.flatMap(BrowserWindow.BrowserWindow, (browserWindow) => {
    const size: ResizeObserverSize = { blockSize: 0, inlineSize: width }
    class ReportingResizeObserver implements ResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}

      observe(target: Element): void {
        this.callback(
          [{
            borderBoxSize: [size],
            contentBoxSize: [size],
            contentRect: new browserWindow.DOMRectReadOnly(0, 0, width, 0),
            devicePixelContentBoxSize: [size],
            target
          }],
          this
        )
      }

      unobserve(): void {}

      disconnect(): void {}
    }

    return Effect.acquireUseRelease(
      Effect.sync(() => {
        const original = browserWindow.ResizeObserver

        Reflect.defineProperty(browserWindow, "ResizeObserver", { configurable: true, value: ReportingResizeObserver })

        return original
      }),
      () => effect,
      (original) =>
        Effect.sync(() => {
          Reflect.defineProperty(browserWindow, "ResizeObserver", { configurable: true, value: original })
        })
    )
  })
}

const renderedLineSpans = (container: HTMLDivElement): ReadonlyArray<HTMLSpanElement> =>
  Arr.fromIterable(container.querySelectorAll<HTMLSpanElement>("p > span, h3 > span"))

const waitForProjectedLines = (
  container: HTMLDivElement,
  accept: (count: number) => boolean
): Effect.Effect<ReadonlyArray<HTMLSpanElement>> =>
  waitForValue(() => Option.liftPredicate(renderedLineSpans(container), (spans) => accept(spans.length)))

const paragraphOf = (container: HTMLDivElement): Effect.Effect<HTMLParagraphElement> =>
  waitForValue(() => Option.fromNullable(container.querySelector("p")))

function withRenderedSemanticText<A>(
  width: number,
  node: ReactNode,
  use: (container: HTMLDivElement) => Effect.Effect<A>
): Effect.Effect<A> {
  return withObservedContentWidth(
    width,
    Effect.flatMap(mountWithRegistry(node, 400), ({ container }) => use(container)).pipe(Effect.scoped)
  ).pipe(Effect.provide(BrowserTest))
}

describe("SemanticText", () => {
  it.live("preserves pre-wrap whitespace and blank projected lines for code blocks", () =>
    withRenderedSemanticText(
      240,
      <SemanticText
        as="p"
        role="code-block"
        text={"const  x = 1\n\n\treturn 2"}
        variant="expanded"
      />,
      (container) =>
        Effect.gen(function*() {
          const spans = yield* waitForProjectedLines(container, (count) => count === 3)

          expect(spans[0]?.textContent).toBe("const  x = 1")
          expect(spans[1]?.textContent).toBe("\u00a0")
          expect(spans[2]?.textContent).toBe("\treturn 2")
        })
    ))

  it.live("reapplies projected wrap rules even when callers ask for nowrap and unlimited width", () =>
    withRenderedSemanticText(
      156,
      <SemanticText
        as="p"
        className="max-w-none whitespace-nowrap text-ink-700"
        role="status"
        text="Semantic text should keep reflowing from the prepared effect-text projection on narrow screens."
        variant="expanded"
        wrapAuthority="effect-text-projected"
      />,
      (container) =>
        Effect.gen(function*() {
          const spans = yield* waitForProjectedLines(container, (count) => count >= 2)
          const paragraph = yield* paragraphOf(container)

          expect(paragraph.dataset.lines).not.toBeUndefined()
          expect(spans.length).toBeGreaterThan(1)
        })
    ))

  it.live("keeps scoped package titles on one native browser line", () =>
    withRenderedSemanticText(
      220,
      <SemanticText
        as="h3"
        className="text-ink-900"
        role="subsection-title"
        text="@scenesystems/effect-inference"
        variant="compact"
      />,
      (container) =>
        Effect.gen(function*() {
          const heading = yield* waitForValue(() => Option.fromNullable(container.querySelector("h3")))

          expect(heading.textContent).toBe("@scenesystems/effect-inference")
        })
    ))

  it.live("limits projected card summaries to two lines while reserving two-line height", () =>
    withRenderedSemanticText(
      220,
      <SemanticText
        as="p"
        className="text-ink-700"
        lineLimit={2}
        reserveLines={2}
        role="card-summary"
        text="Prepare once, lay out many times across browser-backed text surfaces, obstacle-aware projections, and downstream calibration work."
        variant="compact"
        wrapAuthority="effect-text-projected"
      />,
      (container) =>
        Effect.gen(function*() {
          const spans = yield* waitForProjectedLines(container, (count) => count === 2)
          const paragraph = yield* paragraphOf(container)

          expect(paragraph.dataset.lines).toBe("2")
          expect(spans[1]?.textContent?.endsWith("…")).toBe(false)
        })
    ))
})
