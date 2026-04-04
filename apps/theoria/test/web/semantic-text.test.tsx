import { RegistryProvider } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { createRoot } from "react-dom/client"

import { SemanticText } from "../../app/web/view/primitives/SemanticText.js"

const withMockClientWidth = <A,>(
  width: number,
  effect: Effect.Effect<A, never, never>
): Effect.Effect<A, never, never> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth")

      Reflect.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        get: () => width
      })

      return descriptor
    }),
    () => effect,
    (descriptor) =>
      Effect.sync(() => {
        if (descriptor === undefined) {
          Reflect.deleteProperty(HTMLElement.prototype, "clientWidth")
          return
        }

        Reflect.defineProperty(HTMLElement.prototype, "clientWidth", descriptor)
      })
  )

const renderedLineSpans = (container: HTMLDivElement): ReadonlyArray<HTMLSpanElement> =>
  Array.from(container.querySelectorAll("p > span, h3 > span")).flatMap((element) =>
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

describe("SemanticText", () => {
  it.live("preserves pre-wrap whitespace and blank projected lines for code blocks", () =>
    withMockClientWidth(
      240,
      Effect.gen(function*() {
        const container = document.createElement("div")
        document.body.appendChild(container)
        const root = createRoot(container)

        yield* Effect.sync(() => {
          root.render(
            <RegistryProvider defaultIdleTTL={400}>
              <SemanticText
                as="p"
                role="code-block"
                text={"const  x = 1\n\n\treturn 2"}
                variant="expanded"
              />
            </RegistryProvider>
          )
        })

        yield* Effect.ensuring(
          Effect.gen(function*() {
            const spans = yield* waitForProjectedLines(container, 3)

            expect(spans.every((span) => span.className.includes("whitespace-pre"))).toBe(true)
            expect(spans[0]?.textContent).toBe("const  x = 1")
            expect(spans[1]?.textContent).toBe("\u00a0")
            expect(spans[2]?.textContent).toBe("\treturn 2")
          }),
          Effect.sync(() => {
            root.unmount()
            container.remove()
          })
        )
      })
    ))

  it.live("reapplies projected wrap rules even when callers ask for nowrap and unlimited width", () =>
    withMockClientWidth(
      156,
      Effect.gen(function*() {
        const container = document.createElement("div")
        document.body.appendChild(container)
        const root = createRoot(container)

        yield* Effect.sync(() => {
          root.render(
            <RegistryProvider defaultIdleTTL={400}>
              <SemanticText
                as="p"
                className="max-w-none whitespace-nowrap text-ink-700"
                role="status"
                text="Semantic text should keep reflowing from the prepared effect-text projection on narrow screens."
                variant="expanded"
                wrapAuthority="effect-text-projected"
              />
            </RegistryProvider>
          )
        })

        yield* Effect.ensuring(
          Effect.gen(function*() {
            const spans = yield* waitForProjectedLinesAtLeast(container, 2)
            const paragraph = container.querySelector("p")

            expect(paragraph instanceof HTMLParagraphElement).toBe(true)
            expect(paragraph?.className.includes("max-w-(--st-mw-status-expanded)")).toBe(true)
            expect(paragraph?.dataset.lines).not.toBeUndefined()
            expect(spans.length).toBeGreaterThan(1)
          }),
          Effect.sync(() => {
            root.unmount()
            container.remove()
          })
        )
      })
    ))

  it.live("keeps package titles on a single line even when projected wrapping is requested", () =>
    withMockClientWidth(
      220,
      Effect.gen(function*() {
        const container = document.createElement("div")
        document.body.appendChild(container)
        const root = createRoot(container)

        yield* Effect.sync(() => {
          root.render(
            <RegistryProvider defaultIdleTTL={400}>
              <SemanticText
                as="h3"
                className="text-ink-900"
                role="catalog-title"
                text="@scenesystems/digest"
                variant="compact"
                wrapAuthority="effect-text-projected"
              />
            </RegistryProvider>
          )
        })

        yield* Effect.ensuring(
          Effect.gen(function*() {
            const heading = yield* Effect.eventually(
              Effect.sync(() => container.querySelector("h3")).pipe(
                Effect.filterOrFail(
                  (node): node is HTMLHeadingElement => node instanceof HTMLHeadingElement,
                  () => "waiting-for-catalog-title"
                )
              )
            ).pipe(Effect.orDie)

            expect(heading.className.includes("whitespace-nowrap")).toBe(true)
            expect(heading.textContent).toBe("@scenesystems/digest")
            expect(renderedLineSpans(container)).toHaveLength(0)
          }),
          Effect.sync(() => {
            root.unmount()
            container.remove()
          })
        )
      })
    ))

  it.live("limits projected card summaries to two lines while reserving two-line height", () =>
    withMockClientWidth(
      220,
      Effect.gen(function*() {
        const container = document.createElement("div")
        document.body.appendChild(container)
        const root = createRoot(container)

        yield* Effect.sync(() => {
          root.render(
            <RegistryProvider defaultIdleTTL={400}>
              <SemanticText
                as="p"
                className="text-ink-700"
                lineLimit={2}
                reserveLines={2}
                role="card-summary"
                text="Prepare once, lay out many times across browser-backed text surfaces, obstacle-aware projections, and downstream calibration work."
                variant="compact"
                wrapAuthority="effect-text-projected"
              />
            </RegistryProvider>
          )
        })

        yield* Effect.ensuring(
          Effect.gen(function*() {
            const spans = yield* waitForProjectedLines(container, 2)
            const paragraph = container.querySelector("p")

            expect(paragraph instanceof HTMLParagraphElement).toBe(true)
            expect(paragraph?.dataset.lines).toBe("2")
            expect(paragraph?.style.minHeight).toBe("calc(var(--st-lh-card-summary) * 2)")
            expect(spans[1]?.textContent?.endsWith("…")).toBe(false)
          }),
          Effect.sync(() => {
            root.unmount()
            container.remove()
          })
        )
      })
    ))
})
