import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"
import type { ReactNode } from "react"

import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import { SemanticText } from "../../app/web/view/primitives/SemanticText.js"
import { mountWithRegistry } from "../helpers/react-mount.js"

function withMockClientWidth<A>(
  width: number,
  effect: Effect.Effect<A, never, never>
): Effect.Effect<A, never, never> {
  return Effect.acquireUseRelease(
    Effect.sync(() => {
      const descriptor = Option.fromNullable(Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth"))

      Reflect.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        get: () => width
      })

      return descriptor
    }),
    () => effect,
    (descriptor) =>
      Effect.sync(() =>
        Option.match(descriptor, {
          onNone: () => Reflect.deleteProperty(HTMLElement.prototype, "clientWidth"),
          onSome: (original) => Reflect.defineProperty(HTMLElement.prototype, "clientWidth", original)
        })
      )
  )
}

const renderedLineSpans = (container: HTMLDivElement): ReadonlyArray<HTMLSpanElement> =>
  Arr.fromIterable(container.querySelectorAll("p > span, h3 > span")).flatMap((element) =>
    element instanceof HTMLSpanElement ? [element] : []
  )

const waitForProjectedLines = (
  container: HTMLDivElement,
  expectedCount: number
): Effect.Effect<ReadonlyArray<HTMLSpanElement>, never, never> =>
  Effect.eventually(
    Effect.sync(() => renderedLineSpans(container)).pipe(
      Effect.filterOrFail((spans) => spans.length === expectedCount, () => "waiting-for-projected-semantic-text")
    )
  ).pipe(Effect.orDie)

const waitForProjectedLinesAtLeast = (
  container: HTMLDivElement,
  expectedMinimum: number
): Effect.Effect<ReadonlyArray<HTMLSpanElement>, never, never> =>
  Effect.eventually(
    Effect.sync(() => renderedLineSpans(container)).pipe(
      Effect.filterOrFail((spans) => spans.length >= expectedMinimum, () => "waiting-for-projected-semantic-text")
    )
  ).pipe(Effect.orDie)

function withRenderedSemanticText<A>(
  width: number,
  node: ReactNode,
  use: (container: HTMLDivElement) => Effect.Effect<A, never, never>
): Effect.Effect<A, never, never> {
  return withMockClientWidth(
    width,
    Effect.flatMap(mountWithRegistry(node, 400), ({ container }) => use(container)).pipe(
      Effect.scoped,
      Effect.provide(BrowserDocument.layer)
    )
  )
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
          const spans = yield* waitForProjectedLines(container, 3)

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
          const spans = yield* waitForProjectedLinesAtLeast(container, 2)
          const paragraph = container.querySelector("p")

          expect(paragraph instanceof HTMLParagraphElement).toBe(true)
          expect(paragraph?.dataset.lines).not.toBeUndefined()
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
          const heading = yield* Effect.eventually(
            Effect.sync(() => container.querySelector("h3")).pipe(
              Effect.filterOrFail(
                (node): node is HTMLHeadingElement => node instanceof HTMLHeadingElement,
                () => "waiting-for-subsection-title"
              )
            )
          ).pipe(Effect.orDie)

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
          const spans = yield* waitForProjectedLines(container, 2)
          const paragraph = container.querySelector("p")

          expect(paragraph instanceof HTMLParagraphElement).toBe(true)
          expect(paragraph?.dataset.lines).toBe("2")
          expect(paragraph?.style.minHeight).toBe("calc(var(--st-lh-card-summary) * 2)")
          expect(spans[1]?.textContent?.endsWith("…")).toBe(false)
        })
    ))
})
